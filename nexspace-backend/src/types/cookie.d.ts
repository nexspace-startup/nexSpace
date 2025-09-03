declare module 'cookie' {
  interface CookieParseOptions {
    decode?(value: string): string;
  }

  interface CookieSerializeOptions {
    maxAge?: number;
    domain?: string;
    path?: string;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | 'lax' | 'strict' | 'none';
  }

  export function parse(
    str: string,
    options?: CookieParseOptions,
  ): Record<string, string>;
  export function serialize(
    name: string,
    val: string,
    options?: CookieSerializeOptions,
  ): string;
}
