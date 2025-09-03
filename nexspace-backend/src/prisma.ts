import { PrismaClient, WorkspaceRole } from '@prisma/client';

export const prisma = new PrismaClient();

export { WorkspaceRole };
export type { User, Workspace, WorkspaceMember, Prisma } from '@prisma/client';
