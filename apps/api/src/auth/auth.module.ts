import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CsrfGuard, PermissionGuard, SessionGuard } from "../common/guards";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
