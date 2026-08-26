import "dotenv/config";
import { PrismaClient, UserRole, EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding initial HRIS core data...');

  // 1. Upsert Departments
  const engineeringDept = await prisma.department.upsert({
    where: { code: 'ENG' },
    update: {},
    create: {
      code: 'ENG',
      name: 'Engineering',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      code: 'HR',
      name: 'Human Resources',
    },
  });

  console.log('Departments seeded:', {
    engineering: engineeringDept.id,
    hr: hrDept.id,
  });

  // 2. Upsert Employee (HR Admin profile)
  const hrEmployee = await prisma.employee.upsert({
    where: { nip: 'EMP-2026-0001' },
    update: {
      departmentId: hrDept.id,
    },
    create: {
      departmentId: hrDept.id,
      nip: 'EMP-2026-0001',
      fullName: 'HR Administrator',
      email: 'admin.hr@example.com',
      phone: '+6281234567890',
      jobTitle: 'HR Manager & System Admin',
      hireDate: new Date('2026-01-01'),
      baseSalary: new Prisma.Decimal(15000000.0),
      status: EmployeeStatus.ACTIVE,
    },
  });

  console.log('Employee seeded:', hrEmployee.id);

  // 3. Upsert User (HR_ADMIN credential)
  // WARNING: 'password123' is strictly for LOCAL DEVELOPMENT and testing purposes.
  // DO NOT use this password or seed script in production environments.
  const devPassword = 'password123';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(devPassword, saltRounds);

  const hrUser = await prisma.user.upsert({
    where: { email: 'admin.hr@example.com' },
    update: {
      employeeId: hrEmployee.id,
    },
    create: {
      email: 'admin.hr@example.com',
      passwordHash,
      role: UserRole.HR_ADMIN,
      isActive: true,
      employeeId: hrEmployee.id,
    },
  });

  console.log('User seeded:', hrUser.id);
  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
