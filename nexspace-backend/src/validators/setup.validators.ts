import { z } from "zod";
import { nameSchemaWithoutSpaces, passwordSchema } from "../utils/common.js";

const WorkspaceRoleValues = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WorkspaceRoleValues)[number];

export const OnboardingSchema = z.object({
  firstName: nameSchemaWithoutSpaces,
  lastName: nameSchemaWithoutSpaces,
  email: z.string().email(),
  password: passwordSchema.optional(),
  workspaceName: z.string().min(1).max(120),
  company: z.string().optional(),
  teamSize: z.string().optional(),
  role: z.enum(WorkspaceRoleValues).default("OWNER"),
});

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export const InvitationSchema = z.object({
  email: z.string().email(),
  workspaceUid: z.string().min(1),
});
export type InvitationInput = z.infer<typeof InvitationSchema>;

export const AcceptParams = z.object({ token: z.uuid() });
export type AcceptParamsType = z.infer<typeof AcceptParams>;

