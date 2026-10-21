import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PERMISSIONS } from "@vmp/shared";
import { RequirePermissions } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { WorkflowService } from "./workflow.service";

@ApiTags("assignments")
@Controller()
export class WorkflowController {
  constructor(@Inject(WorkflowService) private readonly workflow: WorkflowService) {}

  @Get("assignments")
  list(@Req() request: AuthedRequest, @Query() query: { cursor?: string; status?: string; q?: string; limit?: string }) {
    return this.workflow.list(request.user!, query);
  }

  @Get("submissions")
  @RequirePermissions(PERMISSIONS.submissionsRead)
  submissions(@Req() request: AuthedRequest) {
    return this.workflow.submissions(request.user!);
  }

  @Get("reviews")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  queue(@Req() request: AuthedRequest) {
    return this.workflow.reviewQueue(request.user!);
  }

  @Get("assignments/:id")
  get(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.workflow.get(request.user!, id);
  }

  @Post("assignments")
  @RequirePermissions(PERMISSIONS.assignmentsWrite)
  assign(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.workflow.assign(request.user!, body);
  }

  @Post("assignments/bulk")
  @RequirePermissions(PERMISSIONS.assignmentsWrite)
  assignMany(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.workflow.assignMany(request.user!, body);
  }

  @Post("assignments/:id/resend")
  @RequirePermissions(PERMISSIONS.assignmentsWrite)
  resend(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.workflow.resend(request.user!, id);
  }

  @Post("assignments/:id/form")
  @RequirePermissions(PERMISSIONS.assignmentsWrite)
  replaceForm(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.replaceForm(request.user!, id, body);
  }

  @Post("assignments/:id/revoke")
  @RequirePermissions(PERMISSIONS.assignmentsWrite)
  revoke(@Req() request: AuthedRequest, @Param("id") id: string) {
    return this.workflow.revoke(request.user!, id);
  }

  @Put("assignments/:id/draft")
  draft(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.saveDraft(request.user!, id, body);
  }

  @Post("assignments/:id/submit")
  submit(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.submit(request.user!, id, body);
  }

  @Post("assignments/:id/corrections")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  correct(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.requestCorrection(request.user!, id, body);
  }

  @Post("assignments/:id/approve")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  approve(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.approve(request.user!, id, body);
  }

  @Post("assignments/:id/reject")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  reject(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.reject(request.user!, id, body);
  }

  @Post("assignments/:id/notes")
  @RequirePermissions(PERMISSIONS.submissionsReview)
  note(@Req() request: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.workflow.addNote(request.user!, id, body);
  }
}
