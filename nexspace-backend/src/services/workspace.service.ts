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

export async function deleteWorkspaceForUser(userId: string, workspaceUid: string) {
  const uid = BigInt(userId);
  return prisma.$transaction(async (tx) => {
    // verify membership and role
    const membership = await tx.workspaceMember.findFirst({
      where: { userId: uid, workspaceUid },
      select: { role: true },
    });
    if (!membership) throw new Error("FORBIDDEN");
    if (membership.role !== WorkspaceRole.OWNER) throw new Error("FORBIDDEN");

    const exists = await tx.workspace.findUnique({ where: { uid: workspaceUid }, select: { uid: true } });
    if (!exists) throw new Error("NOT_FOUND");

    await tx.workspace.delete({ where: { uid: workspaceUid } });
    return { id: workspaceUid } as const;
  });
}
