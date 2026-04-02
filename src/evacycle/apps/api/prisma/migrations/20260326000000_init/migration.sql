-- ============================================================
-- EVACYCLE 초기 스키마 마이그레이션
-- 이 파일이 없으면 20260327000000_add_settlement가 PartType 등
-- 기본 enum을 찾지 못해 P3009 오류 발생.
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "OrgType" AS ENUM (
  'JUNKYARD',
  'INTAKE_JUNKYARD',
  'HUB',
  'BUYER',
  'PLATFORM'
);

CREATE TYPE "UserRole" AS ENUM (
  'OWNER',
  'JUNKYARD',
  'INTAKE_JUNKYARD',
  'HUB',
  'BUYER',
  'ADMIN'
);

CREATE TYPE "CaseStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'IN_TRANSIT',
  'RECEIVED',
  'GRADING',
  'ON_SALE',
  'SOLD',
  'SETTLED',
  'CANCELLED'
);

CREATE TYPE "EventType" AS ENUM (
  'CASE_CREATED',
  'CASE_SUBMITTED',
  'COC_SIGNED',
  'INTAKE_CONFIRMED',
  'GRADING_SUBMITTED',
  'LISTING_PUBLISHED',
  'PURCHASE_COMPLETED',
  'SETTLEMENT_CREATED',
  'SETTLEMENT_APPROVED',
  'CASE_CANCELLED'
);

CREATE TYPE "SettleStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'PAID',
  'DISPUTED'
);

CREATE TYPE "FileType" AS ENUM (
  'IMAGE',
  'DOCUMENT'
);

CREATE TYPE "FileStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'DELETED'
);

CREATE TYPE "PartType" AS ENUM (
  'BATTERY',
  'MOTOR',
  'INVERTER',
  'BODY',
  'OTHER'
);

CREATE TYPE "ReuseGrade" AS ENUM (
  'A',
  'B',
  'C',
  'D'
);

CREATE TYPE "RecycleGrade" AS ENUM (
  'R1',
  'R2',
  'R3'
);

CREATE TYPE "RoutingDecision" AS ENUM (
  'REUSE',
  'RECYCLE',
  'DISCARD'
);

CREATE TYPE "LotStatus" AS ENUM (
  'PENDING',
  'ON_SALE',
  'SOLD',
  'SETTLED'
);

CREATE TYPE "ListingStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'SOLD',
  'CANCELLED'
);

-- ─── Organization ─────────────────────────────────────────────────────────────

CREATE TABLE "Organization" (
    "id"        TEXT         NOT NULL,
    "name"      VARCHAR(100) NOT NULL,
    "type"      "OrgType"    NOT NULL,
    "bizNo"     VARCHAR(20)  NOT NULL,
    "address"   TEXT,
    "phone"     VARCHAR(20),
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- ─── User ─────────────────────────────────────────────────────────────────────

CREATE TABLE "User" (
    "id"          TEXT         NOT NULL,
    "orgId"       TEXT         NOT NULL,
    "email"       VARCHAR(255) NOT NULL,
    "name"        VARCHAR(100) NOT NULL,
    "role"        "UserRole"   NOT NULL,
    "otpSecret"   VARCHAR(100),
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── VehicleCase ──────────────────────────────────────────────────────────────

CREATE TABLE "VehicleCase" (
    "id"           TEXT         NOT NULL,
    "orgId"        TEXT         NOT NULL,
    "intakeOrgId"  TEXT,
    "hubOrgId"     TEXT,
    "createdBy"    TEXT         NOT NULL,
    "caseNo"       VARCHAR(30)  NOT NULL,
    "vin"          VARCHAR(17),
    "vehicleMaker" VARCHAR(50)  NOT NULL,
    "vehicleModel" VARCHAR(50)  NOT NULL,
    "vehicleYear"  SMALLINT     NOT NULL,
    "status"       "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleCase_caseNo_key" ON "VehicleCase"("caseNo");
CREATE UNIQUE INDEX "VehicleCase_vin_key"    ON "VehicleCase"("vin");
CREATE INDEX "VehicleCase_orgId_idx"    ON "VehicleCase"("orgId");
CREATE INDEX "VehicleCase_status_idx"   ON "VehicleCase"("status");
CREATE INDEX "VehicleCase_createdAt_idx" ON "VehicleCase"("createdAt" DESC);

ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_intakeOrgId_fkey"
  FOREIGN KEY ("intakeOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_hubOrgId_fkey"
  FOREIGN KEY ("hubOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleCase" ADD CONSTRAINT "VehicleCase_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── EventLedger ──────────────────────────────────────────────────────────────

CREATE TABLE "EventLedger" (
    "id"        TEXT         NOT NULL,
    "caseId"    TEXT         NOT NULL,
    "actorId"   TEXT         NOT NULL,
    "seq"       INTEGER      NOT NULL,
    "eventType" "EventType"  NOT NULL,
    "payload"   JSONB        NOT NULL,
    "prevHash"  VARCHAR(64)  NOT NULL,
    "selfHash"  VARCHAR(64)  NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventLedger_caseId_seq_key" ON "EventLedger"("caseId", "seq");
CREATE INDEX "EventLedger_caseId_idx"  ON "EventLedger"("caseId");
CREATE INDEX "EventLedger_selfHash_idx" ON "EventLedger"("selfHash");

ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventLedger" ADD CONSTRAINT "EventLedger_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Settlement (구식, CP1 호환) ──────────────────────────────────────────────

CREATE TABLE "Settlement" (
    "id"          TEXT          NOT NULL,
    "caseId"      TEXT          NOT NULL,
    "orgId"       TEXT          NOT NULL,
    "approvedBy"  TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "costAmount"  DECIMAL(12,2) NOT NULL,
    "feeRate"     DECIMAL(5,4)  NOT NULL,
    "feeAmount"   DECIMAL(12,2) NOT NULL,
    "netAmount"   DECIMAL(12,2) NOT NULL,
    "currency"    CHAR(3)       NOT NULL DEFAULT 'KRW',
    "status"      "SettleStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Settlement_caseId_key" ON "Settlement"("caseId");

ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_approvedBy_fkey"
  FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── CaseFile ─────────────────────────────────────────────────────────────────

CREATE TABLE "CaseFile" (
    "id"          TEXT         NOT NULL,
    "caseId"      TEXT         NOT NULL,
    "eventId"     TEXT,
    "fileName"    TEXT         NOT NULL,
    "fileType"    "FileType"   NOT NULL,
    "contentType" TEXT         NOT NULL,
    "objectKey"   TEXT         NOT NULL,
    "fileSize"    INTEGER,
    "status"      "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy"  TEXT         NOT NULL,
    "uploadedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseFile_caseId_idx"  ON "CaseFile"("caseId");
CREATE INDEX "CaseFile_eventId_idx" ON "CaseFile"("eventId");
CREATE INDEX "CaseFile_status_idx"  ON "CaseFile"("status");

ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "EventLedger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── GradingRule ──────────────────────────────────────────────────────────────

CREATE TABLE "GradingRule" (
    "id"                TEXT         NOT NULL,
    "partType"          "PartType"   NOT NULL,
    "reuseConditions"   JSONB        NOT NULL,
    "recycleConditions" JSONB        NOT NULL,
    "version"           INTEGER      NOT NULL DEFAULT 1,
    "isActive"          BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingRule_partType_version_key" ON "GradingRule"("partType", "version");
CREATE INDEX "GradingRule_partType_isActive_idx" ON "GradingRule"("partType", "isActive");

-- ─── Grading ──────────────────────────────────────────────────────────────────

CREATE TABLE "Grading" (
    "id"              TEXT              NOT NULL,
    "caseId"          TEXT              NOT NULL,
    "actorId"         TEXT              NOT NULL,
    "partType"        "PartType"        NOT NULL,
    "reuseGrade"      "ReuseGrade"      NOT NULL,
    "recycleGrade"    "RecycleGrade"    NOT NULL,
    "routingDecision" "RoutingDecision" NOT NULL,
    "notes"           TEXT,
    "ruleSnapshot"    JSONB,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Grading_caseId_idx" ON "Grading"("caseId");

ALTER TABLE "Grading" ADD CONSTRAINT "Grading_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Grading" ADD CONSTRAINT "Grading_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── DerivedLot ───────────────────────────────────────────────────────────────

CREATE TABLE "DerivedLot" (
    "id"              TEXT              NOT NULL,
    "caseId"          TEXT              NOT NULL,
    "lotNo"           VARCHAR(30)       NOT NULL,
    "partType"        "PartType"        NOT NULL,
    "routingDecision" "RoutingDecision" NOT NULL,
    "reuseGrade"      "ReuseGrade",
    "recycleGrade"    "RecycleGrade",
    "quantity"        INTEGER           NOT NULL DEFAULT 1,
    "weightKg"        DECIMAL(8,2)      NOT NULL,
    "status"          "LotStatus"       NOT NULL DEFAULT 'PENDING',
    "description"     TEXT,
    "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)      NOT NULL,

    CONSTRAINT "DerivedLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DerivedLot_lotNo_key" ON "DerivedLot"("lotNo");
CREATE INDEX "DerivedLot_caseId_idx"   ON "DerivedLot"("caseId");
CREATE INDEX "DerivedLot_status_idx"   ON "DerivedLot"("status");
CREATE INDEX "DerivedLot_partType_idx" ON "DerivedLot"("partType");

ALTER TABLE "DerivedLot" ADD CONSTRAINT "DerivedLot_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "VehicleCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Listing ──────────────────────────────────────────────────────────────────

CREATE TABLE "Listing" (
    "id"          TEXT            NOT NULL,
    "lotId"       TEXT            NOT NULL,
    "type"        VARCHAR(20)     NOT NULL DEFAULT 'FIXED_PRICE',
    "price"       DECIMAL(12,2)   NOT NULL,
    "currency"    CHAR(3)         NOT NULL DEFAULT 'KRW',
    "status"      "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "buyerId"     TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Listing_lotId_key"  ON "Listing"("lotId");
CREATE INDEX "Listing_status_idx"  ON "Listing"("status");
CREATE INDEX "Listing_buyerId_idx" ON "Listing"("buyerId");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "DerivedLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Prisma 마이그레이션 메타데이터 ────────────────────────────────────────────
-- (prisma migrate deploy가 _prisma_migrations 테이블을 자동 관리하므로 별도 삽입 불필요)
