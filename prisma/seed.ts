import 'dotenv/config';
import {
  AssignmentType,
  AttendanceStatus,
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
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { fakerID_ID, fakerEN } from '@faker-js/faker';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Starting HRIS & ERP Database Seeding with Faker ---');

  // Clear existing data (optional, but good for clean seeder)
  console.log('Clearing existing data...');
  await prisma.payroll.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.employeeMovementHistory.deleteMany();
  await prisma.employeeReportingLine.deleteMany();
  await prisma.employeePositionAssignment.deleteMany();
  await prisma.employmentContract.deleteMany();
  await prisma.employeeEmergencyContact.deleteMany();
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
  
  const depts: any[] = [];
  for (const d of deptData) {
    const dept = await prisma.department.create({
      data: d,
    });
    depts.push(dept);
  }
  const engDept = depts.find(d => d.code === 'ENG')!;
  const hrDept = depts.find(d => d.code === 'HR')!;

  // 2. Positions
  console.log('2. Seeding Positions...');
  const positionsData = [
    { code: 'DIR', title: 'Director', level: 1 },
    { code: 'MGR', title: 'Manager', level: 2 },
    { code: 'TL', title: 'Team Lead', level: 3 },
    { code: 'SNR', title: 'Senior Staff', level: 4 },
    { code: 'JNR', title: 'Junior Staff', level: 5 },
  ];
  const positions: any[] = [];
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

  const allEmployees: any[] = [];
  let adminUserId: string = '';

  for (const cu of coreUsers) {
    const d = depts.find(dept => dept.code === cu.deptCode)!;
    const p = positions.find(pos => pos.code === cu.posCode)!;
    
    const emp = await prisma.employee.create({
      data: {
        departmentId: d.id,
        nip: cu.nip,
        fullName: cu.fullName,
        email: cu.email,
        phone: cu.phone,
        jobTitle: cu.jobTitle,
        hireDate: new Date('2023-01-01'),
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
        effectiveFrom: new Date('2023-01-01'),
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
        startDate: new Date('2023-01-01'),
        status: ContractStatus.ACTIVE,
      }
    });

    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId: emp.id,
        name: fakerID_ID.person.fullName(),
        relationship: fakerEN.helpers.arrayElement(['Spouse', 'Parent', 'Sibling']),
        phone: fakerID_ID.phone.number(),
        isPrimary: true,
      }
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
      }
    });

    await prisma.employeeMovementHistory.create({
      data: {
        employeeId: emp.id,
        movementType: MovementType.HIRE,
        toPositionId: p.id,
        toDepartmentId: d.id,
        effectiveDate: new Date('2023-01-01'),
        reason: 'New Hire',
        performedById: adminUserId || user.id,
      }
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
      }
    });
  }

  // Generate 20 more random employees
  console.log('Generating additional random employees...');
  for (let i = 0; i < 20; i++) {
    const d = fakerEN.helpers.arrayElement(depts);
    const p = fakerEN.helpers.arrayElement(positions);
    const fullName = fakerID_ID.person.fullName();
    const email = fakerEN.internet.email({ firstName: fullName.split(' ')[0], lastName: fullName.split(' ')[1] }).toLowerCase();
    
    const emp = await prisma.employee.create({
      data: {
        departmentId: d.id,
        nip: `EMP-RND-${String(i+1).padStart(3, '0')}`,
        fullName: fullName,
        email: email,
        phone: fakerID_ID.phone.number(),
        jobTitle: `${d.name} ${p.title}`,
        hireDate: fakerEN.date.past({ years: 2 }),
        baseSalary: new Prisma.Decimal(fakerEN.number.int({ min: 50, max: 200 }) * 100000),
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
        contractType: fakerEN.helpers.arrayElement([ContractType.PERMANENT, ContractType.CONTRACT]),
        contractNumber: `CTR-RND-${String(i+1).padStart(3, '0')}`,
        startDate: emp.hireDate,
        endDate: fakerEN.date.future({ years: 1 }),
        status: ContractStatus.ACTIVE,
      }
    });

    await prisma.employeeEmergencyContact.create({
      data: {
        employeeId: emp.id,
        name: fakerID_ID.person.fullName(),
        relationship: fakerEN.helpers.arrayElement(['Spouse', 'Parent', 'Sibling']),
        phone: fakerID_ID.phone.number(),
        isPrimary: true,
      }
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
      }
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
      }
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
      }
    });
  }

  // Generate Reporting Lines (Managers for Employees)
  const managerAndi = allEmployees.find(e => e.email === 'manager.eng@example.com')!;
  const employeesToReport = allEmployees.filter(e => e.email !== 'manager.eng@example.com' && e.email !== 'admin.hr@example.com');
  for (const e of employeesToReport) {
    await prisma.employeeReportingLine.create({
      data: {
        employeeId: e.id,
        managerId: managerAndi.id,
        effectiveFrom: e.hireDate,
        isPrimary: true,
      }
    });
  }

  // Generate Attendances (August 26, 2026 to October 8, 2026)
  console.log('5. Seeding Attendances...');
  const startDate = new Date(Date.UTC(2026, 7, 26)); // Aug 26, 2026
  const endDate = new Date(Date.UTC(2026, 9, 8)); // Oct 8, 2026
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;

    for (const emp of allEmployees) {
      const isLate = Math.random() > 0.8;
      const isAbsent = Math.random() > 0.95;
      
      const checkInHour = isLate ? fakerEN.number.int({ min: 9, max: 10 }) : 8;
      const checkInMinute = fakerEN.number.int({ min: 0, max: 59 });
      
      const checkOutHour = fakerEN.number.int({ min: 17, max: 19 });
      const checkOutMinute = fakerEN.number.int({ min: 0, max: 59 });

      const checkInDate = new Date(d);
      checkInDate.setUTCHours(checkInHour, checkInMinute, 0, 0);

      const checkOutDate = new Date(d);
      checkOutDate.setUTCHours(checkOutHour, checkOutMinute, 0, 0);

      await prisma.attendance.create({
        data: {
          employeeId: emp.id,
          attendanceDate: new Date(d),
          checkIn: isAbsent ? null : checkInDate,
          checkOut: isAbsent ? null : checkOutDate,
          status: isAbsent ? AttendanceStatus.ABSENT : (isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT),
          notes: isAbsent ? 'Did not show up' : (isLate ? 'Traffic jam' : 'On time'),
        }
      });
    }
  }

  // Generate Leave Requests
  console.log('6. Seeding Leave Requests...');
  for (let i = 0; i < 30; i++) {
    const emp = fakerEN.helpers.arrayElement(allEmployees);
    const startLeave = fakerEN.date.between({ from: '2026-08-26', to: '2026-10-08' });
    const endLeave = new Date(startLeave);
    endLeave.setDate(startLeave.getDate() + fakerEN.number.int({ min: 0, max: 3 }));
    const status = fakerEN.helpers.arrayElement([LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING, LeaveRequestStatus.REJECTED]);
    
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp.id,
        leaveType: fakerEN.helpers.arrayElement([LeaveType.ANNUAL, LeaveType.SICK]),
        startDate: startLeave,
        endDate: endLeave,
        status: status,
        reason: fakerEN.lorem.sentence(),
        approvedBy: status !== LeaveRequestStatus.PENDING ? managerAndi.id : null,
        approvedAt: status !== LeaveRequestStatus.PENDING ? new Date() : null,
        rejectionReason: status === LeaveRequestStatus.REJECTED ? fakerEN.lorem.sentence() : null,
      }
    });
  }

  // Generate Payrolls for August and September 2026
  console.log('7. Seeding Payrolls...');
  const periods = [
    { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 7, 31)) }, // August
    { start: new Date(Date.UTC(2026, 8, 1)), end: new Date(Date.UTC(2026, 8, 30)) }, // September
  ];

  for (const period of periods) {
    for (const emp of allEmployees) {
      const basicSalary = Number(emp.baseSalary.toString());
      const allowances = fakerEN.number.int({ min: 5, max: 20 }) * 100000;
      const deductions = fakerEN.number.int({ min: 1, max: 5 }) * 100000;
      const netSalary = basicSalary + allowances - deductions;
      
      const status = fakerEN.helpers.arrayElement([PayrollStatus.PAID, PayrollStatus.PROCESSED]);
      
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
          paymentDate: status === PayrollStatus.PAID ? new Date(period.end.getTime() + 86400000 * 5) : null,
        }
      });
    }
  }

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
