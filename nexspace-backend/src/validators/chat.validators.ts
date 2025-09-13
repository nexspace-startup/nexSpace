import { z } from "zod";

export const ChatMessageCreateSchema = z.object({
  text: z.string().trim().min(1, "Message required").max(2000, "Message too long"),
});

export const ChatListQuerySchema = z.object({
  before: z
    .union([z.string(), z.coerce.number()])
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      if (!isFinite(n) || n <= 0) return undefined;
      return new Date(n);
    }),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ChatDeleteParams = z.object({
  messageId: z.string().regex(/^\d+$/).transform((s) => BigInt(s)),
});

