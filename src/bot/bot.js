// Telegram Bot - grammy-based stateful conversation
// Stores conversation state in Redis (keyed by chat ID), expires after 30 min
import { Bot, session, InlineKeyboard } from "grammy";
import logger from "../utils/logger.js";
import prisma from "../database/index.js";
import { generateContent } from "../services/contentService.js";
import { publishPost } from "../services/publishService.js";

let bot = null;

// Returns the already-initialized singleton bot instance
export function getBot() {
  return bot;
}

// ── Redis Session Storage ─────────────────────────────────────────────────────
function createRedisSessionStorage(redis) {
  if (!redis) {
    // Fallback to in-memory sessions
    const store = new Map();
    return {
      read: async (key) => store.get(key) ?? undefined,
      write: async (key, value) => store.set(key, value),
      delete: async (key) => store.delete(key),
    };
  }

  const TTL = 30 * 60; // 30 minutes in seconds
  return {
    read: async (key) => {
      try {
        const raw = await redis.get(`postly:session:${key}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    write: async (key, value) => {
      try {
        await redis.set(`postly:session:${key}`, JSON.stringify(value), "EX", TTL);
      } catch {
        // ignore
      }
    },
    delete: async (key) => {
      try {
        await redis.del(`postly:session:${key}`);
      } catch {
        // ignore
      }
    },
  };
}

// ── Keyboard helpers ──────────────────────────────────────────────────────────
function postTypeKeyboard() {
  return new InlineKeyboard()
    .text("📢 Announcement", "type:announcement").text("🧵 Thread", "type:thread").row()
    .text("📖 Story", "type:story").text("🎯 Promotional", "type:promotional").row()
    .text("🎓 Educational", "type:educational").text("💬 Opinion", "type:opinion");
}

function platformKeyboard(selected = []) {
  const mark = (p) => (selected.includes(p) ? "✅ " : "");
  return new InlineKeyboard()
    .text(`${mark("twitter")}Twitter/X`, "plat:twitter").text(`${mark("linkedin")}LinkedIn`, "plat:linkedin").row()
    .text(`${mark("instagram")}Instagram`, "plat:instagram").text(`${mark("threads")}Threads`, "plat:threads").row()
    .text("🌐 All Platforms", "plat:all").row()
    .text("➡️ Continue", "plat:done");
}

function toneKeyboard() {
  return new InlineKeyboard()
    .text("🎨 Creative", "tone:creative").text("💼 Professional", "tone:professional").row()
    .text("😏 Sarcastic", "tone:sarcastic").text("😄 Humorous", "tone:humorous").row()
    .text("ℹ️ Informative", "tone:informative").text("🤝 Friendly", "tone:friendly");
}

function modelKeyboard() {
  return new InlineKeyboard()
    .text("🤖 GPT-4o (OpenAI)", "model:openai").row()
    .text("🧠 Claude Sonnet (Anthropic)", "model:anthropic");
}

function confirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Yes, Post Now", "confirm:yes").row()
    .text("✏️ Edit Idea", "confirm:edit").row()
    .text("❌ Cancel", "confirm:cancel");
}

// ── Resolve a Telegram user to a Postly user ─────────────────────────────────
async function resolveUser(telegramId) {
  try {
    const mapping = await prisma.telegramChatMapping.findUnique({
      where: { telegramChatId: String(telegramId) },
      include: { user: true },
    });
    return mapping?.user ?? null;
  } catch {
    return null;
  }
}

// ── Format generated content preview ─────────────────────────────────────────
function formatPreview(generated) {
  let text = "📝 *Content Preview:*\n\n";
  for (const [platform, data] of Object.entries(generated)) {
    const icon = { twitter: "🐦", linkedin: "💼", instagram: "📸", threads: "🧵" }[platform] || "📌";
    text += `${icon} *${platform.charAt(0).toUpperCase() + platform.slice(1)}* (${data.char_count} chars):\n`;
    text += `${data.content}\n`;
    if (data.hashtags?.length) {
      text += `_${data.hashtags.join(" ")}_\n`;
    }
    text += "\n";
  }
  return text;
}

// ── Create bot instance ───────────────────────────────────────────────────────
export function createBot(redisClient = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return null;
  }

  bot = new Bot(token);

  // Session middleware with Redis storage
  const storage = createRedisSessionStorage(redisClient);
  bot.use(
    session({
      initial: () => ({ step: null, data: {} }),
      storage,
    })
  );

  // ── /start command ────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    const name = ctx.from?.first_name || "there";

    // Check if user already linked
    const user = await resolveUser(telegramId);

    if (user) {
      ctx.session.step = "post_type";
      ctx.session.data = { userId: user.id, userName: user.name };

      await ctx.reply(
        `Hey *${user.name}*! 👋 What type of post is this?`,
        { parse_mode: "Markdown", reply_markup: postTypeKeyboard() }
      );
    } else {
      const linkUrl = `${process.env.FRONTEND_URL || process.env.API_BASE_URL || "https://postly.app"}/auth/telegram?chat_id=${telegramId}`;
      const keyboard = new InlineKeyboard().url("🔗 Link My Account", linkUrl);

      await ctx.reply(
        `👋 Hello, *${name}*! Welcome to *Postly* — your AI-powered social media publishing engine.\n\n` +
        "To get started, link your Postly account:",
        { parse_mode: "Markdown", reply_markup: keyboard }
      );
    }
  });

  // ── /help command ─────────────────────────────────────────────────────────
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📖 *Postly Bot Help*\n\n" +
      "/start — Welcome message & account linking\n" +
      "/post — Create a new AI-generated post\n" +
      "/status — See your last 5 posts\n" +
      "/accounts — View connected social accounts\n" +
      "/cancel — Cancel current action\n" +
      "/help — Show this message",
      { parse_mode: "Markdown" }
    );
  });

  // ── /cancel command ───────────────────────────────────────────────────────
  bot.command("cancel", async (ctx) => {
    ctx.session.step = null;
    ctx.session.data = {};
    await ctx.reply("❌ Action cancelled. Use /post to start a new post.");
  });

  // ── /status command ───────────────────────────────────────────────────────
  bot.command("status", async (ctx) => {
    const user = await resolveUser(ctx.from?.id);
    if (!user) {
      return ctx.reply("⚠️ Please link your account first using /start");
    }

    try {
      const posts = await prisma.post.findMany({
        where: { userId: user.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { platformPosts: { select: { platform: true, status: true } } },
      });

      if (!posts.length) {
        return ctx.reply("📭 No posts yet. Use /post to create your first post!");
      }

      let text = "📊 *Your Recent Posts:*\n\n";
      for (const post of posts) {
        const statusIcon = {
          published: "✅", failed: "❌", queued: "⏳", publishing: "🔄",
          partial: "⚠️", cancelled: "🚫", scheduled: "🗓️",
        }[post.status] || "❓";

        text += `${statusIcon} *${post.postType}* — ${post.tone}\n`;
        text += `   _${post.idea.slice(0, 60)}${post.idea.length > 60 ? "..." : ""}_\n`;
        text += `   ${post.platformPosts.map(p => `${p.platform}: ${p.status}`).join(" | ")}\n\n`;
      }

      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`Bot /status error: ${err.message}`);
      await ctx.reply("⚠️ Could not fetch your posts. Please try again later.");
    }
  });

  // ── /accounts command ─────────────────────────────────────────────────────
  bot.command("accounts", async (ctx) => {
    const user = await resolveUser(ctx.from?.id);
    if (!user) {
      return ctx.reply("⚠️ Please link your account first using /start");
    }

    try {
      const accounts = await prisma.socialAccount.findMany({
        where: { userId: user.id, disconnectedAt: null },
        select: { platform: true, handle: true, connectedAt: true },
      });

      if (!accounts.length) {
        return ctx.reply(
          "🔗 No social accounts connected yet.\n\n" +
          "Connect accounts via the API:\n`POST /api/user/social-accounts`",
          { parse_mode: "Markdown" }
        );
      }

      const icons = { twitter: "🐦", linkedin: "💼", instagram: "📸", threads: "🧵" };
      let text = "🔗 *Connected Social Accounts:*\n\n";
      for (const acc of accounts) {
        text += `${icons[acc.platform] || "📌"} *${acc.platform}*: @${acc.handle}\n`;
      }
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`Bot /accounts error: ${err.message}`);
      await ctx.reply("⚠️ Could not fetch accounts.");
    }
  });

  // ── /post command — start multi-step flow ─────────────────────────────────
  bot.command("post", async (ctx) => {
    const user = await resolveUser(ctx.from?.id);
    if (!user) {
      return ctx.reply("⚠️ Please link your Postly account first using /start");
    }

    ctx.session.step = "post_type";
    ctx.session.data = { userId: user.id, userName: user.name };

    await ctx.reply(
      `Hey *${user.name}*! 🚀 Let's create a post.\n\nWhat type of post is this?`,
      { parse_mode: "Markdown", reply_markup: postTypeKeyboard() }
    );
  });

  // ── Callback query handler ────────────────────────────────────────────────
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const step = ctx.session.step;

    // ── Step 1: Post type selection ────────────────────────────────────────
    if (data.startsWith("type:") && step === "post_type") {
      const postType = data.split(":")[1];
      ctx.session.data.postType = postType;
      ctx.session.step = "platforms";
      ctx.session.data.platforms = [];

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `✅ Post type: *${postType}*\n\nWhich platforms should I post to? (tap to select, then tap Continue)`,
        { parse_mode: "Markdown", reply_markup: platformKeyboard([]) }
      );
      return;
    }

    // ── Step 2: Platform selection ─────────────────────────────────────────
    if (data.startsWith("plat:") && step === "platforms") {
      const platform = data.split(":")[1];

      if (platform === "all") {
        ctx.session.data.platforms = ["twitter", "linkedin", "instagram", "threads"];
        await ctx.answerCallbackQuery("All platforms selected!");
        await ctx.editMessageText(
          "Which platforms should I post to? (tap to select, then tap Continue)",
          { reply_markup: platformKeyboard(ctx.session.data.platforms) }
        );
        return;
      }

      if (platform === "done") {
        if (!ctx.session.data.platforms?.length) {
          await ctx.answerCallbackQuery("⚠️ Please select at least one platform!", { show_alert: true });
          return;
        }
        ctx.session.step = "tone";
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `✅ Platforms: *${ctx.session.data.platforms.join(", ")}*\n\nWhat tone should the content have?`,
          { parse_mode: "Markdown", reply_markup: toneKeyboard() }
        );
        return;
      }

      // Toggle platform
      const platforms = ctx.session.data.platforms || [];
      const idx = platforms.indexOf(platform);
      if (idx === -1) {
        platforms.push(platform);
      } else {
        platforms.splice(idx, 1);
      }
      ctx.session.data.platforms = platforms;

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "Which platforms should I post to? (tap to select, then tap Continue)",
        { reply_markup: platformKeyboard(platforms) }
      );
      return;
    }

    // ── Step 3: Tone selection ─────────────────────────────────────────────
    if (data.startsWith("tone:") && step === "tone") {
      const tone = data.split(":")[1];
      ctx.session.data.tone = tone;
      ctx.session.step = "model";

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `✅ Tone: *${tone}*\n\nWhich AI model do you want to use?`,
        { parse_mode: "Markdown", reply_markup: modelKeyboard() }
      );
      return;
    }

    // ── Step 4: Model selection ────────────────────────────────────────────
    if (data.startsWith("model:") && step === "model") {
      const model = data.split(":")[1];
      ctx.session.data.model = model;
      ctx.session.step = "idea";

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        `✅ AI Model: *${model === "openai" ? "GPT-4o (OpenAI)" : "Claude Sonnet (Anthropic)"}*\n\n` +
        "Tell me the idea or core message — keep it brief (max 500 characters).",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // ── Confirm: post ──────────────────────────────────────────────────────
    if (data === "confirm:yes" && step === "confirm") {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("📤 Publishing your post...");

      try {
        const { data: sd } = ctx.session;
        await publishPost(sd.userId, {
          idea: sd.idea,
          post_type: sd.postType,
          platforms: sd.platforms,
          tone: sd.tone,
          language: "en",
          model: sd.model,
        });

        ctx.session.step = null;
        ctx.session.data = {};

        await ctx.editMessageText(
          "🎉 *Post queued for publishing!*\n\nUse /status to track progress on each platform.",
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        logger.error(`Bot publish error: ${err.message}`);
        await ctx.editMessageText(
          `❌ Failed to publish: ${err.message}\n\nPlease try again with /post`
        );
        ctx.session.step = null;
        ctx.session.data = {};
      }
      return;
    }

    // ── Confirm: edit idea ─────────────────────────────────────────────────
    if (data === "confirm:edit" && step === "confirm") {
      ctx.session.step = "idea";
      ctx.session.data.generated = null;
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("✏️ Okay, tell me the updated idea (max 500 characters):");
      return;
    }

    // ── Confirm: cancel ────────────────────────────────────────────────────
    if (data === "confirm:cancel") {
      ctx.session.step = null;
      ctx.session.data = {};
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("❌ Post cancelled. Use /post to start again.");
      return;
    }

    await ctx.answerCallbackQuery();
  });

  // ── Text message handler — captures the user's idea ──────────────────────
  bot.on("message:text", async (ctx) => {
    const step = ctx.session.step;

    if (step !== "idea") return; // Only handle text in idea step

    const idea = ctx.message.text.trim();
    if (idea.length > 500) {
      return ctx.reply("⚠️ Your idea is too long (max 500 characters). Please shorten it.");
    }

    ctx.session.data.idea = idea;
    ctx.session.step = "generating";

    const thinkingMsg = await ctx.reply("⚙️ Generating your content...");

    try {
      const { data: sd } = ctx.session;
      const result = await generateContent(sd.userId, {
        idea,
        post_type: sd.postType,
        platforms: sd.platforms,
        tone: sd.tone,
        language: "en",
        model: sd.model,
      });

      ctx.session.data.generated = result.generated;
      ctx.session.step = "confirm";

      const preview = formatPreview(result.generated);
      const modelLabel = result.model_used;
      const previewText =
        preview +
        `🤖 Model: \`${modelLabel}\` | Tokens: ${result.tokens_used}\n\n*Confirm and post?*`;

      await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});
      await ctx.reply(previewText, {
        parse_mode: "Markdown",
        reply_markup: confirmKeyboard(),
      });
    } catch (err) {
      logger.error(`Bot content generation error: ${err.message}`);
      await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});

      ctx.session.step = "idea";

      await ctx.reply(
        `❌ Content generation failed: ${err.message}\n\nPlease try again or use /cancel to abort.`
      );
    }
  });

  bot.catch((err) => {
    logger.error(`Bot error: ${err.message}`, { stack: err.error?.stack });
  });

  return bot;
}

// ── Start bot (polling mode for dev, webhook for prod) ────────────────────────
export async function startBot(redisClient = null) {
  const b = createBot(redisClient);
  if (!b) return;

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (webhookUrl) {
    // Webhook mode (production) — initialize bot info so handleUpdate works
    await b.init();
    logger.info(`Telegram bot using webhook: ${webhookUrl}`);
    return b;
  } else {
    // Polling mode (development)
    try {
      await b.start({
        onStart: (info) => logger.info(`Bot @${info.username} started (polling mode)`),
      });
    } catch (err) {
      logger.error(`Failed to start Telegram bot: ${err.message}`);
    }
  }

  return b;
}
