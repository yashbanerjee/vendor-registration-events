import { Global, Module } from "@nestjs/common";
import { PrismaService, TenantService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService, TenantService],
  exports: [PrismaService, TenantService],
})
export class PrismaModule {}
