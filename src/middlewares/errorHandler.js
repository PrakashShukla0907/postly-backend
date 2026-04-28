// Global error handler middleware
import logger from "../utils/logger.js";
import { errorResponse } from "../utils/response.js";

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} → ${err.message}`, { stack: err.stack });

  // Prisma known errors
  if (err.code === "P2002") {
    return res.status(409).json(
      errorResponse("CONFLICT", "Resource already exists", [
        { field: err.meta?.target, message: "Must be unique" },
      ])
    );
  }
  if (err.code === "P2025") {
    return res.status(404).json(errorResponse("NOT_FOUND", "Resource not found"));
  }

  // Validation errors from Joi
  if (err.isJoi) {
    return res.status(400).json(
      errorResponse(
        "VALIDATION_ERROR",
        "Invalid input data",
        err.details.map((d) => ({ field: d.context?.key, message: d.message }))
      )
    );
  }

  // Custom app errors
  if (err.statusCode) {
    return res.status(err.statusCode).json(
      errorResponse(err.code || "APP_ERROR", err.message)
    );
  }

  // Fallback 500
  return res.status(500).json(
    errorResponse(
      "INTERNAL_ERROR",
      process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message
    )
  );
}

// Helper to create app errors with status codes
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "APP_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
