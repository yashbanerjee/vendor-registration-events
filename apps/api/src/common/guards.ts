import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { IS_PUBLIC, PERMISSIONS_KEY, type AuthContext } from "./auth";
import { hashesEqual, safeEqualText, sha256 } from "./crypto";
import { AuthService } from "../auth/auth.service";

export type AuthedRequest = Request & { user?: AuthContext; correlationId?: string };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.cookies?.sid as string | undefined;
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException("Sign in to continue.");
    }
    const user = await this.auth.authenticate(token);
    if (!user) {
      if (isPublic) return true;
      throw new UnauthorizedException("Your session has expired.");
    }
    request.user = user;
    const path = (request.originalUrl ?? request.url).split("?")[0];
    const passwordChangeAllowed = new Set(["/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/auth/password/change"]);
    if (user.mustChangePassword && !passwordChangeAllowed.has(path)) {
      throw new ForbiddenException("Change the temporary password before continuing.");
    }
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedException();
    const missing = required.filter((permission) => !user.permissions.includes(permission));
    if (missing.length) throw new ForbiddenException("You do not have permission for this action.");
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    if (!request.method || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
    const origin = request.header("origin");
    if (origin) {
      const allowed = process.env.WEB_ORIGIN ?? "http://localhost:3000";
      if (origin !== allowed && origin !== `http://localhost:${process.env.API_PORT ?? "3001"}`) {
        response.status(403);
        throw new ForbiddenException("The request origin is not allowed.");
      }
    }
    const publicMutations = new Set([
      "/api/v1/auth/login",
      "/api/v1/auth/invitations/accept",
      "/api/v1/auth/invitations/preview",
      "/api/v1/auth/invitations/open",
      "/api/v1/auth/password/forgot",
      "/api/v1/auth/password/reset",
      "/api/v1/auth/mfa/verify",
      "/api/v1/email/provider-events",
    ]);
    if (publicMutations.has(request.path)) return true;
    const cookie = request.cookies?.csrf as string | undefined;
    const header = request.header("x-csrf-token");
    if (!cookie || !header || !safeEqualText(cookie, header)) {
      throw new ForbiddenException("The security token did not match. Reload the page and try again.");
    }
    if (request.user && !hashesEqual(sha256(cookie), request.user.csrfHash)) {
      throw new ForbiddenException("The security token did not match. Reload the page and try again.");
    }
    return true;
  }
}
