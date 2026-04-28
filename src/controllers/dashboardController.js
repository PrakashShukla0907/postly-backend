// Dashboard Controller
import { getStats } from "../services/dashboardService.js";
import { successResponse } from "../utils/response.js";

export async function stats(req, res, next) {
  try {
    const data = await getStats(req.user.sub);
    res.json(successResponse({ stats: data }));
  } catch (err) {
    next(err);
  }
}
