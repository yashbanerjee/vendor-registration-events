import { Global, Module } from "@nestjs/common";
import { OutboxProcessor, OutboxService } from "./jobs.service";

@Global()
@Module({
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService, OutboxProcessor],
})
export class JobsModule {}
