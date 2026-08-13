import { describe, expect, it } from "vitest";
import { parseInboundMessage } from "./parseInboundMessage";

const validPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "1254313717770824" },
            messages: [{ from: "573045503994", type: "text", id: "wamid.abc123" }],
          },
        },
      ],
    },
  ],
};

describe("parseInboundMessage", () => {
  it("extracts phone_number_id, normalized customer phone, and message id", () => {
    expect(parseInboundMessage(validPayload)).toEqual({
      phoneNumberId: "1254313717770824",
      customerPhone: "+573045503994",
      messageId: "wamid.abc123",
    });
  });

  it("returns null when there are no messages (e.g. a status-update delivery)", () => {
    expect(
      parseInboundMessage({
        entry: [{ changes: [{ value: { metadata: { phone_number_id: "1254313717770824" } } }] }],
      }),
    ).toBeNull();
  });

  it("returns null when phone_number_id is missing", () => {
    expect(
      parseInboundMessage({
        entry: [{ changes: [{ value: { messages: [{ from: "573045503994", id: "wamid.abc" }] } }] }],
      }),
    ).toBeNull();
  });

  it("returns null for a completely empty payload", () => {
    expect(parseInboundMessage({})).toBeNull();
  });
});
