-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT', 'CONTRACT', 'PROBATION', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('INITIAL', 'PROMOTION', 'TRANSFER', 'DEMOTION', 'REORGANIZATION');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('HIRE', 'PROMOTION', 'TRANSFER', 'DEMOTION', 'REORGANIZATION', 'TERMINATION', 'REACTIVATION');

-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "contract_type" "ContractType" NOT NULL,
    "contract_number" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewal_reminder_date" DATE,
    "notes" TEXT,
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_position_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "assignment_type" "AssignmentType" NOT NULL,
    "notes" TEXT,
    "assigned_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_position_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_reporting_lines" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_reporting_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_movement_histories" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "from_position_id" TEXT,
    "to_position_id" TEXT,
    "from_department_id" TEXT,
    "to_department_id" TEXT,
    "effective_date" DATE NOT NULL,
    "reason" TEXT,
    "performed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_movement_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employment_contracts_contract_number_key" ON "employment_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "employment_contracts_employee_id_idx" ON "employment_contracts"("employee_id");

-- CreateIndex
CREATE INDEX "employment_contracts_status_idx" ON "employment_contracts"("status");

-- CreateIndex
CREATE INDEX "employment_contracts_end_date_idx" ON "employment_contracts"("end_date");

-- CreateIndex
CREATE INDEX "employment_contracts_renewal_reminder_date_idx" ON "employment_contracts"("renewal_reminder_date");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_is_active_idx" ON "positions"("is_active");

-- CreateIndex
CREATE INDEX "positions_level_idx" ON "positions"("level");

-- CreateIndex
CREATE INDEX "employee_position_assignments_employee_id_effective_from_idx" ON "employee_position_assignments"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_position_assignments_position_id_idx" ON "employee_position_assignments"("position_id");

-- CreateIndex
CREATE INDEX "employee_position_assignments_department_id_idx" ON "employee_position_assignments"("department_id");

-- CreateIndex
CREATE INDEX "employee_reporting_lines_employee_id_effective_from_idx" ON "employee_reporting_lines"("employee_id", "effective_from");

-- CreateIndex
CREATE INDEX "employee_reporting_lines_manager_id_idx" ON "employee_reporting_lines"("manager_id");

-- CreateIndex
CREATE INDEX "employee_movement_histories_employee_id_effective_date_idx" ON "employee_movement_histories"("employee_id", "effective_date");

-- CreateIndex
CREATE INDEX "employee_movement_histories_movement_type_idx" ON "employee_movement_histories"("movement_type");

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "employee_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_position_assignments" ADD CONSTRAINT "employee_position_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_position_assignments" ADD CONSTRAINT "employee_position_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_position_assignments" ADD CONSTRAINT "employee_position_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_position_assignments" ADD CONSTRAINT "employee_position_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_reporting_lines" ADD CONSTRAINT "employee_reporting_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_reporting_lines" ADD CONSTRAINT "employee_reporting_lines_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_from_position_id_fkey" FOREIGN KEY ("from_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_to_position_id_fkey" FOREIGN KEY ("to_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_from_department_id_fkey" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_to_department_id_fkey" FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movement_histories" ADD CONSTRAINT "employee_movement_histories_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
