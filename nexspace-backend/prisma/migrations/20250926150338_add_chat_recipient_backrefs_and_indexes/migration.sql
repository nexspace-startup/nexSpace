-- CreateIndex
CREATE INDEX "ChatMessage_workspaceUid_recipientId_senderId_createdAt_idx" ON "public"."ChatMessage"("workspaceUid", "recipientId", "senderId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_workspaceUid_senderId_deletedAt_idx" ON "public"."ChatMessage"("workspaceUid", "senderId", "deletedAt");

-- CreateIndex
CREATE INDEX "ChatThreadRead_workspaceUid_userId_updatedAt_idx" ON "public"."ChatThreadRead"("workspaceUid", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- AddForeignKey
ALTER TABLE "public"."ChatMessage" ADD CONSTRAINT "ChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThreadRead" ADD CONSTRAINT "ChatThreadRead_workspaceUid_fkey" FOREIGN KEY ("workspaceUid") REFERENCES "public"."Workspace"("uid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThreadRead" ADD CONSTRAINT "ChatThreadRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThreadRead" ADD CONSTRAINT "ChatThreadRead_peerId_fkey" FOREIGN KEY ("peerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
