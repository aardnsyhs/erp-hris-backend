import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { DepartmentTreeQueryDto } from './dto/department-tree-query.dto';
import { ArchiveDepartmentDto } from './dto/archive-department.dto';
import { RestoreDepartmentDto } from './dto/restore-department.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DepartmentTreeNode } from './interfaces/department-tree-node.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ReparentDepartmentDto } from './dto/reparent-department.dto';
import { DepartmentTraversalUtil } from './utils/department-traversal.util';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    const existingDepartment = await this.departmentRepository.findByCode(
      createDepartmentDto.code,
    );

    if (existingDepartment) {
      throw new ConflictException(
        `Departemen dengan kode '${createDepartmentDto.code}' sudah terdaftar`,
      );
    }

    let level = 0;
    let parentId: string | null = null;

    if (createDepartmentDto.parentId) {
      const parent = await this.departmentRepository.findById(
        createDepartmentDto.parentId,
      );

      if (!parent) {
        throw new NotFoundException('Departemen induk tidak ditemukan');
      }

      if (!parent.isActive) {
        throw new BadRequestException(
          'Tidak dapat menambahkan sub-departemen ke departemen induk yang sedang diarsipkan',
        );
      }

      if (parent.level >= 3) {
        throw new BadRequestException(
          'Batas kedalaman hierarki maksimum (4 level) telah tercapai',
        );
      }

      // Validasi seluruh ancestor chain
      const allDepartments = await this.departmentRepository.findAllMinimal();

      if (allDepartments.length > 0) {
        const { ancestors, hasCycle, hasMissingParent } =
          DepartmentTraversalUtil.getAncestors(
            createDepartmentDto.parentId,
            allDepartments,
          );

        if (hasCycle) {
          throw new BadRequestException(
            'Siklus hierarki terdeteksi pada rantai leluhur departemen induk',
          );
        }

        if (hasMissingParent && ancestors.length > 0) {
          throw new BadRequestException(
            'Struktur hierarki induk tidak valid: data leluhur tidak lengkap',
          );
        }

        const archivedAncestor = ancestors.find((a) => !a.isActive);
        if (archivedAncestor) {
          throw new BadRequestException(
            `Tidak dapat menambahkan sub-departemen karena leluhur '${archivedAncestor.name}' (${archivedAncestor.code}) dalam hierarki sedang diarsipkan`,
          );
        }
      }

      parentId = parent.id;
      level = parent.level + 1;
    }

    const created = await this.departmentRepository.create({
      code: createDepartmentDto.code,
      name: createDepartmentDto.name,
      parentId,
      level,
    });

    await this.auditLogService.record({
      action: 'CREATE',
      entity: 'Department',
      entityId: created.id,
      after: created,
      source: 'USER',
    });

    return created;
  }

  async getTree(query?: DepartmentTreeQueryDto): Promise<DepartmentTreeNode[]> {
    const rawItems = await this.departmentRepository.findAllForTree({
      includeArchived: query?.includeArchived,
    });

    const map = new Map<string, DepartmentTreeNode>();
    const roots: DepartmentTreeNode[] = [];

    // Step 1: Inisialisasi node dalam hash map
    for (const item of rawItems) {
      map.set(item.id, {
        id: item.id,
        code: item.code,
        name: item.name,
        isActive: item.isActive,
        archivedAt: item.archivedAt,
        parentId: item.parentId,
        level: item.level,
        _count: {
          employees: item._count.employees,
          children: 0,
        },
        children: [],
      });
    }

    // Step 2: Hubungkan parent dan child secara O(n) dalam single pass
    for (const item of rawItems) {
      const node = map.get(item.id)!;

      if (!item.parentId) {
        roots.push(node);
      } else if (map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
        parent.children.push(node);
        parent._count.children++;
      } else {
        // Defensive fallback jika parentId tidak ditemukan dalam result set
        this.logger.warn(
          `Departemen '${item.id}' (${item.code}) mereferensikan parentId '${item.parentId}' yang tidak ditemukan; diperlakukan sebagai fallback root`,
        );
        roots.push(node);
      }
    }

    return roots;
  }

  async findAll(query: DepartmentQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.departmentRepository.findAll({
        skip,
        take: limit,
        search: query.search,
        status: query.status,
      }),
      this.departmentRepository.countAll({
        search: query.search,
        status: query.status,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    const department = await this.departmentRepository.findById(id);
    if (!department) {
      throw new NotFoundException(
        `Departemen dengan ID '${id}' tidak ditemukan`,
      );
    }

    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const department = await this.findById(id);

    if (
      updateDepartmentDto.code &&
      updateDepartmentDto.code !== department.code
    ) {
      const existingWithCode = await this.departmentRepository.findByCode(
        updateDepartmentDto.code,
      );

      if (existingWithCode && existingWithCode.id !== id) {
        throw new ConflictException(
          `Departemen dengan kode '${updateDepartmentDto.code}' sudah terdaftar`,
        );
      }
    }

    const updated = await this.departmentRepository.update(
      id,
      updateDepartmentDto,
    );

    await this.auditLogService.record({
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      before: department,
      after: updated,
      source: 'USER',
    });

    return updated;
  }

  async archive(
    id: string,
    dto?: ArchiveDepartmentDto,
    currentUser?: AuthenticatedUser,
  ) {
    const department = await this.findById(id);

    if (!department.isActive) {
      throw new BadRequestException(
        `Departemen '${department.name}' sudah dalam status diarsipkan`,
      );
    }

    // 1. Deep Descendant Active Guard
    const allDepartments = await this.departmentRepository.findAllMinimal();
    const activeDescendants = DepartmentTraversalUtil.findActiveDescendants(
      id,
      allDepartments,
    );

    if (activeDescendants.length > 0) {
      const activeNames = activeDescendants
        .map((d) => `'${d.name}' (${d.code})`)
        .join(', ');
      throw new BadRequestException(
        `Tidak dapat mengarsipkan departemen karena masih memiliki ${activeDescendants.length} sub-departemen aktif di bawahnya: ${activeNames}. Non-aktifkan atau pindahkan sub-departemen terlebih dahulu.`,
      );
    }

    // 2. Validasi karyawan aktif: wajib 0 karyawan aktif
    const activeEmployeesCount =
      await this.departmentRepository.countActiveEmployees(id);
    if (activeEmployeesCount > 0) {
      throw new BadRequestException(
        `Tidak dapat mengarsipkan departemen karena masih memiliki ${activeEmployeesCount} karyawan aktif. Pindahkan karyawan terlebih dahulu.`,
      );
    }

    const archived = await this.departmentRepository.archive(id);

    await this.auditLogService.record({
      actorId: currentUser?.userId,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: 'ARCHIVE',
      entity: 'Department',
      entityId: id,
      before: department,
      after: {
        ...archived,
        ...(dto?.reason && { archiveReason: dto.reason }),
      },
      source: 'USER',
    });

    return archived;
  }

  async restore(
    id: string,
    dto?: RestoreDepartmentDto,
    currentUser?: AuthenticatedUser,
  ) {
    const department = await this.findById(id);

    if (department.isActive) {
      throw new BadRequestException(
        `Departemen '${department.name}' sudah dalam status aktif`,
      );
    }

    // Deep Ancestor Guard: jika child, seluruh ancestor harus active
    if (department.parentId !== null) {
      const allDepartments = await this.departmentRepository.findAllMinimal();
      const archivedAncestors = DepartmentTraversalUtil.findArchivedAncestors(
        id,
        allDepartments,
      );

      if (archivedAncestors.length > 0) {
        const archivedNames = archivedAncestors
          .map((a) => `'${a.name}' (${a.code})`)
          .join(', ');
        throw new BadRequestException(
          `Tidak dapat mengaktifkan kembali departemen '${department.name}' karena departemen induk/leluhur berikut masih dalam status diarsipkan: ${archivedNames}. Aktifkan departemen induk terlebih dahulu.`,
        );
      }
    }

    const restored = await this.departmentRepository.restore(id);

    await this.auditLogService.record({
      actorId: currentUser?.userId,
      actorEmail: currentUser?.email,
      actorRole: currentUser?.role,
      action: 'RESTORE',
      entity: 'Department',
      entityId: id,
      before: department,
      after: {
        ...restored,
        ...(dto?.reason && { restoreReason: dto.reason }),
      },
      source: 'USER',
    });

    return restored;
  }

  async remove(id: string) {
    const department = await this.findById(id);

    // 1. Structural child/descendant guard
    const childrenCount = await this.departmentRepository.countChildren(id);
    if (childrenCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki ${childrenCount} sub-departemen di bawahnya. Hapus atau pindahkan sub-departemen terlebih dahulu, atau gunakan fitur arsip sebagai gantinya.`,
      );
    }

    // 2. Validasi karyawan aktif
    const activeEmployeesCount =
      await this.departmentRepository.countActiveEmployees(id);
    if (activeEmployeesCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki ${activeEmployeesCount} karyawan aktif`,
      );
    }

    // 3. Validasi seluruh data karyawan terkait (inactive / terminated / soft-deleted)
    const totalEmployeesCount =
      await this.departmentRepository.countTotalEmployees(id);
    if (totalEmployeesCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki riwayat ${totalEmployeesCount} data karyawan (non-aktif/terhapus). Gunakan fitur arsip sebagai gantinya.`,
      );
    }

    // 4. Validasi riwayat penugasan posisi (position assignments)
    const positionAssignmentsCount =
      await this.departmentRepository.countPositionAssignments(id);
    if (positionAssignmentsCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki ${positionAssignmentsCount} riwayat penugasan posisi. Gunakan fitur arsip sebagai gantinya.`,
      );
    }

    // 5. Safety net: tangkap Prisma foreign key error jika terjadi konkurensi data
    try {
      await this.departmentRepository.delete(id);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Tidak dapat menghapus departemen karena masih direferensikan oleh data lain. Gunakan fitur arsip sebagai gantinya.',
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      action: 'DELETE',
      entity: 'Department',
      entityId: id,
      before: department,
      source: 'USER',
    });

    return {
      message: 'Departemen berhasil dihapus',
    };
  }

  async reparentDepartment(
    id: string,
    dto: ReparentDepartmentDto,
    currentUser: AuthenticatedUser,
  ) {
    const newParentId = dto.parentId;

    return this.prisma.$transaction(async (tx) => {
      // 1. Ambil snapshot flat hierarchy dalam transaction dengan field minimal
      const allDepartments = await tx.department.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          parentId: true,
          level: true,
          isActive: true,
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
      });

      // 2. Temukan target
      const target = allDepartments.find((d) => d.id === id);
      if (!target) {
        throw new NotFoundException(
          `Departemen dengan ID '${id}' tidak ditemukan`,
        );
      }

      // 3. Handle no-op parent yang sama (return tanpa update DB atau audit log)
      if (target.parentId === newParentId) {
        return tx.department.findUnique({
          where: { id },
          include: {
            parent: {
              select: { id: true, code: true, name: true, level: true },
            },
          },
        });
      }

      // 4. Validasi bukan self-parent
      if (newParentId === id) {
        throw new BadRequestException(
          'Departemen tidak dapat menjadi induk bagi dirinya sendiri',
        );
      }

      let candidateParent: (typeof allDepartments)[0] | null = null;
      let newTargetLevel = 0;

      if (newParentId !== null) {
        // 5a. Temukan candidate parent
        candidateParent =
          allDepartments.find((d) => d.id === newParentId) ?? null;
        if (!candidateParent) {
          throw new NotFoundException(
            `Departemen induk kandidat dengan ID '${newParentId}' tidak ditemukan`,
          );
        }

        // 5b. Active target tidak boleh menuju archived parent
        if (target.isActive && !candidateParent.isActive) {
          throw new BadRequestException(
            'Departemen yang diarsipkan tidak dapat dijadikan induk bagi departemen aktif',
          );
        }

        newTargetLevel = candidateParent.level + 1;
      }

      // 5c. Candidate parent tidak boleh descendant target (Cycle detection)
      const { descendantIds, hasCycle } = DepartmentTraversalUtil.getDescendants(
        id,
        allDepartments,
      );

      if (hasCycle) {
        throw new BadRequestException(
          'Siklus hierarki terdeteksi pada struktur data departemen',
        );
      }

      if (newParentId !== null && descendantIds.has(newParentId)) {
        throw new BadRequestException(
          'Siklus hierarki terdeteksi: Departemen tidak dapat dipindahkan ke bawah unit turunannya sendiri',
        );
      }

      // 5d. Hitung subtree height & max depth validation
      const subtreeHeight = DepartmentTraversalUtil.calculateSubtreeHeight(
        id,
        allDepartments,
      );

      const depthValidation = DepartmentTraversalUtil.validateReparentDepth(
        newTargetLevel,
        subtreeHeight,
        3,
      );

      if (!depthValidation.isValid) {
        throw new BadRequestException(depthValidation.error);
      }

      // 6. Hitung delta level
      const deltaLevel = newTargetLevel - target.level;

      // 7. Update target parentId dan level
      const updatedTarget = await tx.department.update({
        where: { id },
        data: {
          parentId: newParentId,
          level: newTargetLevel,
        },
        include: {
          parent: {
            select: { id: true, code: true, name: true, level: true },
          },
        },
      });

      // 8. Update semua descendants dalam SATU query (zero N+1)
      if (deltaLevel !== 0 && descendantIds.size > 0) {
        await tx.department.updateMany({
          where: { id: { in: Array.from(descendantIds) } },
          data: { level: { increment: deltaLevel } },
        });
      }

      // 9. Buat audit log REPARENT_DEPARTMENT di transaction yang sama
      await this.auditLogService.record(
        {
          actorId: currentUser.userId,
          actorEmail: currentUser.email,
          actorRole: currentUser.role,
          action: 'REPARENT_DEPARTMENT',
          entity: 'Department',
          entityId: id,
          before: {
            parentId: target.parentId,
            level: target.level,
          },
          after: {
            parentId: newParentId,
            level: newTargetLevel,
            ...(dto.reason && { reason: dto.reason }),
            descendantCount: descendantIds.size,
          },
          source: 'USER',
        },
        tx,
      );

      return updatedTarget;
    });
  }
}
