ALTER TABLE "Audit"
  ADD COLUMN "accessTokenHash" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "processingLeaseId" TEXT,
  ADD COLUMN "processingLeaseUntil" TIMESTAMP(3);

ALTER TABLE "AuditPage" ADD COLUMN "contentExpiresAt" TIMESTAMP(3);

ALTER TABLE "Finding" ADD COLUMN "ruleId" TEXT;
UPDATE "Finding" SET "ruleId" = "id" WHERE "ruleId" IS NULL;
ALTER TABLE "Finding" ALTER COLUMN "ruleId" SET NOT NULL;

ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Payment" SET "idempotencyKey" = 'legacy-order-' || "providerOrderId" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE TABLE "PayPalWebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "auditId" TEXT REFERENCES "Audit"("id") ON DELETE SET NULL,
  "eventType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Audit_accessTokenHash_key" ON "Audit"("accessTokenHash");
CREATE INDEX "Finding_auditId_ruleId_idx" ON "Finding"("auditId", "ruleId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "PayPalWebhookEvent_auditId_createdAt_idx" ON "PayPalWebhookEvent"("auditId", "createdAt");
