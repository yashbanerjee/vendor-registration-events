import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../common/auth";
import type { AuthedRequest } from "../common/guards";
import { AuthService } from "./auth.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Sign in with email and password" })
  login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.login(body, request, response);
  }

  @Public()
  @Post("mfa/verify")
  @ApiOperation({ summary: "Complete sign-in with a time-based one-time code" })
  verifyMfa(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.verifyMfa(body, request, response);
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke the current session" })
  logout(@Req() request: AuthedRequest, @Res({ passthrough: true }) response: Response) {
    return this.auth.logout(request.user, response);
  }

  @Get("me")
  @ApiOperation({ summary: "Return the signed-in user" })
  me(@Req() request: AuthedRequest) {
    return this.auth.me(request.user!);
  }

  @Public()
  @Post("invitations/preview")
  @ApiOperation({ summary: "Preview an invitation without consuming it" })
  preview(@Body() body: unknown) {
    return this.auth.previewInvitation(body);
  }

  @Public()
  @Post("invitations/open")
  @ApiOperation({ summary: "Open an invitation when the vendor already has a password" })
  open(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.openInvitation(body, request, response);
  }

  @Public()
  @Post("invitations/accept")
  @ApiOperation({ summary: "Accept an invitation and set a password" })
  accept(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.acceptInvitation(body, request, response);
  }

  @Public()
  @Post("password/forgot")
  @ApiOperation({ summary: "Request a password reset email" })
  forgot(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Public()
  @Post("password/reset")
  @ApiOperation({ summary: "Reset a password with a single-use token" })
  reset(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Post("mfa/setup")
  @ApiOperation({ summary: "Begin multi-factor enrollment" })
  setup(@Req() request: AuthedRequest) {
    return this.auth.setupMfa(request.user!);
  }

  @Post("mfa/confirm")
  @ApiOperation({ summary: "Confirm multi-factor enrollment" })
  confirm(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.auth.confirmMfa(request.user!, body);
  }
}
