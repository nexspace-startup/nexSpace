// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    interface Response {
      success<T = unknown>(data?: T, statusCode?: number): this;
      fail(errors?: unknown, statusCode?: number): this;
    }
  }
}

export {};
