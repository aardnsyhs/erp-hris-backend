-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "late_tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
    "standard_work_minutes" INTEGER NOT NULL DEFAULT 480,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);
