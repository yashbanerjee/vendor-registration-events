import { Body, Controller, ForbiddenException, Get, Inject, Param, Post, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@vmp/shared";
import { RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { DocumentsService, uploadFields } from "./documents.service";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documents: DocumentsService) {}

  @Get()
  list(
    @Req() request: AuthedRequest,
    @Query() query: { cursor?: string; q?: string; vendorId?: string; exhibitionId?: string; status?: string; limit?: string },
  ) {
    const user = request.user!;
    if (!user.vendorId && !user.permissions.includes(PERMISSIONS.documentsRead)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    return this.documents.list(user, query);
  }

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  upload(@Req() request: AuthedRequest, @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, @Body() body: unknown) {
    const user = request.user!;
    if (!user.vendorId && !user.permissions.includes(PERMISSIONS.documentsWrite)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    return this.documents.upload(user, file, uploadFields.parse(body));
  }

  @Get("archive/:vendorId")
  archiveTree(@Req() request: AuthedRequest, @Param("vendorId") vendorId: string) {
    const user = request.user!;
    if (!user.vendorId && !user.permissions.includes(PERMISSIONS.documentsRead)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    return this.documents.archiveTree(user, vendorId);
  }

  @Get(":id/content")
  async content(@Req() request: AuthedRequest, @Param("id") id: string, @Query("disposition") disposition: string, @Res({ passthrough: true }) response: Response) {
    const user = request.user!;
    if (!user.vendorId && !user.permissions.includes(PERMISSIONS.documentsRead)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
    const file = await this.documents.read(user, id, disposition);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", file.inline ? file.mimeType : "application/octet-stream");
    response.setHeader("Content-Disposition", `${file.inline ? "inline" : "attachment"}; filename="${file.filename}"`);
    return new StreamableFile(file.bytes);
  }

  @Get(":id/presign")
  @RequirePermissions(PERMISSIONS.documentsRead)
  presign(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.documents.presign(request.user!, id);
  }

  @Post(":id/archive")
  @RequirePermissions(PERMISSIONS.documentsWrite)
  archive(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.documents.archive(request.user!, id);
  }
}
