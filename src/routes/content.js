// Content routes: /api/content/*
import { Router } from "express";
import { validate, schemas, authenticate } from "../middlewares/index.js";
import * as contentController from "../controllers/contentController.js";

const router = Router();

router.use(authenticate);

// POST /api/content/generate
router.post("/generate", validate(schemas.generateContent), contentController.generate);

export default router;
