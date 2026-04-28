// User Service - profile, social accounts, AI keys
import prisma from "../database/index.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import { AppError } from "../middlewares/errorHandler.js";

// ── Profile ──────────────────────────────────────────────

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, bio: true,
      defaultTone: true, defaultLanguage: true, createdAt: true,
    },
  });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return user;
}

export async function updateProfile(userId, data) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.default_tone && { defaultTone: data.default_tone }),
      ...(data.default_language && { defaultLanguage: data.default_language }),
    },
    select: {
      id: true, email: true, name: true, bio: true,
      defaultTone: true, defaultLanguage: true,
    },
  });
  return updated;
}

// ── Social Accounts ───────────────────────────────────────

export async function connectSocialAccount(userId, platform, handle, accessToken, refreshToken) {
  const accessTokenEnc = encrypt(accessToken);
  const refreshTokenEnc = refreshToken ? encrypt(refreshToken) : null;

  const account = await prisma.socialAccount.upsert({
    where: { userId_platform: { userId, platform } },
    update: {
      handle,
      accessTokenEnc,
      refreshTokenEnc,
      disconnectedAt: null,
      connectedAt: new Date(),
    },
    create: {
      userId,
      platform,
      handle,
      accessTokenEnc,
      refreshTokenEnc,
    },
    select: { id: true, platform: true, handle: true, connectedAt: true },
  });

  return account;
}

export async function listSocialAccounts(userId) {
  const accounts = await prisma.socialAccount.findMany({
    where: { userId, disconnectedAt: null },
    select: { id: true, platform: true, handle: true, connectedAt: true },
    orderBy: { connectedAt: "desc" },
  });
  return accounts;
}

export async function disconnectSocialAccount(userId, accountId) {
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) throw new AppError("Account not found", 404, "NOT_FOUND");

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { disconnectedAt: new Date() },
  });
}

// ── AI Keys ───────────────────────────────────────────────

export async function storeAiKeys(userId, openaiKey, anthropicKey) {
  const data = {};
  if (openaiKey) data.openaiKeyEnc = encrypt(openaiKey);
  if (anthropicKey) data.anthropicKeyEnc = encrypt(anthropicKey);

  await prisma.aiKey.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function getDecryptedAiKeys(userId) {
  const keys = await prisma.aiKey.findUnique({ where: { userId } });
  if (!keys) return { openai: null, anthropic: null };

  return {
    openai: keys.openaiKeyEnc ? decrypt(keys.openaiKeyEnc) : null,
    anthropic: keys.anthropicKeyEnc ? decrypt(keys.anthropicKeyEnc) : null,
  };
}
