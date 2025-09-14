import { z } from 'zod';
import { WorkspaceRole } from '@prisma/client';
import { nameSchemaWithoutSpaces, passwordSchema } from '../utils/common.js';

export const OnboardingSchema = z.object({
  firstName: nameSchemaWithoutSpaces,
  lastName: nameSchemaWithoutSpaces,
  email: z.string().email(),
  password: passwordSchema.optional(),
  workspaceName: z.string().min(1).max(120),
  company: z.string().optional(),
  teamSize: z.string().optional(),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.OWNER),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const InvitationSchema = z.object({
  email: z.string().email(),
  workspaceUid: z.string().min(1),
});
export type InvitationInput = z.infer<typeof InvitationSchema>;

export const AcceptParams = z.object({ token: z.string().uuid() });
export type AcceptParamsType = z.infer<typeof AcceptParams>;

