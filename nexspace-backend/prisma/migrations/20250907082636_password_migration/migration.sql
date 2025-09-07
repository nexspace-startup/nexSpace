/*
  Warnings:

  - You are about to drop the column `auth_provider` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `auth_provider_sub` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `User` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('local', 'google', 'microsoft');

-- DropIndex
DROP INDEX "public"."User_auth_provider_sub_key";

-- AlterTable
ALTER TABLE "public"."Invitation" ALTER COLUMN "invitedEmail" SET DATA TYPE CITEXT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "auth_provider",
DROP COLUMN "auth_provider_sub",
DROP COLUMN "lastLoginAt",
ADD COLUMN     "displayName" VARCHAR(120),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- CreateTable
CREATE TABLE "public"."AuthIdentity" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "provider" "public"."AuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserLogin" (
    "userId" BIGINT NOT NULL,
    "hash" VARCHAR(255) NOT NULL,
    "alg" TEXT NOT NULL DEFAULT 'argon2id',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLogin_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_provider_idx" ON "public"."AuthIdentity"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerId_key" ON "public"."AuthIdentity"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "public"."AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserLogin" ADD CONSTRAINT "UserLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
