// Auth Controller
import * as authService from "../services/authService.js";
import { successResponse } from "../utils/response.js";

export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await authService.refresh(req.refreshToken);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) await authService.logout(token);
    res.json(successResponse({ message: "Logged out successfully" }));
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await authService.me(req.user.sub);
    res.json(successResponse({ user }));
  } catch (err) {
    next(err);
  }
}
