import { PrismaClient } from '@prisma/client';

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
if (process.env.NODE_ENV !== 'production') {
  global.__PRISMA__ = prisma;
}

export async function closePrisma() {
  try {
    await prisma.$disconnect();
  } catch {}
}

export { Prisma } from '@prisma/client';
export {
  WorkspaceRole,
  InvitationStatus,
  type User,
  type Workspace,
  type WorkspaceMember,
  type Invitation,
  type EmailTemplate,
} from '@prisma/client';
export { AuthProvider } from '@prisma/client';
