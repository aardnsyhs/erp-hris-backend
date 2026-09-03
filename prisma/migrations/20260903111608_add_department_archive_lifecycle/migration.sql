-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");
