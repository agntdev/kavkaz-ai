import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBot } from "../src/bot.js";
import { parseBotSpec, runSpec } from "../src/toolkit/index.js";

const originalEndpoint = process.env.AI_API_URL;
const originalKey = process.env.AI_API_KEY;

afterEach(() => {
  if (originalEndpoint === undefined) delete process.env.AI_API_URL;
  else process.env.AI_API_URL = originalEndpoint;
  if (originalKey === undefined) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe("configured AI chat", () => {
  it("forwards the model response and sends bounded role-tagged history", async () => {
    process.env.AI_API_URL = "https://ai.example.test/chat";
    process.env.AI_API_KEY = "test-key";
    let request: RequestInit | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      request = init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "Вот готовый ответ модели." } }] }), { status: 200 });
    });
    const result = await runSpec(await buildBot("test-token"), parseBotSpec({
      name: "configured model reply",
      steps: [
        { send: { text: "Составь план" }, expect: [{ method: "sendMessage", payload: { text: "Вот готовый ответ модели." } }] },
      ],
    }));
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(request?.body)) as { messages: Array<{ role: string; content: string }> };
    expect(body.messages[0].role).toBe("system");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "Составь план" });
    expect(request?.headers).toMatchObject({ authorization: "Bearer test-key" });
  });

  it("retries a transient failure and gives a localized fallback", async () => {
    process.env.AI_API_URL = "https://ai.example.test/chat";
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return new Response("busy", { status: 503 });
    });
    const result = await runSpec(await buildBot("test-token"), parseBotSpec({
      name: "model failure",
      steps: [
        { send: { text: "Проверь сервис" }, expect: [{ method: "sendMessage", payload: { text: "Сервис временно недоступен, попробуйте позже." } }] },
      ],
    }));
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });
});
