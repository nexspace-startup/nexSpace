// src/middleware/response.ts
import type { Request, Response, NextFunction } from "express";

export function responseWrapper(_req: Request, res: Response, next: NextFunction) {
  res.success = function <T = any>(data?: T, statusCode = 200) {
    if (statusCode !== 200) res.status(statusCode);
    return res.json({ success: true, data: data ?? null, errors: [] });
  };

  res.fail = function (errors: any, statusCode = 400) {
    const errs = Array.isArray(errors) ? errors : [errors];
    return res.status(statusCode).json({ success: false, data: null, errors: errs });
  };

  next();
}
