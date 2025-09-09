// Align globals with Node.js types to avoid shadowing @types/node
declare const process: NodeJS.Process;
declare var Buffer: typeof globalThis.Buffer;
