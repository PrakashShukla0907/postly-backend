// Post routes: /api/posts/*
import { Router } from "express";
import { validate, schemas, authenticate } from "../middlewares/index.js";
import * as postController from "../controllers/postController.js";

const router = Router();

router.use(authenticate);

// POST /api/posts/publish
router.post("/publish", validate(schemas.publishPost), postController.publish);

// POST /api/posts/schedule
router.post("/schedule", validate(schemas.schedulePost), postController.schedule);

// GET  /api/posts
router.get("/", postController.listPosts);

// GET  /api/posts/:id
router.get("/:id", postController.getPost);

// POST /api/posts/:id/retry
router.post("/:id/retry", postController.retryPost);

// DELETE /api/posts/:id
router.delete("/:id", postController.cancelPost);

export default router;
