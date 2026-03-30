-- CreateTable
CREATE TABLE "document_analysis_cache" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "analysis" TEXT NOT NULL,
    "documentContent" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_analysis_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_analysis_cache_filename_fileSize_key" ON "document_analysis_cache"("filename", "fileSize");
