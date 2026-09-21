import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

// Kept as a compatibility route for older inline-menu messages. The active
// home screen uses the persistent Russian reply keyboard.

const composer = new Composer<Ctx>();

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("ℹ️ Выберите действие в меню: новый чат, история, профиль или настройки.");
});

export default composer;
