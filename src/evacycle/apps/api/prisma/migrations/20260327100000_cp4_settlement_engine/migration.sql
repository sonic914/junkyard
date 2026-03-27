-- CP4: Settlement Engine (M0 + Delta1 + Delta2)

-- 1. SettlementType enum: rename DELTA → DELTA_1, add DELTA_2
ALTER TYPE "SettlementType" RENAME VALUE 'DELTA' TO 'DELTA_1';
ALTER TYPE "SettlementType" ADD VALUE 'DELTA_2';

-- 2. NewSettlement: add grossAmount, feeRate, feeAmount, calcDetail, triggeredByEvent
ALTER TABLE "NewSettlement" ADD COLUMN "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "NewSettlement" ADD COLUMN "feeRate" DECIMAL(5,4) NOT NULL DEFAULT 0;
ALTER TABLE "NewSettlement" ADD COLUMN "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "NewSettlement" ADD COLUMN "calcDetail" JSONB;
ALTER TABLE "NewSettlement" ADD COLUMN "triggeredByEvent" TEXT;

-- Backfill: set grossAmount = amount for existing records (pre-CP4 had no fee split)
UPDATE "NewSettlement" SET "grossAmount" = "amount" WHERE "grossAmount" = 0;

-- 3. NewSettlement: add createdAt DESC index
CREATE INDEX "NewSettlement_createdAt_idx" ON "NewSettlement"("createdAt" DESC);

-- 4. SettlementRule: add gradeBonusMap, platformFeeRate
ALTER TABLE "SettlementRule" ADD COLUMN "gradeBonusMap" JSONB;
ALTER TABLE "SettlementRule" ADD COLUMN "platformFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.0500;
