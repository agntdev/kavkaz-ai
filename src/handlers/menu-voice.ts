import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.hears("Голос", async (ctx) => {
  await ctx.reply("Голосовой ввод пока недоступен. Напишите сообщение текстом.");
});

export default composer;
