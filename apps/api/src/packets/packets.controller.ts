import { Body, Controller, ForbiddenException, Get, Inject, Param, Post, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@vmp/shared";
import { RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { PacketsService } from "./packets.service";

type Upload = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@ApiTags("pdf-forms")
@Controller()
export class PacketsController {
  constructor(@Inject(PacketsService) private readonly packets: PacketsService) {}

  @Post("exhibitions/:id/pdf-forms")
  @RequirePermissions(PERMISSIONS.exhibitionsWrite)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  addForm(@Req() request: AuthedRequest, @Param("id") id: string, @UploadedFile() file: Upload, @Body() body: { name?: string }) {
    return this.packets.addForm(request.user!, id, body.name ?? "", file);
  }

  @Post("exhibitions/:id/pdf-forms/assign")
  @RequirePermissions(PERMISSIONS.exhibitionsWrite)
  assign(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.packets.assignVendors(request.user!, id, body);
  }

  @Get("exhibitions/:id/pdf-forms")
  @RequirePermissions(PERMISSIONS.exhibitionsRead)
  exhibition(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.packets.exhibitionPackets(request.user!, id);
  }

  @Get("my/pdf-forms")
  mine(@Req() request: AuthedRequest) {
    return this.packets.mine(request.user!);
  }

  @Post("my/pdf-forms/:id/filled")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  filled(@Req() request: AuthedRequest, @Param("id") id: string, @UploadedFile() file: Upload) {
    return this.packets.uploadFilled(request.user!, id, file);
  }

  @Post("my/pdf-forms/:id/documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  extra(@Req() request: AuthedRequest, @Param("id") id: string, @UploadedFile() file: Upload, @Body() body: { name?: string }) {
    return this.packets.uploadExtra(request.user!, id, body.name ?? "", file);
  }

  @Post("my/pdf-forms/:id/submit")
  submit(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.packets.submit(request.user!, id);
  }

  @Post("pdf-files/:id/replace")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  replace(@Req() request: AuthedRequest, @Param("id") id: string, @UploadedFile() file: Upload) {
    return this.packets.replaceExtra(request.user!, id, file);
  }

  @Post("pdf-returns/:id/reupload")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  reuploadForm(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.packets.requestFormReupload(request.user!, id, body);
  }

  @Post("pdf-files/:id/reupload")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  reuploadFile(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.packets.requestFileReupload(request.user!, id, body);
  }

  @Get("pdf-forms/:id/file")
  blank(@Req() request: AuthedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    return this.send(request, response, () => this.packets.downloadBlank(request.user!, id));
  }

  @Get("pdf-returns/:id/file")
  filledFile(@Req() request: AuthedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    return this.send(request, response, () => this.packets.downloadReturn(request.user!, id));
  }

  @Get("pdf-files/:id/file")
  extraFile(@Req() request: AuthedRequest, @Param("id") id: string, @Res({ passthrough: true }) response: Response) {
    return this.send(request, response, () => this.packets.downloadFile(request.user!, id));
  }

  private async send(request: AuthedRequest, response: Response, load: () => Promise<{ bytes: Buffer; filename: string; mimeType: string }>) {
    this.assertReader(request);
    const file = await load();
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return new StreamableFile(file.bytes);
  }

  private assertReader(request: AuthedRequest) {
    const user = request.user!;
    if (!user.vendorId && !user.permissions.includes(PERMISSIONS.exhibitionsRead) && !user.permissions.includes(PERMISSIONS.documentsRead)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
  }
}
