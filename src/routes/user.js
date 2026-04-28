// User routes: /api/user/*
import { Router } from "express";
import { validate, schemas, authenticate } from "../middlewares/index.js";
import * as userController from "../controllers/userController.js";

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET  /api/user/profile
router.get("/profile", userController.getProfile);

// PUT  /api/user/profile
router.put("/profile", validate(schemas.updateProfile), userController.updateProfile);

// POST /api/user/social-accounts
router.post("/social-accounts", validate(schemas.connectSocialAccount), userController.connectSocialAccount);

// GET  /api/user/social-accounts
router.get("/social-accounts", userController.listSocialAccounts);

// DELETE /api/user/social-accounts/:id
router.delete("/social-accounts/:id", userController.disconnectSocialAccount);

// PUT  /api/user/ai-keys
router.put("/ai-keys", validate(schemas.storeAiKeys), userController.storeAiKeys);

export default router;
