import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { stateOf } from "../state.js";

registerMainMenuItem({ label: "Профиль", data: "menu:profile", order: 30 });
const composer = new Composer<Ctx>();
const actions = inlineKeyboard([
  [inlineButton("Имя", "profile:edit:name"), inlineButton("Язык", "profile:language")],
  [inlineButton("Часовой пояс", "profile:edit:timezone"), inlineButton("В главное меню", "menu:main")],
]);
function profileText(ctx: Ctx) { const p = stateOf(ctx).profile!; return `Ваш профиль\n\nИмя: ${p.displayName}\nЯзык: ${p.language.toUpperCase()}\nЧасовой пояс: ${p.timezone}\nСообщений в этом месяце: ${p.messagesThisMonth}`; }
async function showProfile(ctx: Ctx) { await ctx.reply(profileText(ctx), { reply_markup: actions }); }
composer.callbackQuery("menu:profile", async (ctx) => { await ctx.answerCallbackQuery(); await showProfile(ctx); });
composer.hears("Профиль", showProfile);
composer.callbackQuery("profile:edit:name", async (ctx) => { await ctx.answerCallbackQuery(); stateOf(ctx).flow = "profile-name"; await ctx.reply("Как к вам обращаться?", { reply_markup: { force_reply: true, input_field_placeholder: "Ваше имя" } }); });
composer.callbackQuery("profile:edit:timezone", async (ctx) => { await ctx.answerCallbackQuery(); stateOf(ctx).flow = "profile-timezone"; await ctx.reply("Напишите часовой пояс, например Europe/Moscow.", { reply_markup: { force_reply: true, input_field_placeholder: "Часовой пояс" } }); });
composer.callbackQuery("profile:language", async (ctx) => { await ctx.answerCallbackQuery(); const p = stateOf(ctx).profile!; p.language = p.language === "ru" ? "en" : "ru"; await ctx.reply(`Язык изменён на ${p.language.toUpperCase()}.`, { reply_markup: actions }); });
composer.on("message:text", async (ctx, next) => { const state = stateOf(ctx); if (state.flow !== "profile-name" && state.flow !== "profile-timezone") return next(); const value = ctx.message.text.trim(); if (!value || value.length > 80) return ctx.reply("Нужно короткое непустое значение — попробуйте ещё раз."); if (state.flow === "profile-name") state.profile!.displayName = value; else state.profile!.timezone = value; state.flow = "idle"; await ctx.reply("Сохранил изменения.", { reply_markup: actions }); });
export default composer;
