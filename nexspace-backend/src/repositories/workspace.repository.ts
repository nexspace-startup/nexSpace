import { prisma } from "../prisma.js";
import { CacheKeys, CacheTTL, withCache } from "../utils/cache.js";

export type WorkspaceMemberListItem = { id: string; name: string };

export async function findWorkspaceByUid(uid: string) {
  const key = CacheKeys.workspace(uid);
  return withCache(key, CacheTTL.workspace, async () => {
    const row = await prisma.workspace.findUnique({ where: { uid }, select: { uid: true, name: true } });
    return row ?? null;
  });
}

export async function isWorkspaceMember(workspaceUid: string, userId: bigint) {
  const key = CacheKeys.workspaceMember(workspaceUid, userId);
  return withCache(key, CacheTTL.workspaceMember, async () => {
    const row = await prisma.workspaceMember.findFirst({
      where: { workspaceUid, userId },
      select: { role: true, status: true },
    });
    return row ?? null;
  });
}

export async function findWorkspacesForUser(
  userId: bigint
): Promise<Array<{ role: string; workspace: { uid: string; name: string } | null }>> {
  const key = CacheKeys.userWorkspaces(userId);
  return (
    (await withCache(key, CacheTTL.userWorkspaces, async () => {
      const rows = await prisma.workspaceMember.findMany({
        where: { userId },
        select: {
          role: true,
          workspace: {
            select: {
              uid: true,
              name: true,
            },
          },
        },
      });
      return rows ?? [];
    })) ?? []
  );
}

export async function listWorkspaceMembers(
  workspaceUid: string,
  query?: string
): Promise<WorkspaceMemberListItem[]> {
  const normalizedQuery = query?.trim();
  const effectiveQuery = normalizedQuery && normalizedQuery !== "%" ? normalizedQuery : undefined;

  const whereUser: any = effectiveQuery
    ? {
        OR: [
          { displayName: { contains: effectiveQuery, mode: "insensitive" } },
          { email: { contains: effectiveQuery, mode: "insensitive" } },
        ],
      }
    : undefined;
  const fetchMembers = async (): Promise<WorkspaceMemberListItem[]> => {
    const rows: Array<{
      user: {
        id: bigint;
        first_name: string | null;
        last_name: string | null;
        displayName: string | null;
        email: string | null;
      };
    }> = await prisma.workspaceMember.findMany({
      where: { workspaceUid, ...(whereUser ? { user: whereUser } : {}) },
      select: {
        user: { select: { id: true, first_name: true, last_name: true, displayName: true, email: true } },
      },
    });
    return rows.map((r): WorkspaceMemberListItem => {
      const display = r.user.displayName?.trim();
      const fallbackName = [r.user.first_name, r.user.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const name = display || fallbackName || r.user.email || "";
      return { id: String(r.user.id), name };
    });
  };

  if (whereUser) {
    return fetchMembers();
  }

  return (await withCache(CacheKeys.workspaceMembers(workspaceUid), CacheTTL.workspaceMembers, fetchMembers)) ?? [];
}
