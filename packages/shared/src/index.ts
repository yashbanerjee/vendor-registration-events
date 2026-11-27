import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200);

export * from "./permissions";
export * from "./workflow";
export * from "./form-schema";
export * from "./csv";
export * from "./countries";
