// JWT authentication middleware
import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/response.js";

/**
 * Verifies the Bearer token and sets req.user = { sub: userId, ... }
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json(errorResponse("UNAUTHORIZED", "Missing or malformed Authorization header"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json(errorResponse("TOKEN_EXPIRED", "Access token has expired"));
    }
    return res.status(401).json(errorResponse("INVALID_TOKEN", "Invalid access token"));
  }
}

/**
 * Verifies a refresh token (same JWT_REFRESH_SECRET)
 */
export function authenticateRefresh(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json(errorResponse("UNAUTHORIZED", "Missing refresh token"));
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    req.refreshToken = token;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json(errorResponse("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token"));
  }
}
