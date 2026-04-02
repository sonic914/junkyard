-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('JUNKYARD', 'INTAKE_JUNKYARD', 'HUB', 'BUYER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'JUNKYARD', 'INTAKE_JUNKYARD', 'HUB', 'BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_TRANSIT', 'RECEIVED', 'GRADING', 'ON_SALE', 'SOLD', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CASE_CREATED', 'CASE_SUBMITTED', 'COC_SIGNED', 'INTAKE_CONFIRMED', 'GRADING_SUBMITTED', 'LISTING_PUBLISHED', 'PURCHASE_COMPLETED', 'SETTLEMENT_CREATED', 'SETTLEMENT_APPROVED', 'SETTLEMENT_PAID', 'SETTLEMENT_REJECTED', 'CASE_CANCELLED');

-- CreateEnum
CREATE TYPE "SettleStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SettlementType" AS ENUM ('M0', 'DELTA_1', 'DELTA_2');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELETED');

-- CreateEnum
CREATE TYPE "PartType" AS ENUM ('BATTERY', 'MOTOR', 'INVERTER', 'BODY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReuseGrade" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "RecycleGrade" AS ENUM ('R1', 'R2', 'R3');

-- CreateEnum
CREATE TYPE "RoutingDecision" AS ENUM ('REUSE', 'RECYCLE', 'DISCARD');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('PENDING', 'ON_SALE', 'SOLD', 'SETTLED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "OrgType" NOT NULL,
    "bizNo" VARCHAR(20) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL,
    "otpSecret" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "intakeOrgId" TEXT,
    "hubOrgId" TEXT,
    "createdBy" TEXT NOT NULL,
    "caseNo" VARCHAR(30) NOT NULL,
    "vin" VARCHAR(17),
    "vehicleMaker" VARCHAR(50) NOT NULL,
    "vehicleModel" VARCHAR(50) NOT NULL,
    "vehicleYear" SMALLINT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLedger" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventType" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" VARCHAR(64) NOT NULL,
    "selfHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "approvedBy" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "costAmount" DECIMAL(12,2) NOT NULL,
    "feeRate" DECIMAL(5,4) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "status" "SettleStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "eventId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "contentType" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingRule" (
    "id" TEXT NOT NULL,
    "partType" "PartType" NOT NULL,
    "reuseConditions" JSONB NOT NULL,
    "recycleConditions" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grading" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "partType" "PartType" NOT NULL,
    "reuseGrade" "ReuseGrade" NOT NULL,
    "recycleGrade" "RecycleGrade" NOT NULL,
    "routingDecision" "RoutingDecision" NOT NULL,
    "notes" TEXT,
    "ruleSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DerivedLot" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lotNo" VARCHAR(30) NOT NULL,
    "partType" "PartType" NOT NULL,
    "routingDecision" "RoutingDecision" NOT NULL,
    "reuseGrade" "ReuseGrade",
    "recycleGrade" "RecycleGrade",
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightKg" DECIMAL(8,2) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DerivedLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'FIXED_PRICE',
    "price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "buyerId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRule" (
    "id" TEXT NOT NULL,
    "partType" "PartType" NOT NULL,
    "m0BaseAmount" DECIMAL(12,2) NOT NULL,
    "deltaRatio" DECIMAL(5,2) NOT NULL,
    "gradeBonusMap" JSONB,
    "platformFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewSettlement" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lotId" TEXT,
    "yardUserId" TEXT NOT NULL,
    "type" "SettlementType" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "feeRate" DECIMAL(5,4) NOT NULL,
    "feeAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "ruleSnapshot" JSONB,
    "calcDetail" JSONB,
    "triggeredByEvent" TEXT,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCase_caseNo_key" ON "VehicleCase"("caseNo");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCase_vin_key" ON "VehicleCase"("vin");

-- CreateIndex
CREATE INDEX "VehicleCase_orgId_idx" ON "VehicleCase"("orgId");

-- CreateIndex
CREATE INDEX "VehicleCase_status_idx" ON "VehicleCase"("status");

-- CreateIndex
CREATE INDEX "VehicleCase_createdAt_idx" ON "VehicleCase"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "EventLedger_caseId_idx" ON "EventLedger"("caseId");

-- CreateIndex
CREATE INDEX "EventLedger_selfHash_idx" ON "EventLedger"("selfHash");

-- CreateIndex
CREATE UNIQUE INDEX "EventLedger_caseId_seq_key" ON "EventLedger"("caseId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_caseId_key" ON "Settlement"("caseId");

-- CreateIndex
CREATE INDEX "CaseFile_caseId_idx" ON "CaseFile"("caseId");

-- CreateIndex
CREATE INDEX "CaseFile_eventId_idx" ON "CaseFile"("eventId");

-- CreateIndex
CREATE INDEX "CaseFile_status_idx" ON "CaseFile"("status");

-- CreateIndex
CREATE INDEX "GradingRule_partType_isActive_idx" ON "GradingRule"("partType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GradingRule_partType_version_key" ON "GradingRule"("partType", "version");

-- CreateIndex
CREATE INDEX "Grading_caseId_idx" ON "Grading"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedLot_lotNo_key" ON "DerivedLot"("lotNo");

-- CreateIndex
CREATE INDEX "DerivedLot_caseId_idx" ON "DerivedLot"("caseId");

-- CreateIndex
CREATE INDEX "DerivedLot_status_idx" ON "DerivedLot"("status");

-- CreateIndex
CREATE INDEX "DerivedLot_partType_idx" ON "DerivedLot"("partType");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_lotId_key" ON "Listing"("lotId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_buyerId_idx" ON "Listing"("buyerId");

-- CreateIndex
CREATE INDEX "SettlementRule_partType_isActive_idx" ON "SettlementRule"("partType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementRule_partType_version_key" ON "SettlementRule"("partType", "version");

-- CreateIndex
CREATE INDEX "NewSettlement_caseId_idx" ON "NewSettlement"("caseId");

-- CreateIndex
CREATE INDEX "NewSettlement_lotId_idx" ON "NewSettlement"("lotId");

-- CreateIndex
CREATE INDEX "NewSettlement_yardUserId_idx" ON "NewSettlement"("yardUserId");

-- CreateIndex
CREATE INDEX "NewSettlement_status_idx" ON "NewSettlement"("status");

-- CreateIndex
CREATE INDEX "NewSettlement_type_idx" ON "NewSettlement"("type");

-- CreateIndex
CREATE INDEX "NewSettlement_createdAt_idx" ON "NewSettlement"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_intakeOrgId_fkey" FOREIGN KEY ("intakeOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_hubOrgId_fkey" FOREIGN KEY ("hubOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grading" ADD CONSTRAINT "Grading_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grading" ADD CONSTRAINT "Grading_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedLot" ADD CONSTRAINT "DerivedLot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "DerivedLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "DerivedLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_yardUserId_fkey" FOREIGN KEY ("yardUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewSettlement" ADD CONSTRAINT "NewSettlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

