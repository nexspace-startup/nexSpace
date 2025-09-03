declare var process: { env: Record<string, string | undefined> };
declare var Buffer: any;
type Buffer = any;
declare function setTimeout(
  handler: (...args: any[]) => void,
  timeout: number,
): { unref(): void };

declare module '*';
