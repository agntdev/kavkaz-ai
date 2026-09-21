import { describe, expect, it } from "vitest";
import { buildModelInput, setClock, type StoredConversation } from "../src/state.js";

describe("conversation context policy", () => {
  it("keeps user and assistant messages in order and caps context at 20", () => {
    setClock(() => 1_000_000);
    const conversation: StoredConversation = { conversationId: "c", userId: 1, title: "", createdAt: 0, updatedAt: 0, messages: [] };
    for (let i = 0; i < 21; i += 1) conversation.messages.push({ messageId: `m${i}`, conversationId: "c", senderType: i % 2 ? "assistant" : "user", content: `message-${i}`, timestamp: 1_000_000, contentMeta: {} });
    const input = buildModelInput(conversation, 90);
    expect(input).not.toContain("message-0");
    expect(input).toContain("user: message-2");
    expect(input).toContain("assistant: message-3");
    expect(input.indexOf("user: message-2")).toBeLessThan(input.indexOf("assistant: message-3"));
    setClock(undefined);
  });
});
