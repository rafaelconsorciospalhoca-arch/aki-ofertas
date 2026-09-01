-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'FOOD_VOUCHER', 'MEAL_VOUCHER', 'CASH');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "acceptedPaymentMethods" "PaymentMethod"[] NOT NULL DEFAULT ARRAY[]::"PaymentMethod"[];

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN "changeForCents" INTEGER;
