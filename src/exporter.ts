import { InputFile } from "grammy";
import type { Ctx } from "./bot.js";
import type { StoredConversation } from "./state.js";
import { now } from "./state.js";

export async function sendConversationExport(ctx: Ctx, conversation: StoredConversation | undefined): Promise<void> {
  if (!conversation || conversation.deleted) {
    await ctx.reply("Не нашёл этот разговор — возможно, его уже удалили.");
    return;
  }
  const body = conversation.messages.map((m) => `${m.senderType === "user" ? "Вы" : m.senderType === "assistant" ? "Ассистент" : "Система"}: ${m.content}`).join("\n\n") || "В разговоре пока нет сообщений.";
  try {
    await ctx.api.sendDocument(ctx.chat!.id, new InputFile(new TextEncoder().encode(body), `${conversation.title || "conversation"}.txt`), { caption: "Готово — это экспорт разговора в UTF-8." });
  } catch {
    await ctx.reply("Не удалось подготовить файл. Попробуйте ещё раз позже.", { reply_markup: { inline_keyboard: [[{ text: "Попробовать снова", callback_data: `history:export:${conversation.conversationId}` }]] } });
  }
  // The session-backed audit marker keeps the export attempt observable without a keyspace scan.
  conversation.updatedAt = Math.max(conversation.updatedAt, now());
}
