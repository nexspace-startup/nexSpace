// src/types/express.d.ts
import "express";
import type { SessionData, Provider } from "../session.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sid: string;
        session: SessionData;
        userId?: string;
        sub?: string;
        email?: string;
        provider?: Provider;
      };
    }
    interface Response {
      success<T = unknown>(data?: T, statusCode?: number): this;
      fail(errors?: unknown, statusCode?: number): this;
    }
  }
}

export {};
