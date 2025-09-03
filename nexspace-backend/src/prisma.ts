import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type { User, Workspace, WorkspaceMember, WorkspaceRole } from '@prisma/client';
