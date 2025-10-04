/*
  Warnings:

  - You are about to drop the column `status` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastSeen` on the `UserStatus` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,workspaceUid]` on the table `UserPresence` will be added. If there are existing duplicate values, this will fail.
  - Made the column `lastActivity` on table `UserPresence` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `UserWorkspaceSession` table without a default value. This is not possible if the table is not empty.
  - Made the column `statusChanges` on table `UserWorkspaceSession` required. This step will fail if there are existing NULL values in that column.
  - Made the column `activities` on table `UserWorkspaceSession` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."User_lastSeen_idx";

-- DropIndex
DROP INDEX "public"."User_status_idx";

-- DropIndex
DROP INDEX "public"."UserPresence_workspaceUid_idx";

-- DropIndex
DROP INDEX "public"."UserWorkspaceSession_userId_sessionStart_idx";

-- DropIndex
DROP INDEX "public"."UserWorkspaceSession_workspaceUid_idx";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "status",
ALTER COLUMN "lastSeen" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."UserPresence" ALTER COLUMN "lastActivity" SET NOT NULL,
ALTER COLUMN "lastActivity" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."UserStatus" DROP COLUMN "lastSeen",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."UserWorkspaceSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "sessionStart" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "statusChanges" SET NOT NULL,
ALTER COLUMN "statusChanges" SET DEFAULT '[]',
ALTER COLUMN "activities" SET NOT NULL,
ALTER COLUMN "activities" SET DEFAULT '[]';

-- CreateIndex
CREATE INDEX "User_lastSeen_idx" ON "public"."User"("lastSeen" DESC);

-- CreateIndex
CREATE INDEX "UserPresence_workspaceUid_isOnline_idx" ON "public"."UserPresence"("workspaceUid", "isOnline");

-- CreateIndex
CREATE INDEX "UserPresence_lastActivity_idx" ON "public"."UserPresence"("lastActivity" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserPresence_userId_workspaceUid_key" ON "public"."UserPresence"("userId", "workspaceUid");

-- CreateIndex
CREATE INDEX "UserStatus_status_idx" ON "public"."UserStatus"("status");

-- CreateIndex
CREATE INDEX "UserStatus_updatedAt_idx" ON "public"."UserStatus"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "UserWorkspaceSession_userId_sessionStart_idx" ON "public"."UserWorkspaceSession"("userId", "sessionStart" DESC);

-- CreateIndex
CREATE INDEX "UserWorkspaceSession_workspaceUid_sessionStart_idx" ON "public"."UserWorkspaceSession"("workspaceUid", "sessionStart" DESC);

-- CreateIndex
CREATE INDEX "UserWorkspaceSession_sessionEnd_idx" ON "public"."UserWorkspaceSession"("sessionEnd");
