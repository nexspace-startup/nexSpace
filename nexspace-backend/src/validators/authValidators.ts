import z from 'zod';

export const SigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().optional(),
});

export type SigninInput = z.infer<typeof SigninSchema>;

// Accept either an OAuth authorization code (GIS code flow) or an ID token (One Tap)
export const GoogleCallbackSchema = z.union([
  z.object({
    code: z.string().min(1, 'Authorization code is required'),
    redirectUri: z.string().optional(),
    next: z.string().optional(),
  }),
  z.object({
    idToken: z.string().min(10, 'ID token is required'),
    next: z.string().optional(),
  }),
  z.object({
    credential: z.string().min(10, 'ID token is required'), // GIS sometimes uses `credential`
    next: z.string().optional(),
  })
]);

export type GoogleCallbackInput = z.infer<typeof GoogleCallbackSchema>;

// Email existence check
export const CheckEmailSchema = z.object({
  email: z.email(),
});

export type CheckEmailInput = z.infer<typeof CheckEmailSchema>;

