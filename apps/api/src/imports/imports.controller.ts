import { Controller, Get, Inject, Param, Post, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@vmp/shared";
import { RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@Controller("imports")
export class ImportsController {
  constructor(@Inject(ImportsService) private readonly imports: ImportsService) {}

  @Get("template")
  @RequirePermissions(PERMISSIONS.vendorsImport)
  template(@Res() response: Response) {
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=\"vendor-demo.csv\"");
    response.send(this.imports.template());
  }

  @Get()
  @RequirePermissions(PERMISSIONS.vendorsImport)
  list(@Req() request: AuthedRequest) {
    return this.imports.list(request.user!);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.vendorsImport)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5_242_880 } }))
  create(@Req() request: AuthedRequest, @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number; path?: string }) {
    return this.imports.create(request.user!, file);
  }

  @Get(":id")
  @RequirePermissions(PERMISSIONS.vendorsImport)
  get(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.imports.get(request.user!, id);
  }

  @Get(":id/errors.csv")
  @RequirePermissions(PERMISSIONS.vendorsImport)
  async errors(@Req() request: AuthedRequest, @Param("id") id: string, @Res() response: Response) {
    const csv = await this.imports.errorReport(request.user!, id);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=\"import-errors.csv\"");
    response.send(csv);
  }
}
