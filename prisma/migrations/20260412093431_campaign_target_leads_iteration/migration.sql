-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "maxIterations" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "targetLeads" INTEGER NOT NULL DEFAULT 2000;

-- AlterTable
ALTER TABLE "kh_set" ADD COLUMN     "iterationNumber" INTEGER NOT NULL DEFAULT 1;
