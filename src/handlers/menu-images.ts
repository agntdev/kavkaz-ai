import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.hears("Изображения", async (ctx) => {
  await ctx.reply("Раздел изображений пока пуст. Здесь появятся ваши изображения.");
});

export default composer;
