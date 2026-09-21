import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.hears("Тариф", async (ctx) => {
  await ctx.reply("Сейчас доступен бесплатный тариф без ограничений по функциям.");
});

export default composer;
