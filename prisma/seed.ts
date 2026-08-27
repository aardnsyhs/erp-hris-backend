import 'dotenv/config';
import {
  AttendanceStatus,
  EmployeeStatus,
  LeaveRequestStatus,
  LeaveType,
  PayrollStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Starting HRIS & ERP Database Seeding ---');

  // 1. Departments
  console.log('1. Seeding Departments...');
  const engDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: { name: 'Engineering' },
    create: {
      code: 'ENG',
      name: 'Engineering',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: { name: 'Human Resources' },
    create: {
      code: 'HR',
      name: 'Human Resources',
    },
  });

  console.log(`- Created/Verified Departments: ENG (${engDept.id}), HR (${hrDept.id})`);

  // 1.1 Work Schedule (Singleton)
  console.log('1.1 Seeding Default Work Schedule...');
  const defaultSchedule = await prisma.workSchedule.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      startTime: '09:00',
      lateToleranceMinutes: 15,
      standardWorkMinutes: 480,
      isActive: true,
    },
  });
  console.log(`- Verified Active Work Schedule (Start: ${defaultSchedule.startTime}, Tolerance: ${defaultSchedule.lateToleranceMinutes}m, Target: ${defaultSchedule.standardWorkMinutes}m)`);

  // 2. Password Hash for Users
  const devPassword = 'password123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(devPassword, saltRounds);

  // 3. Employees & Users
  console.log('2. Seeding Employees and Users (5 employees across HR_ADMIN, MANAGER, EMPLOYEE)...');

  // 3.1 HR Admin (Budi Santoso)
  const empAdmin = await prisma.employee.upsert({
    where: { email: 'admin.hr@example.com' },
    update: {
      departmentId: hrDept.id,
      nip: 'EMP-HR-001',
      fullName: 'Budi Santoso',
      phone: '+6281234567801',
      jobTitle: 'HR Director & System Admin',
      baseSalary: new Prisma.Decimal(15000000.0),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      departmentId: hrDept.id,
      nip: 'EMP-HR-001',
      fullName: 'Budi Santoso',
      email: 'admin.hr@example.com',
      phone: '+6281234567801',
      jobTitle: 'HR Director & System Admin',
      hireDate: new Date('2023-01-01'),
      baseSalary: new Prisma.Decimal(15000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin.hr@example.com' },
    update: {
      employeeId: empAdmin.id,
      role: UserRole.HR_ADMIN,
      passwordHash,
    },
    create: {
      email: 'admin.hr@example.com',
      passwordHash,
      role: UserRole.HR_ADMIN,
      isActive: true,
      employeeId: empAdmin.id,
    },
  });

  // 3.2 Engineering Manager (Hendra Pratama)
  const empManager = await prisma.employee.upsert({
    where: { email: 'manager.eng@example.com' },
    update: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-001',
      fullName: 'Hendra Pratama',
      phone: '+6281234567802',
      jobTitle: 'Engineering Manager',
      baseSalary: new Prisma.Decimal(20000000.0),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-001',
      fullName: 'Hendra Pratama',
      email: 'manager.eng@example.com',
      phone: '+6281234567802',
      jobTitle: 'Engineering Manager',
      hireDate: new Date('2023-03-01'),
      baseSalary: new Prisma.Decimal(20000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager.eng@example.com' },
    update: {
      employeeId: empManager.id,
      role: UserRole.MANAGER,
      passwordHash,
    },
    create: {
      email: 'manager.eng@example.com',
      passwordHash,
      role: UserRole.MANAGER,
      isActive: true,
      employeeId: empManager.id,
    },
  });

  // 3.3 Senior Developer (Andi Wijaya)
  const empAndi = await prisma.employee.upsert({
    where: { email: 'dev.andi@example.com' },
    update: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-002',
      fullName: 'Andi Wijaya',
      phone: '+6281234567803',
      jobTitle: 'Senior Software Engineer',
      baseSalary: new Prisma.Decimal(12000000.0),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-002',
      fullName: 'Andi Wijaya',
      email: 'dev.andi@example.com',
      phone: '+6281234567803',
      jobTitle: 'Senior Software Engineer',
      hireDate: new Date('2023-06-01'),
      baseSalary: new Prisma.Decimal(12000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dev.andi@example.com' },
    update: {
      employeeId: empAndi.id,
      role: UserRole.EMPLOYEE,
      passwordHash,
    },
    create: {
      email: 'dev.andi@example.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      isActive: true,
      employeeId: empAndi.id,
    },
  });

  // 3.4 Frontend Developer (Siti Rahma)
  const empSiti = await prisma.employee.upsert({
    where: { email: 'dev.siti@example.com' },
    update: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-003',
      fullName: 'Siti Rahma',
      phone: '+6281234567804',
      jobTitle: 'Frontend Engineer',
      baseSalary: new Prisma.Decimal(10000000.0),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      departmentId: engDept.id,
      nip: 'EMP-ENG-003',
      fullName: 'Siti Rahma',
      email: 'dev.siti@example.com',
      phone: '+6281234567804',
      jobTitle: 'Frontend Engineer',
      hireDate: new Date('2024-01-15'),
      baseSalary: new Prisma.Decimal(10000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'dev.siti@example.com' },
    update: {
      employeeId: empSiti.id,
      role: UserRole.EMPLOYEE,
      passwordHash,
    },
    create: {
      email: 'dev.siti@example.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      isActive: true,
      employeeId: empSiti.id,
    },
  });

  // 3.5 HR Staff (Rian Hidayat)
  const empRian = await prisma.employee.upsert({
    where: { email: 'hr.rian@example.com' },
    update: {
      departmentId: hrDept.id,
      nip: 'EMP-HR-002',
      fullName: 'Rian Hidayat',
      phone: '+6281234567805',
      jobTitle: 'HR Operations Officer',
      baseSalary: new Prisma.Decimal(8000000.0),
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      departmentId: hrDept.id,
      nip: 'EMP-HR-002',
      fullName: 'Rian Hidayat',
      email: 'hr.rian@example.com',
      phone: '+6281234567805',
      jobTitle: 'HR Operations Officer',
      hireDate: new Date('2024-02-01'),
      baseSalary: new Prisma.Decimal(8000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { email: 'hr.rian@example.com' },
    update: {
      employeeId: empRian.id,
      role: UserRole.EMPLOYEE,
      passwordHash,
    },
    create: {
      email: 'hr.rian@example.com',
      passwordHash,
      role: UserRole.EMPLOYEE,
      isActive: true,
      employeeId: empRian.id,
    },
  });

  console.log('Users & Employees seeded successfully.');

  // 4. Attendances
  console.log('3. Seeding Attendances (PRESENT, LATE, ABSENT)...');
  const attendanceDate = new Date(Date.UTC(2026, 7, 25)); // 2026-08-25

  // Andi - PRESENT
  await prisma.attendance.upsert({
    where: {
      employeeId_attendanceDate: {
        employeeId: empAndi.id,
        attendanceDate,
      },
    },
    update: {},
    create: {
      employeeId: empAndi.id,
      attendanceDate,
      checkIn: new Date('2026-08-25T08:00:00.000Z'),
      checkOut: new Date('2026-08-25T17:05:00.000Z'),
      status: AttendanceStatus.PRESENT,
      notes: 'WFO - Kantor Pusat',
    },
  });

  // Siti - LATE
  await prisma.attendance.upsert({
    where: {
      employeeId_attendanceDate: {
        employeeId: empSiti.id,
        attendanceDate,
      },
    },
    update: {},
    create: {
      employeeId: empSiti.id,
      attendanceDate,
      checkIn: new Date('2026-08-25T09:35:00.000Z'),
      checkOut: new Date('2026-08-25T18:30:00.000Z'),
      status: AttendanceStatus.LATE,
      notes: 'Macet di jalan tol lingkar dalam',
    },
  });

  // Rian - ABSENT
  await prisma.attendance.upsert({
    where: {
      employeeId_attendanceDate: {
        employeeId: empRian.id,
        attendanceDate,
      },
    },
    update: {},
    create: {
      employeeId: empRian.id,
      attendanceDate,
      checkIn: null,
      checkOut: null,
      status: AttendanceStatus.ABSENT,
      notes: 'Tanpa konfirmasi kehadiran',
    },
  });

  console.log('Attendances seeded successfully.');

  // 5. Leave Requests (PENDING, APPROVED, REJECTED, and additional APPROVED)
  console.log('4. Seeding Leave Requests (PENDING, APPROVED, REJECTED)...');

  // 5.1 Andi - PENDING
  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-pending-1' },
    update: {},
    create: {
      id: 'seed-leave-pending-1',
      employeeId: empAndi.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date(Date.UTC(2026, 8, 1)), // 2026-09-01
      endDate: new Date(Date.UTC(2026, 8, 3)),   // 2026-09-03
      status: LeaveRequestStatus.PENDING,
      reason: 'Liburan keluarga tahunan ke luar kota',
    },
  });

  // 5.2 Siti - APPROVED (Approved by Hendra)
  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-approved-1' },
    update: {},
    create: {
      id: 'seed-leave-approved-1',
      employeeId: empSiti.id,
      approvedBy: empManager.id,
      leaveType: LeaveType.SICK,
      startDate: new Date(Date.UTC(2026, 7, 10)), // 2026-08-10
      endDate: new Date(Date.UTC(2026, 7, 11)),   // 2026-08-11
      status: LeaveRequestStatus.APPROVED,
      reason: 'Demam dan flu (surat dokter terlampir)',
      approvedAt: new Date('2026-08-09T10:00:00.000Z'),
    },
  });

  // 5.3 Rian - REJECTED (Rejected by Budi)
  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-rejected-1' },
    update: {},
    create: {
      id: 'seed-leave-rejected-1',
      employeeId: empRian.id,
      approvedBy: empAdmin.id,
      leaveType: LeaveType.UNPAID,
      startDate: new Date(Date.UTC(2026, 7, 15)), // 2026-08-15
      endDate: new Date(Date.UTC(2026, 7, 18)),   // 2026-08-18
      status: LeaveRequestStatus.REJECTED,
      reason: 'Keperluan mendadak di luar kota',
      rejectionReason: 'Kapasitas tim HR sedang padat karena periode audit tahunan',
      approvedAt: new Date('2026-08-14T14:30:00.000Z'),
    },
  });

  // 5.4 Andi - APPROVED (Future approved leave for overlap testing)
  await prisma.leaveRequest.upsert({
    where: { id: 'seed-leave-approved-2' },
    update: {},
    create: {
      id: 'seed-leave-approved-2',
      employeeId: empAndi.id,
      approvedBy: empManager.id,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date(Date.UTC(2026, 9, 5)),  // 2026-10-05
      endDate: new Date(Date.UTC(2026, 9, 7)),    // 2026-10-07
      status: LeaveRequestStatus.APPROVED,
      reason: 'Menghadiri acara pernikahan keluarga',
      approvedAt: new Date('2026-08-20T09:00:00.000Z'),
    },
  });

  console.log('Leave Requests seeded successfully.');

  // 6. Payrolls (DRAFT, PROCESSED, PAID, and Negative netSalary)
  console.log('5. Seeding Payrolls (DRAFT, PROCESSED, PAID, Negative Net)...');
  const periodStart = new Date(Date.UTC(2026, 7, 1));  // 2026-08-01
  const periodEnd = new Date(Date.UTC(2026, 7, 31));   // 2026-08-31

  // 6.1 Andi - DRAFT
  await prisma.payroll.upsert({
    where: {
      employeeId_periodStart_periodEnd: {
        employeeId: empAndi.id,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      employeeId: empAndi.id,
      periodStart,
      periodEnd,
      basicSalary: new Prisma.Decimal(12000000.0),
      allowances: new Prisma.Decimal(2000000.0),
      deductions: new Prisma.Decimal(500000.0),
      netSalary: new Prisma.Decimal(13500000.0),
      status: PayrollStatus.DRAFT,
    },
  });

  // 6.2 Siti - PROCESSED
  await prisma.payroll.upsert({
    where: {
      employeeId_periodStart_periodEnd: {
        employeeId: empSiti.id,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      employeeId: empSiti.id,
      periodStart,
      periodEnd,
      basicSalary: new Prisma.Decimal(10000000.0),
      allowances: new Prisma.Decimal(1500000.0),
      deductions: new Prisma.Decimal(300000.0),
      netSalary: new Prisma.Decimal(11200000.0),
      status: PayrollStatus.PROCESSED,
    },
  });

  // 6.3 Hendra - PAID (with paymentDate in the past: 2026-08-20)
  await prisma.payroll.upsert({
    where: {
      employeeId_periodStart_periodEnd: {
        employeeId: empManager.id,
        periodStart,
        periodEnd,
      },
    },
    update: {
      status: PayrollStatus.PAID,
      paymentDate: new Date(Date.UTC(2026, 7, 20)), // 2026-08-20
    },
    create: {
      employeeId: empManager.id,
      periodStart,
      periodEnd,
      basicSalary: new Prisma.Decimal(20000000.0),
      allowances: new Prisma.Decimal(5000000.0),
      deductions: new Prisma.Decimal(1000000.0),
      netSalary: new Prisma.Decimal(24000000.0),
      status: PayrollStatus.PAID,
      paymentDate: new Date(Date.UTC(2026, 7, 20)), // 2026-08-20
    },
  });

  // 6.4 Rian - Negative netSalary (DRAFT edge case for FE UI testing)
  await prisma.payroll.upsert({
    where: {
      employeeId_periodStart_periodEnd: {
        employeeId: empRian.id,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      employeeId: empRian.id,
      periodStart,
      periodEnd,
      basicSalary: new Prisma.Decimal(8000000.0),
      allowances: new Prisma.Decimal(500000.0),
      deductions: new Prisma.Decimal(10000000.0),
      netSalary: new Prisma.Decimal(-1500000.0), // 8.5M - 10M = -1.5M
      status: PayrollStatus.DRAFT,
    },
  });

  console.log('Payrolls seeded successfully.');
  console.log('--- All Seed Data Successfully Planted! ---');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
