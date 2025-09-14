import { findAuthIdentity } from "../repositories/auth.repository.js";
import { getUserWithMemberships } from "../repositories/user.repository.js";

export type WorkspaceDTO = {
  id: string;
  uid: string;
  name: string;
  memberCount: number;
  role: any;
};

export type UserDTO = {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

export type MeResponse = {
  isAuthenticated: boolean;
  user?: UserDTO;
  workspaces?: WorkspaceDTO[];
};

export async function resolveUserIdBySub(sub: string, known?: "google" | "microsoft") {
  const providers: ReadonlyArray<"google" | "microsoft"> = known
    ? [known, known === "google" ? "microsoft" : "google"]
    : ["google", "microsoft"];
  for (const p of providers) {
    const ident = await findAuthIdentity(p, sub);
    if (ident) return ident.userId;
  }
  return null;
}

export async function loadUserWithMemberships(userId: string) {
  return getUserWithMemberships(BigInt(userId));
}

export function toMeDTO(user: any, sessionEmail?: string): MeResponse {
  if (!user) {
    return { isAuthenticated: true, user: { email: sessionEmail }, workspaces: [] };
  }
  const workspaces: WorkspaceDTO[] = user.memberships.map((m: any) => ({
    id: String(m.workspace.id),
    uid: m.workspace.uid,
    name: m.workspace.name,
    memberCount: m.workspace._count.members,
    role: m.role,
  }));
  return {
    isAuthenticated: true,
    user: {
      id: String(user.id),
      first_name: user.first_name ?? undefined,
      last_name: user.last_name ?? undefined,
      email: user.email ?? sessionEmail,
    },
    workspaces,
  };
}
