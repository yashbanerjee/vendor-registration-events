import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";
import { ErrorsModule } from "./errors.module";

@Module({
  imports: [ErrorsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
