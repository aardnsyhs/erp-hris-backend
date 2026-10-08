import { PrismaClient, EmployeeStatus } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const employees = await prisma.employee.findMany();
  for (const emp of employees) {
    const isActive = emp.status === EmployeeStatus.ACTIVE;
    await prisma.user.updateMany({
      where: { employeeId: emp.id },
      data: { isActive }
    });
  }
  console.log('Done syncing statuses');
}
main().finally(() => prisma.$disconnect());
