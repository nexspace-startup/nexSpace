declare module 'express' {
  export interface Request<P = any, ResBody = any, ReqBody = any> {
    params: P;
    body: ReqBody;
    headers: Record<string, string | undefined>;
  }

  export interface Response<ResBody = any> {
    json(body: ResBody): this;
    status(code: number): this;
    send(body: any): this;
    end(): void;
    setHeader(name: string, value: string): void;
  }

  export type NextFunction = (err?: any) => void;
  export type RequestHandler<P = any, ResBody = any, ReqBody = any> = (
    req: Request<P, ResBody, ReqBody>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => any;

  export interface Router {
    get(path: string, ...handlers: RequestHandler[]): Router;
    post(path: string, ...handlers: RequestHandler[]): Router;
    use(...args: any[]): Router;
  }

  export interface Application extends Router {
    listen(port: number, cb?: () => void): void;
  }

  export function Router(): Router;
  export function json(): RequestHandler;
  export default function express(): Application;
}
