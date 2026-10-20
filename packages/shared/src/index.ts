import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.");

export * from "./permissions";
export * from "./workflow";
export * from "./form-schema";
export * from "./csv";
export * from "./countries";
