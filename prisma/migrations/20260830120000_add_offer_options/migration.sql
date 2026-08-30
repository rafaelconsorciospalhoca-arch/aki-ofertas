-- CreateEnum
CREATE TYPE "OfferOptionGroupType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateTable
CREATE TABLE "offer_option_groups" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OfferOptionGroupType" NOT NULL DEFAULT 'SINGLE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "offer_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_option_choices" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extraPriceCents" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "offer_option_choices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "selectedOptions" TEXT,
ADD COLUMN "optionsFeeCents" INTEGER;

-- AddForeignKey
ALTER TABLE "offer_option_groups" ADD CONSTRAINT "offer_option_groups_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_option_choices" ADD CONSTRAINT "offer_option_choices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "offer_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
