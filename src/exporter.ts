import { InputFile } from "grammy";
import type { Ctx } from "./bot.js";
import type { StoredConversation } from "./state.js";
import { now, stateOf } from "./state.js";

export async function sendConversationExport(ctx: Ctx, conversation: StoredConversation | undefined): Promise<void> {
  if (!conversation || conversation.deleted) {
    await ctx.reply("Не нашёл этот разговор — возможно, его уже удалили.");
    return;
  }
  const body = conversation.messages.map((m) => `${m.author === "user" ? "Вы" : "Ассистент"}: ${m.text}`).join("\n\n") || "В разговоре пока нет сообщений.";
  try {
    await ctx.api.sendDocument(ctx.chat!.id, new InputFile(new TextEncoder().encode(body), `${conversation.title || "conversation"}.txt`), { caption: "Готово — это экспорт разговора в UTF-8." });
    stateOf(ctx).flow = "idle";
  } catch {
    await ctx.reply("Не удалось подготовить файл. Попробуйте ещё раз позже.", { reply_markup: { inline_keyboard: [[{ text: "Попробовать снова", callback_data: `history:export:${conversation.id}` }]] } });
  }
  // The session-backed audit marker keeps the export attempt observable without a keyspace scan.
  conversation.lastActivityAt = Math.max(conversation.lastActivityAt, now());
}
