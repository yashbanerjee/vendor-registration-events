import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { ensureMigrateDatabaseUrl } from "./config/env";
import { AppModule } from "./app.module";

async function bootstrap() {
  ensureMigrateDatabaseUrl();
  process.env.PROCESS_ROLE = "worker";
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
