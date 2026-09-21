import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, now, saveState, type StoredReport } from "../state.js";
type OwnerCtx = Ctx & { env?: Record<string, unknown> };

registerMainMenuItem({ label: "Сообщить о проблеме", data: "menu:report", order: 50 });
const composer = new Composer<Ctx>();
const categories = inlineKeyboard([[inlineButton("Ошибка", "report:category:bug"), inlineButton("Идея", "report:category:idea")], [inlineButton("Другое", "report:category:other")], [inlineButton("В главное меню", "menu:main")]]);

composer.callbackQuery("menu:report", async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); state.flow = "report-category"; await saveState(ctx, state); await ctx.reply("Что случилось? Выберите категорию.", { reply_markup: categories }); });
composer.callbackQuery(/^report:category:(bug|idea|other)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); state.flow = "report-description"; state.flowValue = ctx.match[1]; await saveState(ctx, state); await ctx.reply("Коротко опишите проблему — без личных данных.", { reply_markup: { force_reply: true, input_field_placeholder: "Что случилось" } }); });
composer.on("message:text", async (ctx, next) => {
  const state = await loadState(ctx);
  if (state.flow !== "report-description") return next();
  const description = ctx.message.text.trim();
  if (description.length < 3) return ctx.reply("Опишите проблему чуть подробнее.", { reply_markup: { force_reply: true, input_field_placeholder: "Что случилось" } });
  const report: StoredReport = { id: `r${now()}-${state.reports.length}`, category: state.flowValue ?? "other", description: description.slice(0, 2000), submittedAt: now() };
  state.reports.push(report); state.flow = "idle"; state.flowValue = undefined;
  const owner = adminChatId(ctx as OwnerCtx);
  if (!owner) { await saveState(ctx, state); await ctx.reply("Спасибо, записал сообщение. Владелец ещё не подключил уведомления.", { reply_markup: inlineKeyboard([[inlineButton("В главное меню", "menu:main")]]) }); return; }
  try {
    await ctx.api.sendMessage(owner, `Новый отчёт\nКатегория: ${report.category}\nПользователь: ${ctx.from?.id ?? "неизвестно"}\nИмя: ${state.profile?.displayName ?? "не указано"}\nОписание: ${report.description}`);
    report.notifiedAdminAt = now(); await saveState(ctx, state);
    await ctx.reply("Спасибо — отправил отчёт владельцу. Мы разберёмся.", { reply_markup: inlineKeyboard([[inlineButton("В главное меню", "menu:main")]]) });
  } catch { await saveState(ctx, state); await ctx.reply("Отчёт сохранён, но уведомление владельцу не доставилось. Попробуйте позже."); }
});
export default composer;
