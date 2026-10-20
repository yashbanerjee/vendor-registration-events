import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { APP_FILTER } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import type { NextFunction, Request, Response } from "express";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { requestContext } from "./common/context";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { DocumentsModule } from "./documents/documents.module";
import { ImportsModule } from "./imports/imports.module";
import { JobsModule } from "./jobs/jobs.module";
import { PlatformModule } from "./platform/platform.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { WorkflowModule } from "./workflow/workflow.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            'res.headers["set-cookie"]',
            "req.body.password",
            "req.body.currentPassword",
            "req.body.smtpPassword",
            "req.body.storageSecret",
            "req.body.token",
            "req.body.secret",
          ],
          remove: true,
        },
      },
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    JobsModule,
    AuthModule,
    CatalogModule,
    WorkflowModule,
    DocumentsModule,
    ImportsModule,
    PlatformModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((request: Request, response: Response, next: NextFunction) => {
        const incoming = request.header("x-correlation-id");
        const correlationId = incoming && /^[A-Za-z0-9-]{8,80}$/.test(incoming) ? incoming : randomUUID();
        response.setHeader("x-correlation-id", correlationId);
        requestContext.run(
          { correlationId, ip: request.ip, userAgent: request.header("user-agent")?.slice(0, 300) },
          () => next(),
        );
      })
      .forRoutes("*");
  }
}
