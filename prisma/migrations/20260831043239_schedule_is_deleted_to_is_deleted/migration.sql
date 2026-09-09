/*
  Warnings:

  - You are about to drop the column `IsDeleted` on the `schedules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "schedules" DROP COLUMN "IsDeleted",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
