// Content Controller - AI content generation
import { generateContent } from "../services/contentService.js";
import { successResponse } from "../utils/response.js";

export async function generate(req, res, next) {
  try {
    const result = await generateContent(req.user.sub, req.body);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
}
