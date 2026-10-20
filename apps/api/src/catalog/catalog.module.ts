import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [WorkflowModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
