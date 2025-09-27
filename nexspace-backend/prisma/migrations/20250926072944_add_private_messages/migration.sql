-- AlterTable
ALTER TABLE "public"."ChatMessage" ADD COLUMN     "recipientId" BIGINT;

-- CreateIndex
CREATE INDEX "ChatMessage_workspaceUid_recipientId_createdAt_idx" ON "public"."ChatMessage"("workspaceUid", "recipientId", "createdAt");
