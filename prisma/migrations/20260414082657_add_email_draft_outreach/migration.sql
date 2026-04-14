-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "outreachPrompt" TEXT;

-- CreateTable
CREATE TABLE "email_draft" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "promptUsed" TEXT,
    "provider" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersions" JSONB,
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_draft_campaignId_status_idx" ON "email_draft"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "email_draft_resultId_campaignId_key" ON "email_draft"("resultId", "campaignId");

-- AddForeignKey
ALTER TABLE "email_draft" ADD CONSTRAINT "email_draft_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_draft" ADD CONSTRAINT "email_draft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
