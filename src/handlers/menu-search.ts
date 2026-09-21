import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.hears("Поиск", async (ctx) => {
  await ctx.reply("Напишите слово или фразу для поиска по вашим чатам.", {
    reply_markup: { force_reply: true, input_field_placeholder: "Что найти" },
  });
});

export default composer;
