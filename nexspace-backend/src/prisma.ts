import { PrismaClient, WorkspaceRole, InvitationStatus } from '@prisma/client';

export const prisma = new PrismaClient();

export { WorkspaceRole };
export type { User, Workspace, WorkspaceMember, Invitation, AuthProvider, EmailTemplate, Prisma } from '@prisma/client';
