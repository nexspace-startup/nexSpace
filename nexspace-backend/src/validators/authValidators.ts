import z from 'zod';

export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().optional(),
});

export type SigninInput = z.infer<typeof SigninSchema>;

export const GoogleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().optional(),
});

export type GoogleCallbackInput = z.infer<typeof GoogleCallbackSchema>;

