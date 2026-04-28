// Auth Service - register, login, refresh, logout, me
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../database/index.js";
import { AppError } from "../middlewares/errorHandler.js";

const BCRYPT_ROUNDS = 12;

function generateAccessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || "15m",
  });
}

function generateRefreshToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d",
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function register(email, password, name) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email already registered", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  const decodedRefresh = jwt.decode(refreshToken);
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(decodedRefresh.exp * 1000),
    },
  });

  return { user, access_token: accessToken, refresh_token: refreshToken };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    throw new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS");
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  const decodedRefresh = jwt.decode(refreshToken);
  const tokenHash = hashToken(refreshToken);

  // Delete any existing tokens for this user to avoid unique constraint violations
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(decodedRefresh.exp * 1000),
    },
  });

  return { access_token: accessToken, refresh_token: refreshToken };
}

export async function refresh(oldRefreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(
      "Invalid or expired refresh token",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(oldRefreshToken) },
  });

  if (
    !tokenRecord ||
    tokenRecord.revokedAt ||
    tokenRecord.expiresAt < new Date()
  ) {
    throw new AppError(
      "Refresh token revoked or expired",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  }

  // Revoke old token (rotation)
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  const newAccessToken = generateAccessToken(decoded.sub);
  const newRefreshToken = generateRefreshToken(decoded.sub);
  const newDecoded = jwt.decode(newRefreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: decoded.sub,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(newDecoded.exp * 1000),
    },
  });

  return { access_token: newAccessToken, refresh_token: newRefreshToken };
}

export async function logout(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      defaultTone: true,
      defaultLanguage: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return user;
}
