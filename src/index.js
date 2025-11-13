import { Telegraf, Markup } from "telegraf";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import {
  ABOUT_ME_TEXT,
  APPROVE_BOOKING_TEXT,
  BOOKING_TEXT,
  GUIDE_NOT_FOUND_SUBSCRIPTION,
  MAIN_MENU_TEXT,
  PRICE_TEXT,
  START_TEXT,
  THANKS_TEXT,
} from "./texts.js";
import {
  aboutMeButton,
  approveConsultationButton,
  backToMenuButton,
  checkSubscriptionButton,
  consultationButton,
  getGiftButton,
  menuButton,
  priceButton,
  subscribeButton,
} from "./buttons.js";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. @your_channel or -1001234567890
const ADMIN_ID = process.env.ADMIN_ID; // Your Telegram user ID
const CHANNEL_URL = `https://t.me/${String(CHANNEL_ID).replace("@", "")}`;
const BASE_DIR = path.resolve(process.cwd());
const GUIDES_PATH = path.join(BASE_DIR, "src", "guides.json");
const FILES_DIR = path.join(BASE_DIR, "storage", "guides");

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is not set. Please configure .env");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error(
    "CHANNEL_ID is not set. Please configure .env (e.g. @your_channel or -100...)",
  );
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function loadGuides() {
  try {
    const raw = fs.readFileSync(GUIDES_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error("Failed to load guides.json", e);
    return [];
  }
}

function findGuideBySlug(slug) {
  const guides = loadGuides();
  return guides.find((g) => g.slug === slug);
}

function getGuideFileAbsolutePath(relativePath) {
  return path.join(FILES_DIR, relativePath);
}

function isValidMemberStatus(status) {
  // Allowed statuses that mean the user is a member of the channel
  // 'member', 'administrator', 'creator' are acceptable
  return (
    status === "member" || status === "administrator" || status === "creator"
  );
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function isUserSubscribed(ctx, userId) {
  try {
    const chatMember = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
    return isValidMemberStatus(chatMember.status);
  } catch (e) {
    // If the bot can't access the channel or user, treat as not subscribed
    return false;
  }
}

function buildGuidesKeyboard(guides) {
  const buttons = guides.map((g) =>
    Markup.button.callback(g.title, `open:${g.slug}`),
  );
  // Arrange buttons in one per row
  const rows = buttons.map((b) => [b]);
  rows.push([menuButton]);
  return Markup.inlineKeyboard(rows);
}

function buildMenuKeyboard() {
  return Markup.inlineKeyboard([[menuButton]]);
}

function buildMainMenuKeyboard(ctx) {
  const payload = (ctx.startPayload || "").trim();

  return Markup.inlineKeyboard([
    [priceButton],
    ...(payload && [
      Markup.button.callback("🎁 Получить подарок", "menu:get-gift"),
    ]),
    [Markup.button.callback("ℹ️ Обо мне", "menu:about-me")],
  ]);
}

async function sendPrice(ctx) {
  await ctx.reply(PRICE_TEXT, {
    ...Markup.inlineKeyboard([[consultationButton], [backToMenuButton]]),
    parse_mode: "HTML",
  });
}

async function sendGuides(ctx) {
  const guides = loadGuides();
  if (guides.length === 0) {
    await ctx.reply("Пока нет доступных гайдов.", {
      ...buildMainMenuKeyboard(ctx),
    });
    return;
  }
  const listText = ["🎁 Доступные гайды:", ""].join("\n");
  await ctx.reply(listText, {
    ...buildGuidesKeyboard(guides),
  });
}

async function sendStart(ctx) {
  await ctx.reply(START_TEXT, {
    ...Markup.inlineKeyboard([
      [Markup.button.url("Канал", CHANNEL_URL)],
      [menuButton],
    ]),
  });
}

async function sendAbout(ctx) {
  await ctx.reply(ABOUT_ME_TEXT, {
    ...Markup.inlineKeyboard([
      [priceButton],
      [consultationButton],
      [backToMenuButton],
    ]),
  });
}

async function notifyAdminAboutConsultation(ctx) {
  if (!ADMIN_ID) {
    console.warn("ADMIN_ID is not set. Cannot send notification.");
    return;
  }

  const user = ctx.from;
  const userName = user.first_name || "";
  const userLastName = user.last_name || "";
  const userFullName =
    [userName, userLastName].filter(Boolean).join(" ") || "Не указано";
  const username = user.username ? `@${user.username}` : "Не указан";
  const userId = user.id;
  const userLink = `tg://user?id=${userId}`;

  const notificationText = [
    "🔔 <b>Новая заявка на консультацию</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(userFullName)}`,
    `<b>Username:</b> ${username}`,
    `<b>ID:</b> <code>${userId}</code>`,
    `<b>Связаться:</b> <a href="${userLink}">Написать пользователю</a>`,
  ].join("\n");

  try {
    await bot.telegram.sendMessage(ADMIN_ID, notificationText, {
      parse_mode: "HTML",
    });
  } catch (e) {
    console.error("Failed to send notification to admin:", e);
  }
}

bot.start(async (ctx) => {
  const payload = (ctx.startPayload || "").trim();
  if (payload) {
    const guide = findGuideBySlug(payload);
    if (guide) {
      const text = [
        `Привет! 😇 Меня зовут Дарья Левченко. Я дипломированный нутрициолог и подготовила для тебя подарок 🎁 : Гайд: <b>${escapeHtml(guide.title)}</b>`,
        "",
        "",
        `Для того, чтобы получить его, подпишись на мой телеграм канал: ${CHANNEL_URL}`,
      ].join("\n");
      await ctx.reply(text, {
        ...Markup.inlineKeyboard([
          [subscribeButton, checkSubscriptionButton(guide)],
        ]),
        parse_mode: "HTML",
      });
      return;
    }
  }

  await ctx.reply(
    "Привет! 🥦 Меня зовут Дарья Левченко. Я дипломированный нутрициолог. Этот бот поможет ответить тебе на самые популярные вопросы. Скорее переходи в меню 👇🏼",
    {
      ...buildMenuKeyboard(),
      parse_mode: "HTML",
    },
  );
});

bot.command("price", async (ctx) => {
  await sendPrice(ctx);
});

bot.command("guides", async (ctx) => {
  await sendGuides(ctx);
});

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery?.data || "";
  if (data === "show_main_menu") {
    await ctx.answerCbQuery();
    await ctx.reply(MAIN_MENU_TEXT, {
      ...Markup.inlineKeyboard([[priceButton, aboutMeButton], [getGiftButton]]),
    });
    return;
  }
  if (data === "menu:price") {
    await ctx.answerCbQuery();
    await sendPrice(ctx);
    return;
  }
  if (data === "menu:get-gift") {
    await ctx.answerCbQuery();
    await sendGuides(ctx);
    return;
  }
  if (data === "menu:about-me") {
    await ctx.answerCbQuery();
    await sendAbout(ctx);
    return;
  }
  if (data === "menu:start") {
    await ctx.answerCbQuery();
    await sendStart(ctx);
    return;
  }
  if (data === "book_consultation_info") {
    await notifyAdminAboutConsultation(ctx);
    await ctx.reply(APPROVE_BOOKING_TEXT, {
      ...Markup.inlineKeyboard([
        [approveConsultationButton],
        [backToMenuButton],
      ]),
    });
    return;
  }
  if (data === "book_consultation") {
    await ctx.answerCbQuery("Отправляю заявку…");
    await notifyAdminAboutConsultation(ctx);
    await ctx.reply(BOOKING_TEXT, {
      ...Markup.inlineKeyboard([[priceButton], [aboutMeButton]]),
    });
    return;
  }
  // ope:<slug> — verify subscription and send file
  if (data.startsWith("open:")) {
    const slug = data.slice("open:".length);
    const guide = findGuideBySlug(slug);
    if (!guide) {
      await ctx.answerCbQuery("Гайд не найден", { show_alert: true });
      return;
    }
    const userId = ctx.from?.id;
    const subscribed = await isUserSubscribed(ctx, userId);
    if (!subscribed) {
      await ctx.answerCbQuery(undefined);
      await ctx.reply(
        [
          `Для того, чтобы получить подарок 🎁 - гайд <b>${escapeHtml(guide.title)}</b>, подпишись на мой телеграм канал ${CHANNEL_URL}`,
        ].join("\n"),
        {
          ...Markup.inlineKeyboard([
            [subscribeButton, checkSubscriptionButton(guide)],
          ]),
          parse_mode: "HTML",
        },
      );
      return;
    }
    const filePath = getGuideFileAbsolutePath(guide.file);
    if (!fs.existsSync(filePath)) {
      await ctx.answerCbQuery("Файл гайда не найден на сервере", {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery("Проверяю подписку…");
    await ctx.reply(
      [
        "Твой подарок ниже 🎁",
        `Надеюсь гайд и мой телеграм канал ${CHANNEL_URL} будут тебе полезны 😊`,
      ].join("\n"),
      {
        ...buildMenuKeyboard(),
        parse_mode: "HTML",
      },
    );
    await ctx.replyWithDocument({
      source: fs.createReadStream(filePath),
      filename: path.basename(filePath),
    });
    return;
  }
  // dl:<slug> — verify subscription and send file
  if (data.startsWith("dl:")) {
    const slug = data.slice("dl:".length);
    const guide = findGuideBySlug(slug);
    if (!guide) {
      await ctx.answerCbQuery("Гайд не найден", { show_alert: true });
      return;
    }
    const userId = ctx.from?.id;
    const subscribed = await isUserSubscribed(ctx, userId);
    if (!subscribed) {
      await ctx.answerCbQuery(undefined);
      await ctx.reply(GUIDE_NOT_FOUND_SUBSCRIPTION, {
        ...Markup.inlineKeyboard([
          [subscribeButton, checkSubscriptionButton(guide)],
        ]),
      });
      return;
    }
    const filePath = getGuideFileAbsolutePath(guide.file);
    if (!fs.existsSync(filePath)) {
      await ctx.answerCbQuery("Файл гайда не найден на сервере", {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery("Проверяю подписку…");
    await ctx.reply(THANKS_TEXT, {
      ...buildMenuKeyboard(),
      parse_mode: "HTML",
    });
    await ctx.replyWithDocument({
      source: fs.createReadStream(filePath),
      filename: path.basename(filePath),
    });
    return;
  }
  await ctx.answerCbQuery();
});

bot.catch((err, ctx) => {
  console.error("Bot error", err);
  if (ctx?.answerCbQuery) {
    try {
      ctx.answerCbQuery("Ошибка. Попробуйте позже.", { show_alert: true });
    } catch {}
  }
});

bot.launch().then(async () => {
  // Set available commands in the menu
  try {
    await bot.telegram.setMyCommands([
      { command: "price", description: "Цены" },
      { command: "about-me", description: "Обо мне" },
    ]);
  } catch (e) {
    console.error("Failed to set bot commands", e);
  }
  console.log("Bot started.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
