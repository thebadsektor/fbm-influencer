-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "enrichAfterRounds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "enrichmentBudget" DOUBLE PRECISION;
