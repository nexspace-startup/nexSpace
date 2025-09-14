/*
  Warnings:

  - You are about to drop the column `workspaceId` on the `Invitation` table. All the data in the column will be lost.
  - The primary key for the `Workspace` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Workspace` table. All the data in the column will be lost.
  - The primary key for the `WorkspaceMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `workspaceId` on the `WorkspaceMember` table. All the data in the column will be lost.
  - Added the required column `workspaceUid` to the `Invitation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceUid` to the `WorkspaceMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Invitation" DROP CONSTRAINT "Invitation_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_workspaceId_fkey";

-- DropIndex
DROP INDEX "public"."Invitation_workspaceId_idx";

-- DropIndex
DROP INDEX "public"."Workspace_uid_key";

-- DropIndex
DROP INDEX "public"."WorkspaceMember_workspaceId_role_idx";

-- AlterTable
ALTER TABLE "public"."Invitation" DROP COLUMN "workspaceId",
ADD COLUMN     "workspaceUid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Workspace" DROP CONSTRAINT "Workspace_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Workspace_pkey" PRIMARY KEY ("uid");

-- AlterTable
ALTER TABLE "public"."WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_pkey",
DROP COLUMN "workspaceId",
ADD COLUMN     "workspaceUid" TEXT NOT NULL,
ADD CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceUid", "userId");

-- CreateTable
CREATE TABLE "public"."ChatMessage" (
    "id" BIGSERIAL NOT NULL,
    "workspaceUid" TEXT NOT NULL,
    "senderId" BIGINT NOT NULL,
    "roomUid" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_workspaceUid_createdAt_idx" ON "public"."ChatMessage"("workspaceUid", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_createdAt_idx" ON "public"."ChatMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "Invitation_workspaceUid_idx" ON "public"."Invitation"("workspaceUid");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceUid_role_idx" ON "public"."WorkspaceMember"("workspaceUid", "role");

-- AddForeignKey
ALTER TABLE "public"."WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
