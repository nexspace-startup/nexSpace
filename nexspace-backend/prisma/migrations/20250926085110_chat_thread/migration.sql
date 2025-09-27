-- CreateTable
CREATE TABLE "public"."ChatThreadRead" (
    "workspaceUid" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "peerId" BIGINT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThreadRead_pkey" PRIMARY KEY ("workspaceUid","userId","peerId")
);

-- CreateIndex
CREATE INDEX "ChatThreadRead_workspaceUid_userId_idx" ON "public"."ChatThreadRead"("workspaceUid", "userId");
