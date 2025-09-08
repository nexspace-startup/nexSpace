import type { Request, Response, NextFunction } from "express";

/** Wrap any async route/middleware so rejections go to errorHandler */
export const asyncHandler =
  <T extends (req: Request, res: Response, next: NextFunction) => Promise<any>>(fn: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
