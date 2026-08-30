-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "commissionOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "commissionOverridePercent" INTEGER;
