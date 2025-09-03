declare module 'express-session' {
  import { RequestHandler } from 'express';

  interface CookieOptions {
    httpOnly?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
  }

  interface SessionOptions {
    secret: string;
    resave?: boolean;
    saveUninitialized?: boolean;
    cookie?: CookieOptions;
  }

  export default function session(options: SessionOptions): RequestHandler;
}
