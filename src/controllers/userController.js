// User Controller - profile, social accounts, AI keys
import * as userService from "../services/userService.js";
import { successResponse } from "../utils/response.js";

export async function getProfile(req, res, next) {
  try {
    const user = await userService.getProfile(req.user.sub);
    res.json(successResponse({ user }));
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await userService.updateProfile(req.user.sub, req.body);
    res.json(successResponse({ user }));
  } catch (err) {
    next(err);
  }
}

export async function connectSocialAccount(req, res, next) {
  try {
    const { platform, handle, access_token, refresh_token } = req.body;
    const account = await userService.connectSocialAccount(
      req.user.sub, platform, handle, access_token, refresh_token
    );
    res.status(201).json(successResponse({ account }));
  } catch (err) {
    next(err);
  }
}

export async function listSocialAccounts(req, res, next) {
  try {
    const accounts = await userService.listSocialAccounts(req.user.sub);
    res.json(successResponse({ accounts }, { total: accounts.length }));
  } catch (err) {
    next(err);
  }
}

export async function disconnectSocialAccount(req, res, next) {
  try {
    await userService.disconnectSocialAccount(req.user.sub, req.params.id);
    res.json(successResponse({ message: "Account disconnected" }));
  } catch (err) {
    next(err);
  }
}

export async function storeAiKeys(req, res, next) {
  try {
    const { openai_key, anthropic_key } = req.body;
    await userService.storeAiKeys(req.user.sub, openai_key, anthropic_key);
    res.json(successResponse({ message: "API keys stored securely" }));
  } catch (err) {
    next(err);
  }
}
