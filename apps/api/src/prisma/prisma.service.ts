import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { isUuid } from "../common/http";

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Injectable()
export class TenantService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T> {
    if (!isUuid(organizationId)) {
      throw new Error("Invalid organization context.");
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'off', true)`;
      await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
      return fn(tx);
    }, { timeout: options?.timeout ?? 5_000, maxWait: options?.maxWait ?? 2_000 });
  }

  /** Auth bootstrap only. Business queries must use transaction(). */
  unscoped<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return fn(tx);
    });
  }
}
