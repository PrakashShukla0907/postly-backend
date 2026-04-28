// Dashboard routes: /api/dashboard/*
import { Router } from "express";
import { authenticate } from "../middlewares/index.js";
import * as dashboardController from "../controllers/dashboardController.js";

const router = Router();

router.use(authenticate);

// GET /api/dashboard/stats
router.get("/stats", dashboardController.stats);

export default router;
