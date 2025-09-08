// src/middleware/error.ts
import type { Request, Response, NextFunction } from "express";

/**
 * Unified application error type.
 * You can throw this from anywhere in your code to trigger a clean JSON response.
 */
export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * 404 handler for routes that are not found.
 * Must be added *before* the errorHandler in app.use()
 */
export function notFound(_req: Request, res: Response, _next: NextFunction) {
  return res.status(404).json({
    success: false,
    data: null,
    errors: [
      {
        message: "Route not found",
        code: "ROUTE_NOT_FOUND",
      },
    ],
  });
}

/**
 * Centralized error handler.
 * This should be the very last middleware in your stack.
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : "Internal server error";

  return res.status(status).json({
    success: false,
    data: null,
    errors: [
      {
        message,
        code: err.code ?? "INTERNAL_SERVER_ERROR",
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      },
    ],
  });
}
