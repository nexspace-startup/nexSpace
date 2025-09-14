import { PrismaClient, WorkspaceRole, InvitationStatus } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA__: PrismaClient | undefined;
}

function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });
}

export const prisma: PrismaClient = global.__PRISMA__ ?? createPrisma();
if (process.env.NODE_ENV !== 'production') global.__PRISMA__ = prisma;

export async function closePrisma() {
  try {
    await prisma.$disconnect();
  } catch {}
}

export { WorkspaceRole };
export type { User, Workspace, WorkspaceMember, Invitation, AuthProvider, EmailTemplate, Prisma } from '@prisma/client';
