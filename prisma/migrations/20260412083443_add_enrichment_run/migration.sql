-- CreateTable
CREATE TABLE "enrichment_run" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "cost" DOUBLE PRECISION,
    "executionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "enrichment_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrichment_run_resultId_workflow_idx" ON "enrichment_run"("resultId", "workflow");

-- CreateIndex
CREATE INDEX "enrichment_run_workflow_status_idx" ON "enrichment_run"("workflow", "status");

-- AddForeignKey
ALTER TABLE "enrichment_run" ADD CONSTRAINT "enrichment_run_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
