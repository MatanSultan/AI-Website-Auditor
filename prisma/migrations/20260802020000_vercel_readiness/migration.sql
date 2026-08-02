ALTER TABLE "Audit"
  ADD COLUMN "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "jobId" TEXT;

CREATE INDEX "Audit_status_processingLeaseUntil_idx"
  ON "Audit"("status", "processingLeaseUntil");
