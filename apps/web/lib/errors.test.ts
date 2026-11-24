import { describe, expect, it } from "vitest";
import { vendorErrorMessage, vendorFieldMessage } from "./errors";

describe("vendorErrorMessage", () => {
  it("never returns raw API payload text", () => {
    const error = { name: "ApiError", message: '{"statusCode":500,"message":"Internal server error"}', status: 500, code: "INTERNAL" };
    expect(vendorErrorMessage(error, "Please try again.")).toBe("Something went wrong on the server. Please try again.");
  });

  it("maps network failures to a plain connection message", () => {
    const error = { name: "ApiError", message: "fetch failed", status: 0, code: "NETWORK" };
    expect(vendorErrorMessage(error)).toBe("Could not reach the server. Check your internet connection and try again.");
  });

  it("uses the fallback for unknown client errors", () => {
    expect(vendorErrorMessage(new Error("PrismaClientKnownRequestError"), "Could not save.")).toBe("Could not save.");
  });
});

describe("vendorFieldMessage", () => {
  it("keeps short human field text", () => {
    expect(vendorFieldMessage("Trade license is required.")).toBe("Trade license is required.");
  });

  it("replaces technical field text", () => {
    expect(vendorFieldMessage("Prisma validation failed on field trade_license", "Please check this field.")).toBe("Please check this field.");
  });
});
