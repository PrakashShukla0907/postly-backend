// Post Controller - publish, schedule, list, get, retry, cancel
import * as publishService from "../services/publishService.js";
import { successResponse, paginatedResponse } from "../utils/response.js";

export async function publish(req, res, next) {
  try {
    const { post, platformStatuses } = await publishService.publishPost(req.user.sub, req.body);
    res.status(201).json(successResponse({
      post: { id: post.id, status: post.status, created_at: post.createdAt },
      platform_statuses: platformStatuses,
    }));
  } catch (err) {
    next(err);
  }
}

export async function schedule(req, res, next) {
  try {
    const { post, platformStatuses } = await publishService.schedulePost(req.user.sub, req.body);
    res.status(201).json(successResponse({
      post: {
        id: post.id,
        status: post.status,
        publish_at: post.publishAt,
        created_at: post.createdAt,
      },
      platform_statuses: platformStatuses,
    }));
  } catch (err) {
    next(err);
  }
}

export async function listPosts(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const { status, platform, date_range } = req.query;

    const { posts, total } = await publishService.listPosts(req.user.sub, {
      page, limit, status, platform, date_range,
    });

    res.json(paginatedResponse(posts, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getPost(req, res, next) {
  try {
    const post = await publishService.getPost(req.user.sub, req.params.id);
    res.json(successResponse({ post }));
  } catch (err) {
    next(err);
  }
}

export async function retryPost(req, res, next) {
  try {
    const platforms = await publishService.retryPost(req.user.sub, req.params.id);
    res.json(successResponse({
      message: "Retry queued for failed platforms",
      platforms_retrying: platforms,
    }));
  } catch (err) {
    next(err);
  }
}

export async function cancelPost(req, res, next) {
  try {
    await publishService.cancelPost(req.user.sub, req.params.id);
    res.json(successResponse({ message: "Post cancelled" }));
  } catch (err) {
    next(err);
  }
}
