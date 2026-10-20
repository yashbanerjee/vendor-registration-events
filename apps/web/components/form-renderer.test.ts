import { describe, expect, it } from "vitest";
import { isEditable } from "../lib/locking";

describe("form field locking", () => {
  it("keeps unflagged fields locked during correction", () => {
    expect(isEditable("company", ["booth"])).toBe(false);
    expect(isEditable("booth", ["booth"])).toBe(true);
    expect(isEditable("booth", ["booth"], true)).toBe(false);
  });
});
