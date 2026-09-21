import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.hears("Файлы", async (ctx) => {
  await ctx.reply("Файлов пока нет. Отправьте файл в чат, чтобы сохранить его здесь.");
});

export default composer;
