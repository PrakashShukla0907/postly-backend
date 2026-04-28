// Main router - mount all sub-routers
import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./user.js";
import contentRoutes from "./content.js";
import postRoutes from "./posts.js";
import dashboardRoutes from "./dashboard.js";
import telegramRoutes from "./telegram.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/content", contentRoutes);
router.use("/posts", postRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/telegram", telegramRoutes);

export default router;
