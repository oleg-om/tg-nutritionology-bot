import { Markup } from "telegraf";

export const menuButton = Markup.button.callback(
  "Главное меню",
  "show_main_menu",
);

export const backToMenuButton = Markup.button.callback(
  "⬅️ Вернуться в меню",
  "show_main_menu",
);

export const priceButton = Markup.button.callback("📈 Цены", "menu:price");

export const consultationButton = Markup.button.callback(
  "Запись на консультацию",
  "book_consultation",
);
