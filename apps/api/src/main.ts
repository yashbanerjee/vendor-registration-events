import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { allowedOrigins, ensureMigrateDatabaseUrl, env } from "./config/env";

async function bootstrap() {
  ensureMigrateDatabaseUrl();
  const config = env();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api/v1");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set("etag", false);
  app.use((_request: unknown, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.enableShutdownHooks();
  if (config.NODE_ENV !== "production" && config.ENABLE_SWAGGER) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Exhibition Vendor Management API")
        .setDescription("Versioned REST API for vendor onboarding, forms, review, documents, and operations.")
        .setVersion("1.0")
        .addCookieAuth("sid")
        .build(),
    );
    SwaggerModule.setup("api/docs", app, document);
  }
  const port = Number(process.env.PORT || config.API_PORT);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
