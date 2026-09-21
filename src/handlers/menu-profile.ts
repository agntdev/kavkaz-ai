import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { stateOf } from "../state.js";

registerMainMenuItem({ label: "👤 Profile", data: "menu:profile", order: 30 });
const composer = new Composer<Ctx>();
const actions = inlineKeyboard([
  [inlineButton("Имя", "profile:edit:name"), inlineButton("Язык", "profile:language")],
  [inlineButton("Часовой пояс", "profile:edit:timezone"), inlineButton("⬅️ Back to menu", "menu:main")],
]);
function profileText(ctx: Ctx) { const p = stateOf(ctx).profile!; return `View and edit display name, language, timezone, and see usage stats\n\nИмя: ${p.displayName}\nЯзык: ${p.language.toUpperCase()}\nЧасовой пояс: ${p.timezone}\nСообщений в этом месяце: ${p.messagesThisMonth}`; }
composer.callbackQuery("menu:profile", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("View and edit display name, language, timezone, and see usage stats", { reply_markup: actions }); await ctx.reply(profileText(ctx).split("\n\n")[1]); });
composer.callbackQuery("profile:edit:name", async (ctx) => { await ctx.answerCallbackQuery(); stateOf(ctx).flow = "profile-name"; await ctx.reply("Как к вам обращаться?", { reply_markup: { force_reply: true, input_field_placeholder: "Ваше имя" } }); });
composer.callbackQuery("profile:edit:timezone", async (ctx) => { await ctx.answerCallbackQuery(); stateOf(ctx).flow = "profile-timezone"; await ctx.reply("Напишите часовой пояс, например Europe/Moscow.", { reply_markup: { force_reply: true, input_field_placeholder: "Часовой пояс" } }); });
composer.callbackQuery("profile:language", async (ctx) => { await ctx.answerCallbackQuery(); const p = stateOf(ctx).profile!; p.language = p.language === "ru" ? "en" : "ru"; await ctx.reply(`Язык изменён на ${p.language.toUpperCase()}.`, { reply_markup: actions }); });
composer.on("message:text", async (ctx, next) => { const state = stateOf(ctx); if (state.flow !== "profile-name" && state.flow !== "profile-timezone") return next(); const value = ctx.message.text.trim(); if (!value || value.length > 80) return ctx.reply("Нужно короткое непустое значение — попробуйте ещё раз."); if (state.flow === "profile-name") state.profile!.displayName = value; else state.profile!.timezone = value; state.flow = "idle"; await ctx.reply("Сохранил изменения.", { reply_markup: actions }); });
export default composer;
