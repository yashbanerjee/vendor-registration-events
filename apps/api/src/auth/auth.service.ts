import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Algorithm, hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";
import type { Request, Response } from "express";
import { z } from "zod";
import { passwordSchema } from "@vmp/shared";
import { env } from "../config/env";
import type { AuthContext } from "../common/auth";
import { decryptString, encryptString, randomToken, sha256 } from "../common/crypto";
import { assertRateLimit } from "../common/http";
import { AuditService } from "../audit/audit.service";
import { OutboxService } from "../jobs/jobs.service";
import { effectiveSettings, parseStored } from "../platform/org-settings";
import { TenantService, type Tx } from "../prisma/prisma.service";

const argonOptions = { algorithm: Algorithm.Argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const acceptSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
  name: z.string().min(2).max(200),
});

const resetSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(TenantService) private readonly tenant: TenantService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
  ) {}

  async authenticate(rawToken: string): Promise<AuthContext | null> {
    const tokenHash = sha256(rawToken);
    return this.tenant.unscoped(async (tx) => {
      const session = await tx.session.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
            },
          },
        },
      });
      if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
      if (session.user.status !== "ACTIVE") return null;
      const roles = session.user.roles.map((entry) => entry.role.name);
      const permissions = [
        ...new Set(session.user.roles.flatMap((entry) => entry.role.permissions.map((item) => item.permission.key))),
      ];
      return {
        id: session.user.id,
        organizationId: session.user.organizationId,
        email: session.user.email,
        name: session.user.name,
        vendorId: session.user.vendorId,
        roles,
        permissions,
        sessionId: session.id,
        csrfHash: session.csrfHash,
      };
    });
  }

  async login(body: unknown, request: Request, response: Response) {
    assertRateLimit(`login:${request.ip}`, 10, 15 * 60 * 1000);
    const input = loginSchema.parse(body);
    const email = input.email.toLowerCase();
    const user = await this.tenant.unscoped((tx) =>
      tx.user.findUnique({
        where: { email },
        include: { mfa: true },
      }),
    );
    const passwordHash = user?.passwordHash ?? (await this.placeholderHash());
    const valid = await argonVerify(passwordHash, input.password).catch(() => false);
    if (!user || !user.passwordHash || !valid || user.status !== "ACTIVE") {
      throw new UnauthorizedException("The email or password is incorrect.");
    }
    if (user.mfaEnabled && user.mfa?.confirmedAt) {
      const mfaToken = randomToken();
      await this.tenant.unscoped((tx) =>
        tx.mfaChallenge.create({
          data: {
            userId: user.id,
            tokenHash: sha256(mfaToken),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        }),
      );
      return { data: { mfaRequired: true, mfaToken } };
    }
    await this.createSession(user.id, request, response);
    return { data: { mfaRequired: false } };
  }

  async verifyMfa(body: unknown, request: Request, response: Response) {
    const input = z.object({ mfaToken: z.string().min(20), code: z.string().regex(/^\d{6}$/) }).parse(body);
    const challenge = await this.tenant.unscoped((tx) =>
      tx.mfaChallenge.findUnique({
        where: { tokenHash: sha256(input.mfaToken) },
        include: { user: { include: { mfa: true } } },
      }),
    );
    if (!challenge || challenge.expiresAt.getTime() < Date.now() || !challenge.user.mfa) {
      throw new UnauthorizedException("The verification challenge has expired.");
    }
    const secret = OTPAuth.Secret.fromBase32(decryptString(challenge.user.mfa.secretEnc));
    const totp = new OTPAuth.TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" });
    const delta = totp.validate({ token: input.code, window: 1 });
    if (delta === null) throw new UnauthorizedException("The authentication code is incorrect.");
    await this.tenant.unscoped((tx) => tx.mfaChallenge.delete({ where: { id: challenge.id } }));
    await this.createSession(challenge.userId, request, response);
    return { data: { mfaRequired: false } };
  }

  async logout(user: AuthContext | undefined, response: Response) {
    if (user) {
      await this.tenant.unscoped((tx) =>
        tx.session.update({ where: { id: user.sessionId }, data: { revokedAt: new Date() } }),
      );
    }
    response.clearCookie("sid", { path: "/" });
    response.clearCookie("csrf", { path: "/" });
    return { data: { signedOut: true } };
  }

  me(user: AuthContext) {
    return {
      data: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        name: user.name,
        vendorId: user.vendorId,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }

  async acceptInvitation(body: unknown, request: Request, response: Response) {
    const input = acceptSchema.parse(body);
    const tokenHash = sha256(input.token);
    const result = await this.tenant.unscoped(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt.getTime() < Date.now()) {
        throw new NotFoundException("This invitation is invalid or has expired.");
      }
      if (!invitation.vendorId) throw new NotFoundException("This invitation is invalid or has expired.");
      const vendor = await tx.vendor.findUnique({ where: { id: invitation.vendorId } });
      if (!vendor) throw new NotFoundException("This invitation is invalid or has expired.");
      const email = invitation.email.toLowerCase();
      let user = await tx.user.findUnique({ where: { email } });
      const passwordHash = await argonHash(input.password, argonOptions);
      const vendorRole = await tx.role.findUnique({ where: { name: "VENDOR" } });
      if (!vendorRole) throw new ConflictException("Vendor access is not configured.");
      if (user?.passwordHash) {
        throw new ConflictException("This account already has a password. Open the invitation to sign in.");
      }
      if (!user) {
        user = await tx.user.create({
          data: {
            organizationId: invitation.organizationId,
            email,
            name: input.name,
            passwordHash,
            status: "ACTIVE",
            vendorId: vendor.id,
            roles: { create: { roleId: vendorRole.id } },
          },
        });
      } else {
        if (user.organizationId !== invitation.organizationId) {
          throw new ConflictException("This email is already used in another organization.");
        }
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            name: input.name,
            passwordHash,
            status: "ACTIVE",
            vendorId: vendor.id,
          },
        });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: vendorRole.id } },
          update: {},
          create: { userId: user.id, roleId: vendorRole.id },
        });
      }
      await tx.vendor.update({ where: { id: vendor.id }, data: { status: "ACTIVE" } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date(), userId: user.id } });
      if (invitation.assignmentId) {
        const assignment = await tx.formAssignment.findUnique({ where: { id: invitation.assignmentId } });
        if (assignment?.status === "INVITED") {
          await tx.formAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", lockVersion: { increment: 1 } } });
        }
      }
      await this.audit.record(tx, {
        organizationId: invitation.organizationId,
        actorId: user.id,
        actorRole: "VENDOR",
        action: "invitation.accepted",
        resourceType: "invitation",
        resourceId: invitation.id,
        vendorId: vendor.id,
      });
      return user;
    });
    await this.createSession(result.id, request, response);
    return { data: { accepted: true } };
  }

  async previewInvitation(body: unknown) {
    const input = z.object({ token: z.string().min(20) }).parse(body);
    return this.tenant.unscoped(async (tx) => {
      const invitation = await this.findOpenInvitation(tx, input.token);
      const user = await tx.user.findUnique({ where: { email: invitation.email.toLowerCase() } });
      const vendor = invitation.vendorId ? await tx.vendor.findUnique({ where: { id: invitation.vendorId } }) : null;
      return {
        data: {
          purpose: invitation.purpose,
          email: invitation.email,
          needsPassword: !user?.passwordHash,
          companyName: vendor?.companyName ?? "",
          assignmentId: invitation.assignmentId,
        },
      };
    });
  }

  async openInvitation(body: unknown, request: Request, response: Response) {
    const input = z.object({ token: z.string().min(20) }).parse(body);
    const user = await this.tenant.unscoped(async (tx) => {
      const invitation = await this.findOpenInvitation(tx, input.token);
      const account = await tx.user.findUnique({ where: { email: invitation.email.toLowerCase() } });
      if (!account?.passwordHash) throw new ConflictException({ message: "Create a password to continue.", code: "PASSWORD_REQUIRED" });
      if (account.organizationId !== invitation.organizationId) throw new ConflictException("This invitation cannot be used.");
      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date(), userId: account.id } });
      if (invitation.assignmentId) {
        const assignment = await tx.formAssignment.findUnique({ where: { id: invitation.assignmentId } });
        if (assignment?.status === "INVITED") {
          await tx.formAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS", lockVersion: { increment: 1 } } });
        }
      }
      await this.audit.record(tx, {
        organizationId: invitation.organizationId,
        actorId: account.id,
        actorRole: "VENDOR",
        action: "invitation.opened",
        resourceType: "invitation",
        resourceId: invitation.id,
        vendorId: invitation.vendorId,
      });
      return account;
    });
    await this.createSession(user.id, request, response);
    return { data: { opened: true, assignmentId: undefined } };
  }

  async forgotPassword(body: unknown) {
    const input = z.object({ email: z.string().email() }).parse(body);
    const email = input.email.toLowerCase();
    await this.tenant.unscoped(async (tx) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user || user.status === "DISABLED") return;
      const token = randomToken();
      const invitation = await tx.invitation.create({
        data: {
          organizationId: user.organizationId,
          purpose: "PASSWORD_RESET",
          email,
          tokenHash: sha256(token),
          userId: user.id,
          vendorId: user.vendorId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = `${env().WEB_ORIGIN}/reset-password/${token}`;
      await this.outbox.enqueue(tx, {
        organizationId: user.organizationId,
        type: "email.password-reset",
        idempotencyKey: `password-reset:${invitation.id}`,
        payload: {
          to: email,
          userId: user.id,
          template: "password-reset",
          subject: "Reset your Vendor Portal password",
          title: "Password reset",
          text: `A password reset was requested. Open ${link} within one hour. If you did not request this, you can ignore the message.`,
          link,
          audience: "vendor",
          idempotencyKey: `password-reset:${invitation.id}`,
        },
      });
    });
    return { data: { accepted: true } };
  }

  async resetPassword(body: unknown) {
    const input = resetSchema.parse(body);
    await this.tenant.unscoped(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { tokenHash: sha256(input.token) } });
      if (!invitation || invitation.purpose !== "PASSWORD_RESET" || invitation.usedAt || invitation.revokedAt || invitation.expiresAt.getTime() < Date.now() || !invitation.userId) {
        throw new NotFoundException("This reset link is invalid or has expired.");
      }
      await tx.user.update({
        where: { id: invitation.userId },
        data: { passwordHash: await argonHash(input.password, argonOptions), status: "ACTIVE" },
      });
      await tx.session.updateMany({ where: { userId: invitation.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
      await this.audit.record(tx, {
        organizationId: invitation.organizationId,
        actorId: invitation.userId,
        action: "password.reset",
        resourceType: "user",
        resourceId: invitation.userId,
      });
    });
    return { data: { reset: true } };
  }

  async setupMfa(user: AuthContext) {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "Vendor Portal",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    await this.tenant.transaction(user.organizationId, async (tx) => {
      await tx.mfaSecret.upsert({
        where: { userId: user.id },
        update: { secretEnc: encryptString(secret.base32), confirmedAt: null },
        create: { userId: user.id, secretEnc: encryptString(secret.base32) },
      });
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: false } });
    });
    return { data: { otpauthUrl: totp.toString(), secret: secret.base32 } };
  }

  async confirmMfa(user: AuthContext, body: unknown) {
    const input = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(body);
    await this.tenant.transaction(user.organizationId, async (tx) => {
      const record = await tx.mfaSecret.findUnique({ where: { userId: user.id } });
      if (!record) throw new NotFoundException("Set up multi-factor authentication first.");
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(decryptString(record.secretEnc)),
        digits: 6,
        period: 30,
        algorithm: "SHA1",
      });
      if (totp.validate({ token: input.code, window: 1 }) === null) {
        throw new UnauthorizedException("The authentication code is incorrect.");
      }
      await tx.mfaSecret.update({ where: { userId: user.id }, data: { confirmedAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      await this.audit.record(tx, {
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.roles.join(","),
        action: "mfa.enabled",
        resourceType: "user",
        resourceId: user.id,
      });
    });
    return { data: { enabled: true } };
  }

  private async findOpenInvitation(tx: Tx, token: string) {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException("This invitation is invalid or has expired.");
    }
    return invitation;
  }

  private async createSession(userId: string, request: Request, response: Response) {
    const rawSession = randomToken();
    const rawCsrf = randomToken();
    const account = await this.tenant.unscoped((tx) =>
      tx.user.findUnique({ where: { id: userId }, include: { organization: true } }),
    );
    const ttl = effectiveSettings(parseStored(account?.organization.settings)).sessionTtlHours * 60 * 60 * 1000;
    await this.tenant.unscoped((tx) =>
      tx.session.create({
        data: {
          userId,
          tokenHash: sha256(rawSession),
          csrfHash: sha256(rawCsrf),
          expiresAt: new Date(Date.now() + ttl),
          ip: request.ip ?? null,
          userAgent: request.header("user-agent")?.slice(0, 300) ?? null,
        },
      }),
    );
    const secure = env().COOKIE_SECURE;
    response.cookie("sid", rawSession, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: ttl });
    response.cookie("csrf", rawCsrf, { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: ttl });
  }

  private placeholderHash() {
    this.dummyHash ??= argonHash("not-a-real-password", argonOptions);
    return this.dummyHash;
  }
}
