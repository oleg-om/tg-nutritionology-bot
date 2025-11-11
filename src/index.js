import { Telegraf, Markup } from 'telegraf';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // e.g. @your_channel or -1001234567890
const PRICE_TEXT = process.env.PRICE_TEXT || 'Актуальная стоимость: 990₽';
const BASE_DIR = path.resolve(process.cwd());
const GUIDES_PATH = path.join(BASE_DIR, 'src', 'guides.json');
const FILES_DIR = path.join(BASE_DIR, 'storage', 'guides');

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is not set. Please configure .env');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('CHANNEL_ID is not set. Please configure .env (e.g. @your_channel or -100...)');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

function loadGuides() {
  try {
    const raw = fs.readFileSync(GUIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    console.error('Failed to load guides.json', e);
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
  return status === 'member' || status === 'administrator' || status === 'creator';
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
  const title = guide.title || 'Без названия';
  const description = guide.description ? ` — ${guide.description}` : '';
  return `• ${title}${description}`;
}

function buildGuidesKeyboard(guides) {
  const buttons = guides.map((g) =>
    Markup.button.callback(g.title, `open:${g.slug}`)
  );
  // Arrange buttons in one per row
  const rows = buttons.map((b) => [b]);
  return Markup.inlineKeyboard(rows);
}

function buildGuideActionKeyboard(guide) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Проверить подписку и скачать', `dl:${guide.slug}`)
    ]
  ]);
}

bot.start(async (ctx) => {
  const payload = (ctx.startPayload || '').trim();
  if (payload) {
    const guide = findGuideBySlug(payload);
    if (guide) {
      await ctx.reply(
        `Гайд: ${guide.title}\n${guide.description || ''}\n\nНажмите кнопку ниже для проверки подписки и скачивания.`,
        buildGuideActionKeyboard(guide)
      );
      return;
    }
  }
  await ctx.reply(
    [
      'Привет! Я бот по нутрициологии.',
      'Доступные команды:',
      '/price — показать стоимость',
      '/guides — список бесплатных гайдов',
    ].join('\n')
  );
});

bot.command('price', async (ctx) => {
  await ctx.reply(PRICE_TEXT);
});

bot.command('guides', async (ctx) => {
  const guides = loadGuides();
  if (guides.length === 0) {
    await ctx.reply('Пока нет доступных гайдов.');
    return;
  }
  const listText = ['Список бесплатных гайдов:', ''].concat(
    guides.map((g) => formatGuideItem(g))
  ).join('\n');
  await ctx.reply(listText, buildGuidesKeyboard(guides));
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  // open:<slug> — show the guide info with action
  if (data.startsWith('open:')) {
    const slug = data.slice('open:'.length);
    const guide = findGuideBySlug(slug);
    if (!guide) {
      await ctx.answerCbQuery('Гайд не найден', { show_alert: true });
      return;
    }
    await ctx.editMessageText(
      `Гайд: ${guide.title}\n${guide.description || ''}\n\nНажмите кнопку ниже для проверки подписки и скачивания.`,
      buildGuideActionKeyboard(guide)
    );
    await ctx.answerCbQuery();
    return;
  }
  // dl:<slug> — verify subscription and send file
  if (data.startsWith('dl:')) {
    const slug = data.slice('dl:'.length);
    const guide = findGuideBySlug(slug);
    if (!guide) {
      await ctx.answerCbQuery('Гайд не найден', { show_alert: true });
      return;
    }
    const userId = ctx.from?.id;
    const subscribed = await isUserSubscribed(ctx, userId);
    if (!subscribed) {
      await ctx.answerCbQuery(undefined);
      await ctx.reply(
        [
          'Похоже, вы не подписаны на наш канал.',
          'Подпишитесь и снова нажмите кнопку:',
          String(CHANNEL_ID).startsWith('@') ? `https://t.me/${String(CHANNEL_ID).replace('@','')}` : 'Откройте канал в Telegram',
        ].join('\n')
      );
      return;
    }
    const filePath = getGuideFileAbsolutePath(guide.file);
    if (!fs.existsSync(filePath)) {
      await ctx.answerCbQuery('Файл гайда не найден на сервере', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery('Отправляю файл…');
    await ctx.replyWithDocument(
      { source: fs.createReadStream(filePath), filename: path.basename(filePath) },
      { caption: guide.title }
    );
    return;
  }
  await ctx.answerCbQuery();
});

bot.catch((err, ctx) => {
  console.error('Bot error', err);
  if (ctx?.answerCbQuery) {
    try { ctx.answerCbQuery('Ошибка. Попробуйте позже.', { show_alert: true }); } catch {}
  }
});

bot.launch().then(async () => {
  // Set available commands in the menu
  try {
    await bot.telegram.setMyCommands([
      { command: 'price', description: 'Показать стоимость' },
      { command: 'guides', description: 'Список бесплатных гайдов' }
    ]);
  } catch (e) {
    console.error('Failed to set bot commands', e);
  }
  console.log('Bot started.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


