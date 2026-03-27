-- CreateEnum: SettlementType
CREATE TYPE "SettlementType" AS ENUM ('M0', 'DELTA');

-- CreateEnum: SettlementStatus
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- AlterEnum: EventType — add SETTLEMENT_PAID, SETTLEMENT_REJECTED
ALTER TYPE "EventType" ADD VALUE 'SETTLEMENT_PAID';
ALTER TYPE "EventType" ADD VALUE 'SETTLEMENT_REJECTED';

-- CreateTable: SettlementRule
CREATE TABLE "SettlementRule" (
    "id" TEXT NOT NULL,
    "partType" "PartType" NOT NULL,
    "deltaRatio" DECIMAL(5,2) NOT NULL,
    "m0BaseAmount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SettlementRule unique
CREATE UNIQUE INDEX "SettlementRule_partType_version_key" ON "SettlementRule"("partType", "version");

-- CreateIndex: SettlementRule active
CREATE INDEX "SettlementRule_partType_isActive_idx" ON "SettlementRule"("partType", "isActive");

-- CreateTable: NewSettlement
CREATE TABLE "NewSettlement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lotId" TEXT,
    "yardUserId" TEXT NOT NULL,
    "type" "SettlementType" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "ruleSnapshot" JSONB,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: NewSettlement
CREATE INDEX "NewSettlement_caseId_idx" ON "NewSettlement"("caseId");
CREATE INDEX "NewSettlement_lotId_idx" ON "NewSettlement"("lotId");
CREATE INDEX "NewSettlement_yardUserId_idx" ON "NewSettlement"("yardUserId");
CREATE INDEX "NewSettlement_status_idx" ON "NewSettlement"("status");
CREATE INDEX "NewSettlement_type_idx" ON "NewSettlement"("type");

-- AddForeignKey: NewSettlement
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "DerivedLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_yardUserId_fkey" FOREIGN KEY ("yardUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
