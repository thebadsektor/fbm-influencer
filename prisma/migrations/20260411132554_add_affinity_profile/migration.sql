-- AlterTable
ALTER TABLE "result" ADD COLUMN     "affinityProfile" JSONB,
ADD COLUMN     "campaignFitScore" DOUBLE PRECISION,
ADD COLUMN     "platformId" TEXT;
