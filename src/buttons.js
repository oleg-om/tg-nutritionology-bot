import { Markup } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. @your_channel or -1001234567890
const CHANNEL_URL = `https://t.me/${String(CHANNEL_ID).replace("@", "")}`;

export const menuButton = Markup.button.callback(
  "⚙️ Главное меню",
  "show_main_menu",
);

export const backToMenuButton = Markup.button.callback(
  "⬅️ Вернуться в меню",
  "show_main_menu",
);

export const priceButton = Markup.button.callback("📈 Цены", "menu:price");

export const consultationButton = Markup.button.callback(
  "📕 Запись на консультацию",
  "book_consultation_info",
);

export const approveConsultationButton = Markup.button.callback(
  "✅ Подтвердить запись",
  "book_consultation",
);

export const getGiftButton = Markup.button.callback(
  "🎁 Получить подарок",
  "menu:get-gift",
);

export const aboutMeButton = Markup.button.callback(
  "ℹ️ Обо мне",
  "menu:about-me",
);

export const checkSubscriptionButton = (guide) =>
  Markup.button.callback("Проверить подписку", `dl:${guide.slug}`);

export const subscribeButton = Markup.button.url("Подписаться", CHANNEL_URL);
