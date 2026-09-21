import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainReplyKeyboard } from "../toolkit/index.js";
import { stateOf } from "../state.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

export const WELCOME = "👋 Добро пожаловать! Выберите действие в меню ниже.";

composer.command("start", async (ctx) => {
  stateOf(ctx);
  await ctx.reply(WELCOME, { reply_markup: mainReplyKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  // Reply keyboards belong to a new message; Telegram cannot attach one while
  // editing an inline-keyboard message.
  await ctx.reply(WELCOME, { reply_markup: mainReplyKeyboard() });
});

export default composer;
