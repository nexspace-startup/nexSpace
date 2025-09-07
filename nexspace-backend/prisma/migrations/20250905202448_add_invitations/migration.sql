/*
  Warnings:

  - You are about to drop the column `invitedById` on the `WorkspaceMember` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "public"."WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_invitedById_fkey";

-- AlterTable
ALTER TABLE "public"."WorkspaceMember" DROP COLUMN "invitedById";

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" UUID NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "invitedBy" BIGINT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" "public"."WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_idx" ON "public"."Invitation"("workspaceId");

-- CreateIndex
CREATE INDEX "Invitation_invitedEmail_idx" ON "public"."Invitation"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_workspaceId_invitedEmail_status_key" ON "public"."Invitation"("workspaceId", "invitedEmail", "status");

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
