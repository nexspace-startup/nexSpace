import { z } from 'zod';

// Define the password validation schema
export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(64, { message: 'Password must be at most 64 characters long' })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one digit',
  })
  .refine((password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), {
    message: 'Password must contain at least one special character',
  });

// Define the name validation schema
export const nameSchemaWithoutSpaces = z
  .string()
  .min(1, { message: 'Name must be at least 2 characters long' })
  .max(50, { message: 'Name must be at most 50 characters long' })
  // The (?!['-]) prevents ' or - from being followed by another ' or -
  .regex(/^[A-Za-z-']+$/, {
    message: 'Name can only contain alphabetic, numeric, hyphens, and apostrophes, but not in consecutive pairs.',
  });


