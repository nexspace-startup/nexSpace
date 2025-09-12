import { prisma } from "../prisma.js";

export async function findAuthIdentity(provider: "google" | "microsoft", providerId: string) {
  return prisma.authIdentity.findUnique({
    where: { provider_providerId: { provider, providerId } },
    select: { userId: true },
  });
}

