// Auth routes: /api/auth/*
import { Router } from "express";
import { validate, schemas, authenticate, authenticateRefresh } from "../middlewares/index.js";
import * as authController from "../controllers/authController.js";

const router = Router();

// POST /api/auth/register
router.post("/register", validate(schemas.register), authController.register);

// POST /api/auth/login
router.post("/login", validate(schemas.login), authController.login);

// POST /api/auth/refresh  (requires refresh token in Authorization header)
router.post("/refresh", authenticateRefresh, authController.refresh);

// POST /api/auth/logout
router.post("/logout", authenticate, authController.logout);

// GET /api/auth/me
router.get("/me", authenticate, authController.me);

export default router;
