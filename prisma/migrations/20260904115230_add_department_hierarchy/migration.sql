-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_level_idx" ON "departments"("level");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing departments as root level 0
UPDATE "departments" SET "level" = 0, "parent_id" = NULL WHERE "parent_id" IS NULL;

