import { Telegraf, Markup } from "telegraf";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. @your_channel or -1001234567890
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

function formatGuideItem(guide) {
  const title = guide.title || "Без названия";
  const description = guide.description ? ` — ${guide.description}` : "";
  return `• ${title}${description}`;
}

function buildGuidesKeyboard(guides) {
  const buttons = guides.map((g) =>
    Markup.button.callback(g.title, `open:${g.slug}`),
  );
  // Arrange buttons in one per row
  const rows = buttons.map((b) => [b]);
  return Markup.inlineKeyboard(rows);
}

function buildMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Меню", "menu:price")],
    [Markup.button.callback("Получить подарок 🎁", "menu:guides")],
    [Markup.button.callback("Обо мне", "menu:about-me")],
  ]);
}

function buildGuideActionKeyboard(guide) {
  return Markup.inlineKeyboard([
    [
      Markup.button.url("Подписаться", CHANNEL_URL),
      Markup.button.callback("Проверить подписку", `dl:${guide.slug}`),
    ],
  ]);
}

async function respondWithText(ctx, text, extra = {}) {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (err) {
      // fall back to sending a new message
    }
  }
  await ctx.reply(text, extra);
}

async function sendPrice(ctx) {
  const PRICE_TEXT =
    "💬 Форматы работы:\n" +
    "\n" +
    "1️⃣ Консультация до 1 часа + рекомендации на месяц \n" +
    "\n" +
    "Что входит:\n" +
    "- индивидуальный разбор твоего текущего питания;\n" +
    "- рекомендации по улучшению питания;\n" +
    "- интерпретация имеющихся анализов;\n" +
    "- при необходимости подберу для тебя БАДы;\n" +
    "- составлю индивидуальный примерный рацион питания;\n" +
    "- составлю план действий для улучшения имеющихся проблем и симптомов.\n" +
    "💵 Стоимость: 3000 руб.\n" +
    "🎁 в подарок ты получишь конструктор здоровой тарелки питания! \n" +
    "\n" +
    "2️⃣ Сопровождение на 1 месяц \n" +
    "\n" +
    "Что входит:\n" +
    "- индивидуальный разбор твоего текущего питания;\n" +
    "- рекомендации по улучшению питания;\n" +
    "- интерпретация имеющихся анализов;\n" +
    "- при необходимости подберу для тебя БАДы;\n" +
    "- составлю индивидуальный примерный рацион питания;\n" +
    "- составлю план действий для улучшения имеющихся проблем и симптомов.\n" +
    "- еженедельная обратная связь по итогам пройденной недели, корректировки и мотивация, возможность задавать вопросы. \n" +
    "💵 Стоимость: 7000 руб.\n" +
    "🎁 в подарок ты получишь конструктор здоровой тарелки питания! \n" +
    "\n" +
    "🔥 При записи на консультацию в течении сегодняшнего дня сделаю скидку 1000 руб.\n" +
    "\n" +
    "Буду Рада помочь решить тебе свою давнюю проблему! 😇 Я за осознанный подход к питанию, без диет и без крайностей.\n";

  await respondWithText(ctx, PRICE_TEXT, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback("Записаться на консультацию", "show_main_menu")],
      [Markup.button.callback("Вернуться в меню", "show_main_menu")],
    ]),
    parse_mode: "HTML",
  });
}

async function sendGuides(ctx) {
  const guides = loadGuides();
  if (guides.length === 0) {
    await respondWithText(ctx, "Пока нет доступных гайдов.", {
      ...buildMainMenuKeyboard(),
    });
    return;
  }
  const listText = ["Список бесплатных гайдов:", ""]
    .concat(guides.map((g) => formatGuideItem(g)))
    .join("\n");
  await respondWithText(ctx, listText, {
    ...buildGuidesKeyboard(guides),
  });
}

const MAIN_MENU_TEXT = [
  "📋 Главное меню",
  "",
  "Доступные команды:",
  "/price — Цены и форматы работы",
  "/guides — Получить подарок 🎁",
  "",
  "Выбирай нужную кнопку ниже:",
].join("\n");

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
        ...buildGuideActionKeyboard(guide),
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
    await respondWithText(ctx, MAIN_MENU_TEXT, {
      ...buildMainMenuKeyboard(),
      parse_mode: "HTML",
    });
    return;
  }
  if (data === "menu:price") {
    await ctx.answerCbQuery();
    await sendPrice(ctx);
    return;
  }
  if (data === "menu:guides") {
    await ctx.answerCbQuery();
    await sendGuides(ctx);
    return;
  }
  // open:<slug> — show the guide info with action
  if (data.startsWith("open:")) {
    const slug = data.slice("open:".length);
    const guide = findGuideBySlug(slug);
    if (!guide) {
      await ctx.answerCbQuery("Гайд не найден", { show_alert: true });
      return;
    }
    const text = ["111111"].join("\n");
    await ctx.editMessageText(text, {
      ...buildMenuKeyboard(),
      parse_mode: "HTML",
    });
    await ctx.answerCbQuery();
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
      await ctx.reply(
        [
          "Похоже, вы не подписаны на наш канал.",
          "Подпишитесь и снова нажмите кнопку:",
          String(CHANNEL_ID).startsWith("@")
            ? CHANNEL_URL
            : "Откройте канал в Telegram",
        ].join("\n"),
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
    await ctx.answerCbQuery("Отправляю файл…");
    await ctx.replyWithDocument(
      {
        source: fs.createReadStream(filePath),
        filename: path.basename(filePath),
      },
      { caption: guide.title },
    );

    const thanksText = [
      "Спасибо за подписку!",
      "Твой подарок ниже 🎁",
      "Надеюсь гайд и мой телеграм канал будут тебе полезны 😊",
    ].join("\n");
    await ctx.editMessageText(thanksText, {
      ...buildMenuKeyboard(),
      parse_mode: "HTML",
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
      { command: "guides", description: "Получить подарок 🎁" },
    ]);
  } catch (e) {
    console.error("Failed to set bot commands", e);
  }
  console.log("Bot started.");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
