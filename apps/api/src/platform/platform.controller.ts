import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { PERMISSIONS } from "@vmp/shared";
import { Public, RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { PlatformService } from "./platform.service";

@ApiTags("platform")
@Controller()
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platform: PlatformService) {}

  @Public()
  @Get("health")
  live() {
    return { data: { status: "ok" } };
  }

  @Public()
  @Get("health/ready")
  ready() {
    return this.platform.ready();
  }

  @Get("dashboard")
  @RequirePermissions(PERMISSIONS.reportsRead)
  dashboard(@Req() request: AuthedRequest) {
    return this.platform.dashboard(request.user!);
  }

  @Get("search")
  search(@Req() request: AuthedRequest, @Query("q") q = "") {
    return this.platform.search(request.user!, q);
  }

  @Get("notifications")
  notifications(@Req() request: AuthedRequest) {
    return this.platform.notifications(request.user!);
  }

  @Post("notifications/:id/read")
  read(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.platform.markRead(request.user!, id);
  }

  @Get("audit-logs")
  @RequirePermissions(PERMISSIONS.auditRead)
  audits(@Req() request: AuthedRequest, @Query("cursor") cursor?: string) {
    return this.platform.audits(request.user!, cursor);
  }

  @Get("reports/:kind")
  @RequirePermissions(PERMISSIONS.reportsExport)
  async report(@Req() request: AuthedRequest, @Param("kind") kind: "vendors" | "submissions" | "corrections" | "emails" | "documents", @Res() response: Response) {
    const csv = await this.platform.report(request.user!, kind);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${kind}-report.csv"`);
    response.send(csv);
  }

  @Get("jobs")
  @RequirePermissions(PERMISSIONS.jobsRead)
  jobs(@Req() request: AuthedRequest) {
    return this.platform.jobs(request.user!);
  }

  @Post("jobs/:id/retry")
  @RequirePermissions(PERMISSIONS.jobsRetry)
  retry(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.platform.retryJob(request.user!, id);
  }

  @Get("organization")
  organization(@Req() request: AuthedRequest) {
    return this.platform.organization(request.user!);
  }

  @Patch("organization")
  @RequirePermissions(PERMISSIONS.settingsManage)
  updateOrganization(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.platform.updateOrganization(request.user!, body);
  }

  @Public()
  @Post("email/provider-events")
  providerEvent(@Headers("x-email-webhook-secret") secret: string | undefined, @Body() body: unknown) {
    return this.platform.providerEvent(secret, body);
  }
}
