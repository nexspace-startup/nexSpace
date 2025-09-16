import { prisma, WorkspaceRole } from "../prisma.js";

export async function createWorkspaceForUser(userId: string, name: string) {
  const uid = BigInt(userId);
  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.workspace.findFirst({
      where: { name, createdById: uid },
      select: { uid: true },
    });
    if (duplicate) throw new Error("WORKSPACE_CONFLICT");

    const workspace = await tx.workspace.create({
      data: { name, createdById: uid },
    });

    await tx.workspaceMember.create({
      data: { workspaceUid: workspace.uid, userId: uid, role: WorkspaceRole.OWNER },
    });

    return { id: workspace.uid, name: workspace.name } as const;
  });

  return result;
}

