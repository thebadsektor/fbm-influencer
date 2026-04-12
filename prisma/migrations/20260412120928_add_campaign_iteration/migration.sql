-- CreateTable
CREATE TABLE "campaign_iteration" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "iterationNumber" INTEGER NOT NULL,
    "khSetId" TEXT,
    "keywordsUsed" TEXT[],
    "hashtagsUsed" TEXT[],
    "platformUsed" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "profiledCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "avgFitScore" DOUBLE PRECISION,
    "fitDistribution" JSONB,
    "topPerformingKeywords" TEXT[],
    "lowPerformingKeywords" TEXT[],
    "exclusionPatterns" JSONB,
    "contentThemeFrequency" JSONB,
    "analysisNarrative" TEXT,
    "strategyForNext" TEXT,
    "learnings" TEXT[],
    "profilingCost" DOUBLE PRECISION,
    "profilingDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_iteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_iteration_campaignId_iterationNumber_key" ON "campaign_iteration"("campaignId", "iterationNumber");

-- AddForeignKey
ALTER TABLE "campaign_iteration" ADD CONSTRAINT "campaign_iteration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
