import { describe, expect, it } from "vitest";
import { escapeMarkdown } from "./notifier";

describe("escapeMarkdown", () => {
  it("escapes Markdown special characters", () => {
    expect(escapeMarkdown("_*`[]")).toBe("\\_\\*\\`\\[\\]");
  });

  it("neutralizes a fake-link injection attempt", () => {
    expect(escapeMarkdown("[click here](http://evil.example)")).toBe(
      "\\[click here\\](http://evil.example)",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeMarkdown("Juan Pérez")).toBe("Juan Pérez");
  });
});
