-- CreateEnum
CREATE TYPE "public"."PresenceStatus" AS ENUM ('AVAILABLE', 'BUSY', 'IN_MEETING', 'AWAY', 'DO_NOT_DISTURB');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "lastSeen" TIMESTAMP(3),
ADD COLUMN     "status" "public"."PresenceStatus" NOT NULL DEFAULT 'AVAILABLE';

-- CreateTable
CREATE TABLE "public"."UserStatus" (
    "userId" BIGINT NOT NULL,
    "status" "public"."PresenceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "lastSeen" TIMESTAMP(3),
    "currentActivity" VARCHAR(255),

    CONSTRAINT "UserStatus_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."UserPresence" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "workspaceUid" TEXT NOT NULL,
    "status" "public"."PresenceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastActivity" TIMESTAMP(3),
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserWorkspaceSession" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "workspaceUid" TEXT NOT NULL,
    "sessionStart" TIMESTAMP(3) NOT NULL,
    "sessionEnd" TIMESTAMP(3),
    "duration" INTEGER,
    "statusChanges" JSONB,
    "activities" JSONB,
    "deviceInfo" JSONB,

    CONSTRAINT "UserWorkspaceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPresence_workspaceUid_idx" ON "public"."UserPresence"("workspaceUid");

-- CreateIndex
CREATE INDEX "UserPresence_userId_idx" ON "public"."UserPresence"("userId");

-- CreateIndex
CREATE INDEX "UserWorkspaceSession_userId_sessionStart_idx" ON "public"."UserWorkspaceSession"("userId", "sessionStart");

-- CreateIndex
CREATE INDEX "UserWorkspaceSession_workspaceUid_idx" ON "public"."UserWorkspaceSession"("workspaceUid");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "public"."User"("status");

-- CreateIndex
CREATE INDEX "User_lastSeen_idx" ON "public"."User"("lastSeen");

-- AddForeignKey
ALTER TABLE "public"."UserStatus" ADD CONSTRAINT "UserStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPresence" ADD CONSTRAINT "UserPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPresence" ADD CONSTRAINT "UserPresence_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserWorkspaceSession" ADD CONSTRAINT "UserWorkspaceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserWorkspaceSession" ADD CONSTRAINT "UserWorkspaceSession_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;
