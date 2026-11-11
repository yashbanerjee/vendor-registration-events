import { Global, Module } from "@nestjs/common";
import { ErrorReportsService } from "./error-reports.service";

@Global()
@Module({
  providers: [ErrorReportsService],
  exports: [ErrorReportsService],
})
export class ErrorsModule {}
