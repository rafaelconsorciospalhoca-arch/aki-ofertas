-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "asaasCustomerId" TEXT,
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "asaasSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "asaasMode" TEXT NOT NULL DEFAULT 'SANDBOX',
    "asaasSandboxApiKey" TEXT,
    "asaasProductionApiKey" TEXT,
    "asaasWebhookToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
