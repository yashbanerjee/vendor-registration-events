import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@vmp/shared";
import { RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { isPreviewableMime } from "../documents/scan";
import { CatalogService } from "./catalog.service";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("vendor-categories")
  @RequirePermissions(PERMISSIONS.vendorsRead)
  categories(@Req() request: AuthedRequest) {
    return this.catalog.listCategories(request.user!);
  }

  @Post("vendor-categories")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  createCategory(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.catalog.createCategory(request.user!, body);
  }

  @Patch("vendor-categories/:id")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  updateCategory(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateCategory(request.user!, id, body);
  }

  @Delete("vendor-categories/:id")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  deleteCategory(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.deleteCategory(request.user!, id);
  }

  @Get("vendors")
  @RequirePermissions(PERMISSIONS.vendorsRead)
  vendors(@Req() request: AuthedRequest, @Query() query: { cursor?: string; q?: string; status?: string; limit?: string; categoryId?: string }) {
    return this.catalog.listVendors(request.user!, query);
  }

  @Post("vendors")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  createVendor(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.catalog.createVendor(request.user!, body);
  }

  @Post("vendors/archive")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  archive(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.catalog.archiveVendors(request.user!, body);
  }

  @Get("vendors/:id")
  @RequirePermissions(PERMISSIONS.vendorsRead)
  vendor(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.getVendor(request.user!, id);
  }

  @Patch("vendors/:id")
  @RequirePermissions(PERMISSIONS.vendorsWrite)
  updateVendor(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateVendor(request.user!, id, body);
  }

  @Get("exhibitions")
  @RequirePermissions(PERMISSIONS.exhibitionsRead)
  exhibitions(@Req() request: AuthedRequest) {
    return this.catalog.listExhibitions(request.user!);
  }

  @Get("exhibitions/:id")
  @RequirePermissions(PERMISSIONS.exhibitionsRead)
  exhibition(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.getExhibition(request.user!, id);
  }

  @Post("exhibitions")
  @RequirePermissions(PERMISSIONS.exhibitionsWrite)
  createExhibition(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.catalog.saveExhibition(request.user!, body);
  }

  @Patch("exhibitions/:id")
  @RequirePermissions(PERMISSIONS.exhibitionsWrite)
  updateExhibition(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.saveExhibition(request.user!, body, id);
  }

  @Get("forms")
  @RequirePermissions(PERMISSIONS.formsRead)
  forms(@Req() request: AuthedRequest) {
    return this.catalog.listForms(request.user!);
  }

  @Post("forms")
  @RequirePermissions(PERMISSIONS.formsWrite)
  createForm(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.catalog.createForm(request.user!, body);
  }

  @Get("forms/compare/:leftId/:rightId")
  @RequirePermissions(PERMISSIONS.formsRead)
  compare(@Req() request: AuthedRequest, @Param("leftId") leftId: string, @Param("rightId") rightId: string) {
    return this.catalog.compare(request.user!, leftId, rightId);
  }

  @Get("forms/:id")
  @RequirePermissions(PERMISSIONS.formsRead)
  form(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.getForm(request.user!, id);
  }

  @Put("forms/:id/draft")
  @RequirePermissions(PERMISSIONS.formsWrite)
  draft(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateDraft(request.user!, id, body);
  }

  @Post("forms/:id/publish")
  @RequirePermissions(PERMISSIONS.formsPublish)
  publish(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.publish(request.user!, id);
  }

  @Post("forms/:id/duplicate")
  @RequirePermissions(PERMISSIONS.formsWrite)
  duplicate(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.catalog.duplicate(request.user!, id);
  }

  @Post("forms/:id/assets")
  @RequirePermissions(PERMISSIONS.formsWrite)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20_971_520 } }))
  uploadAsset(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    return this.catalog.uploadAsset(request.user!, id, file);
  }

  @Get("form-assets/:id/content")
  async asset(
    @Req() request: AuthedRequest,
    @Param("id") id: string,
    @Query("disposition") disposition: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.catalog.readAsset(request.user!, id);
    const inline = disposition !== "attachment" && isPreviewableMime(file.mimeType);
    const type = inline ? file.mimeType : "application/octet-stream";
    const contentDisposition = `${inline ? "inline" : "attachment"}; filename="${file.filename}"`;
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Disposition", contentDisposition);
    response.setHeader("Content-Length", String(file.bytes.length));
    return new StreamableFile(file.bytes, { type, disposition: contentDisposition, length: file.bytes.length });
  }
}
