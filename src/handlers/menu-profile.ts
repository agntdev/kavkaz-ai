import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, saveState } from "../state.js";
registerMainMenuItem({ label: "Профиль", data: "menu:profile", order: 30 });
const composer = new Composer<Ctx>();
const actions = inlineKeyboard([[inlineButton("Имя", "profile:edit:name"), inlineButton("Язык", "profile:language")], [inlineButton("Часовой пояс", "profile:edit:timezone"), inlineButton("В главное меню", "menu:main")]]);
function text(state: Awaited<ReturnType<typeof loadState>>) { const p = state.profile; return `Ваш профиль\n\nИмя: ${p.displayName}\nЯзык: ${p.language.toUpperCase()}\nЧасовой пояс: ${p.timezone}\nСообщений в этом месяце: ${p.messagesThisMonth}`; }
async function show(ctx: Ctx) { const state = await loadState(ctx); await ctx.reply(text(state), { reply_markup: actions }); }
composer.callbackQuery("menu:profile", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.hears("Профиль", show);
composer.callbackQuery("profile:edit:name", async (ctx) => { await ctx.answerCallbackQuery(); const s = await loadState(ctx); s.flow = "profile-name"; await saveState(ctx, s); await ctx.reply("Как к вам обращаться?", { reply_markup: { force_reply: true, input_field_placeholder: "Ваше имя" } }); });
composer.callbackQuery("profile:edit:timezone", async (ctx) => { await ctx.answerCallbackQuery(); const s = await loadState(ctx); s.flow = "profile-timezone"; await saveState(ctx, s); await ctx.reply("Напишите часовой пояс, например Europe/Moscow.", { reply_markup: { force_reply: true, input_field_placeholder: "Часовой пояс" } }); });
composer.callbackQuery("profile:language", async (ctx) => { await ctx.answerCallbackQuery(); const s = await loadState(ctx); s.profile.language = s.profile.language === "ru" ? "en" : "ru"; await saveState(ctx, s); await ctx.reply(`Язык изменён на ${s.profile.language.toUpperCase()}.`, { reply_markup: actions }); });
composer.on("message:text", async (ctx, next) => { const s = await loadState(ctx); if (s.flow !== "profile-name" && s.flow !== "profile-timezone") return next(); const value = ctx.message.text.trim(); if (!value || value.length > 80) { await ctx.reply("Нужно короткое непустое значение — попробуйте ещё раз."); return; } if (s.flow === "profile-name") s.profile.displayName = value; else s.profile.timezone = value; s.flow = "idle"; await saveState(ctx, s); await ctx.reply("Сохранил изменения.", { reply_markup: actions }); });
export default composer;
