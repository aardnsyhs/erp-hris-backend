import 'dotenv/config';
import {
  AssignmentType,
  ContractStatus,
  ContractType,
  EmployeeStatus,
  LeaveRequestStatus,
  LeaveType,
  MovementType,
  PayrollStatus,
  Prisma,
  PrismaClient,
  UserRole,
  DocumentType,
  ScanStatus,
  Department,
  Employee,
  Position,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { fakerID_ID, fakerEN } from '@faker-js/faker';
import {
  addCalendarDays,
  getWibDate,
  parseTimeString,
} from '../src/common/utils/timezone.util';
import {
  seedDatabaseUrl,
  demoAttendance,
  demoPeriods,
  demoLeaveDates,
  DEMO_CONTRACT_OFFSETS,
  DEMO_PAYROLL_STATUSES,
} from './seed-data';

const adapter = new PrismaPg({
  connectionString: seedDatabaseUrl(process.env),
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const today = getWibDate(now);
  fakerEN.seed(20261008);
  fakerID_ID.seed(20261008);
  fakerEN.setDefaultRefDate(now);
  fakerID_ID.setDefaultRefDate(now);
  console.log('--- Starting HRIS & ERP Database Seeding with Faker ---');

  // Clear existing data (optional, but good for clean seeder)
  console.log('Clearing existing data...');
  await prisma.payroll.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.employeeMovementHistory.deleteMany();
  await prisma.employeeReportingLine.deleteMany();
  await prisma.employeePositionAssignment.deleteMany();
  await prisma.employmentContract.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.employeeEmergencyContact.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.workSchedule.deleteMany();

  // 1. Departments
  console.log('1. Seeding Departments...');
  const deptData = [
    { code: 'ENG', name: 'Engineering' },
    { code: 'HR', name: 'Human Resources' },
    { code: 'FIN', name: 'Finance' },
    { code: 'MKT', name: 'Marketing' },
    { code: 'SAL', name: 'Sales' },
    { code: 'OPS', name: 'Operations' },
  ];

  const depts: Department[] = [];
  for (const d of deptData) {
    const dept = await prisma.department.create({
      data: d,
    });
    depts.push(dept);
  }

  // 2. Positions
  console.log('2. Seeding Positions...');
  const positionsData = [
    { code: 'DIR', title: 'Director', level: 1 },
    { code: 'MGR', title: 'Manager', level: 2 },
    { code: 'TL', title: 'Team Lead', level: 3 },
    { code: 'SNR', title: 'Senior Staff', level: 4 },
    { code: 'JNR', title: 'Junior Staff', level: 5 },
  ];
  const positions: Position[] = [];
  for (const p of positionsData) {
    const pos = await prisma.position.create({
      data: p,
    });
    positions.push(pos);
  }

  // 1.1 Work Schedule
  console.log('3. Seeding Default Work Schedule...');
  const defaultSchedule = await prisma.workSchedule.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      startTime: '09:00',
      lateToleranceMinutes: 15,
      standardWorkMinutes: 480,
      isActive: true,
    },
  });

  // Password Hash
  const devPassword = 'password123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(devPassword, saltRounds);

  // 3. Employees & Users
  console.log('4. Seeding Core Users & Generated Employees...');

  const coreUsers = [
    {
      email: 'admin.hr@example.com',
      nip: 'EMP-HR-001',
      fullName: 'Budi Santoso',
      phone: '+6281234567801',
      jobTitle: 'HR Director & System Admin',
      deptCode: 'HR',
      role: UserRole.HR_ADMIN,
      baseSalary: 15000000.0,
      posCode: 'DIR',
    },
    {
      email: 'manager.eng@example.com',
      nip: 'EMP-ENG-001',
      fullName: 'Hendra Pratama',
      phone: '+6281234567802',
      jobTitle: 'Engineering Manager',
      deptCode: 'ENG',
      role: UserRole.MANAGER,
      baseSalary: 20000000.0,
      posCode: 'MGR',
    },
    {
      email: 'dev.andi@example.com',
      nip: 'EMP-ENG-002',
      fullName: 'Andi Wijaya',
      phone: '+6281234567803',
      jobTitle: 'Senior Software Engineer',
      deptCode: 'ENG',
      role: UserRole.EMPLOYEE,
      baseSalary: 12000000.0,
      posCode: 'SNR',
    },
    {
      email: 'dev.siti@example.com',
      nip: 'EMP-ENG-003',
      fullName: 'Siti Rahma',
      phone: '+6281234567804',
      jobTitle: 'Frontend Engineer',
      deptCode: 'ENG',
      role: UserRole.EMPLOYEE,
      baseSalary: 10000000.0,
      posCode: 'JNR',
    },
    {
      email: 'hr.rian@example.com',
      nip: 'EMP-HR-002',
      fullName: 'Rian Hidayat',
      phone: '+6281234567805',
      jobTitle: 'HR Operations Officer',
      deptCode: 'HR',
      role: UserRole.EMPLOYEE,
      baseSalary: 8000000.0,
      posCode: 'JNR',
    },
  ];

  const allEmployees: Employee[] = [];
  let adminUserId: string = '';

  for (const cu of coreUsers) {
    const d = depts.find((dept) => dept.code === cu.deptCode)!;
    const p = positions.find((pos) => pos.code === cu.posCode)!;

    const emp = await prisma.employee.create({
      data: {
        departmentId: d.id,
        nip: cu.nip,
        fullName: cu.fullName,
        email: cu.email,
        phone: cu.phone,
        jobTitle: cu.jobTitle,
        hireDate: addCalendarDays(today, -1000),
        baseSalary: new Prisma.Decimal(cu.baseSalary),
        status: EmployeeStatus.ACTIVE,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: cu.email,
        passwordHash,
        role: cu.role,
        isActive: true,
        employeeId: emp.id,
      },
    });

    if (cu.role === UserRole.HR_ADMIN) {
      adminUserId = user.id;
    }

    allEmployees.push(emp);

    await prisma.employeePositionAssignment.create({
      data: {
        employeeId: emp.id,
        positionId: p.id,
        departmentId: d.id,
        effectiveFrom: emp.hireDate,
        assignmentType: AssignmentType.INITIAL,
        assignedById: adminUserId || user.id,
        notes: 'Initial Assignment',
      },
    });

    await prisma.employmentContract.create({
      data: {
        employeeId: emp.id,
        contractType: ContractType.PERMANENT,
        contractNumber: `CTR-${cu.nip}`,
        startDate: emp.hireDate,
        status: ContractStatus.ACTIVE,
      },
    });

    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId: emp.id,
        name: fakerID_ID.person.fullName(),
        relationship: fakerEN.helpers.arrayElement([
          'Spouse',
          'Parent',
          'Sibling',
        ]),
        phone: fakerID_ID.phone.number(),
        isPrimary: true,
      },
    });

    await prisma.employeeDocument.create({
      data: {
        employeeId: emp.id,
        documentType: DocumentType.KTP,
        title: 'KTP Card',
        fileName: 'ktp.pdf',
        storagePath: '/documents/ktp.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: fakerEN.number.int({ min: 100000, max: 2000000 }),
        uploadedById: adminUserId || user.id,
        scanStatus: ScanStatus.CLEAN,
      },
    });

    await prisma.employeeMovementHistory.create({
      data: {
        employeeId: emp.id,
        movementType: MovementType.HIRE,
        toPositionId: p.id,
        toDepartmentId: d.id,
        effectiveDate: emp.hireDate,
        reason: 'New Hire',
        performedById: adminUserId || user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminUserId || user.id,
        actorEmail: cu.email,
        actorRole: cu.role,
        action: 'CREATE_EMPLOYEE',
        entity: 'Employee',
        entityId: emp.id,
        source: 'SYSTEM_SEEDER',
      },
    });
  }

  // Generate 20 more random employees
  console.log('Generating additional random employees...');
  for (let i = 0; i < 20; i++) {
    const d = fakerEN.helpers.arrayElement(depts);
    const p = fakerEN.helpers.arrayElement(positions);
    const fullName = fakerID_ID.person.fullName();
    const email = fakerEN.internet
      .email({
        firstName: fullName.split(' ')[0],
        lastName: fullName.split(' ')[1],
      })
      .toLowerCase();

    const emp = await prisma.employee.create({
      data: {
        departmentId: d.id,
        nip: `EMP-RND-${String(i + 1).padStart(3, '0')}`,
        fullName: fullName,
        email: email,
        phone: fakerID_ID.phone.number(),
        jobTitle: `${d.name} ${p.title}`,
        hireDate: addCalendarDays(
          today,
          -fakerEN.number.int({ min: 120, max: 1000 }),
        ),
        baseSalary: new Prisma.Decimal(
          fakerEN.number.int({ min: 50, max: 200 }) * 100000,
        ),
        status: EmployeeStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        email: email,
        passwordHash,
        role: UserRole.EMPLOYEE,
        isActive: true,
        employeeId: emp.id,
      },
    });
    allEmployees.push(emp);

    await prisma.employeePositionAssignment.create({
      data: {
        employeeId: emp.id,
        positionId: p.id,
        departmentId: d.id,
        effectiveFrom: emp.hireDate,
        assignmentType: AssignmentType.INITIAL,
        assignedById: adminUserId,
      },
    });

    await prisma.employmentContract.create({
      data: {
        employeeId: emp.id,
        contractType:
          i < 5 || i % 2 === 0 ? ContractType.CONTRACT : ContractType.PERMANENT,
        contractNumber: `CTR-RND-${String(i + 1).padStart(3, '0')}`,
        startDate: emp.hireDate,
        endDate:
          i >= 5 && i % 2 !== 0
            ? null
            : addCalendarDays(
                today,
                DEMO_CONTRACT_OFFSETS[i] ??
                  fakerEN.number.int({ min: 60, max: 365 }),
              ),
        status: ContractStatus.ACTIVE,
      },
    });

    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId: emp.id,
        name: fakerID_ID.person.fullName(),
        relationship: fakerEN.helpers.arrayElement([
          'Spouse',
          'Parent',
          'Sibling',
        ]),
        phone: fakerID_ID.phone.number(),
        isPrimary: true,
      },
    });

    await prisma.employeeDocument.create({
      data: {
        employeeId: emp.id,
        documentType: DocumentType.KTP,
        title: 'KTP Card',
        fileName: 'ktp.pdf',
        storagePath: '/documents/ktp.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: fakerEN.number.int({ min: 100000, max: 2000000 }),
        uploadedById: adminUserId,
        scanStatus: ScanStatus.CLEAN,
      },
    });

    await prisma.employeeMovementHistory.create({
      data: {
        employeeId: emp.id,
        movementType: MovementType.HIRE,
        toPositionId: p.id,
        toDepartmentId: d.id,
        effectiveDate: emp.hireDate,
        reason: 'New Hire',
        performedById: adminUserId,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorEmail: 'admin.hr@example.com',
        actorRole: UserRole.HR_ADMIN,
        action: 'CREATE_EMPLOYEE',
        entity: 'Employee',
        entityId: emp.id,
        source: 'SYSTEM_SEEDER',
      },
    });
  }

  // Generate Reporting Lines (Managers for Employees)
  const managerAndi = allEmployees.find(
    (e) => e.email === 'manager.eng@example.com',
  )!;
  const employeesToReport = allEmployees.filter(
    (e) =>
      e.departmentId === managerAndi.departmentId && e.id !== managerAndi.id,
  );
  for (const e of employeesToReport) {
    await prisma.employeeReportingLine.create({
      data: {
        employeeId: e.id,
        managerId: managerAndi.id,
        effectiveFrom:
          e.hireDate > managerAndi.hireDate ? e.hireDate : managerAndi.hireDate,
        isPrimary: true,
      },
    });
  }

  // Generate recent attendance using the same WIB classification as check-in.
  console.log('5. Seeding Attendances...');
  const startDate = addCalendarDays(today, -44);
  const endDate = today;

  for (let d = new Date(startDate); d <= endDate; d = addCalendarDays(d, 1)) {
    // Skip weekends
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

    for (const emp of allEmployees) {
      if (d < emp.hireDate) continue;
      const startMinutes = parseTimeString(
        defaultSchedule.startTime,
      ).totalMinutes;
      const record = demoAttendance(
        d,
        now,
        defaultSchedule,
        fakerEN.number.int({ min: 1, max: 20 }) === 1,
        startMinutes + fakerEN.number.int({ min: -30, max: 60 }),
      );
      if (!record) continue;

      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          ...record,
        },
      });
    }
  }

  // Generate Leave Requests
  console.log('6. Seeding Leave Requests...');
  for (let i = 0; i < 30; i++) {
    const emp = allEmployees[2 + (i % (allEmployees.length - 2))];
    const { start: startLeave, end: endLeave } = demoLeaveDates(today, i);
    const status =
      i < 2
        ? LeaveRequestStatus.PENDING
        : [
            LeaveRequestStatus.APPROVED,
            LeaveRequestStatus.PENDING,
            LeaveRequestStatus.REJECTED,
          ][i % 3];
    const adminEmployee = allEmployees[0];
    const approver =
      emp.departmentId === managerAndi.departmentId && emp.id !== managerAndi.id
        ? managerAndi
        : adminEmployee;

    await prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        leaveType: fakerEN.helpers.arrayElement([
          LeaveType.ANNUAL,
          LeaveType.SICK,
        ]),
        startDate: startLeave,
        endDate: endLeave,
        status: status,
        reason: 'Requested time off for a personal appointment.',
        approvedBy: status !== LeaveRequestStatus.PENDING ? approver.id : null,
        approvedAt: status !== LeaveRequestStatus.PENDING ? now : null,
        createdAt: new Date(startLeave.getTime() - 7 * 86400000),
        rejectionReason:
          status === LeaveRequestStatus.REJECTED
            ? 'Requested dates overlap with scheduled team coverage.'
            : null,
      },
    });
    if (status === LeaveRequestStatus.APPROVED) {
      await prisma.attendance.deleteMany({
        where: {
          employeeId: emp.id,
          attendanceDate: { gte: startLeave, lte: endLeave },
        },
      });
    }
  }

  // Two completed calendar months before today's WIB date.
  console.log('7. Seeding Payrolls...');
  const periods = demoPeriods(today);

  for (const period of periods) {
    for (const [index, emp] of allEmployees.entries()) {
      if (period.start < emp.hireDate) continue;
      const basicSalary = Number(emp.baseSalary.toString());
      const allowances = fakerEN.number.int({ min: 5, max: 20 }) * 100000;
      const deductions = fakerEN.number.int({ min: 1, max: 5 }) * 100000;
      const netSalary = basicSalary + allowances - deductions;

      const status = DEMO_PAYROLL_STATUSES[index % 3];

      await prisma.payroll.create({
        data: {
          employeeId: emp.id,
          periodStart: period.start,
          periodEnd: period.end,
          basicSalary: new Prisma.Decimal(basicSalary),
          allowances: new Prisma.Decimal(allowances),
          deductions: new Prisma.Decimal(deductions),
          netSalary: new Prisma.Decimal(netSalary),
          status: status,
          paymentDate: status === PayrollStatus.PAID ? period.end : null,
        },
      });
    }
  }

  console.log('--- All Seed Data Successfully Planted! ---');
}

main()
  .catch(() => {
    console.error(
      'Seeding failed. Check database connectivity and migrations.',
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
