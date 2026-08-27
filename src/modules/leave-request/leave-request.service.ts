import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveRequestStatus, UserRole } from '@prisma/client';
import { LeaveRequestRepository } from './leave-request.repository';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly leaveRequestRepository: LeaveRequestRepository,
  ) {}

  async create(currentUser: AuthenticatedUser, dto: CreateLeaveRequestDto) {
    if (!currentUser.employeeId) {
      throw new ForbiddenException(
        'Akun Anda tidak terhubung dengan data karyawan',
      );
    }

    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Tanggal selesai (endDate) tidak boleh lebih awal dari tanggal mulai (startDate)',
      );
    }

    const overlappingApproved =
      await this.leaveRequestRepository.findOverlappingApproved(
        currentUser.employeeId,
        dto.startDate,
        dto.endDate,
      );

    if (overlappingApproved) {
      throw new ConflictException(
        'Terdapat permohonan cuti yang sudah disetujui (APPROVED) pada rentang tanggal tersebut',
      );
    }

    return this.leaveRequestRepository.create({
      employeeId: currentUser.employeeId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      reason: dto.reason,
      status: LeaveRequestStatus.PENDING,
    });
  }

  async approve(id: string, currentUser: AuthenticatedUser) {
    if (!currentUser.employeeId) {
      throw new ForbiddenException(
        'Akun Anda tidak terhubung dengan data karyawan',
      );
    }

    const leaveRequest = await this.leaveRequestRepository.findById(id);
    if (!leaveRequest) {
      throw new NotFoundException(
        `Permohonan cuti dengan ID '${id}' tidak ditemukan`,
      );
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(
        `Hanya permohonan cuti berstatus PENDING yang dapat disetujui, status saat ini: ${leaveRequest.status}`,
      );
    }

    if (currentUser.employeeId === leaveRequest.employeeId) {
      throw new ForbiddenException(
        'Anda tidak dapat menyetujui permohonan cuti Anda sendiri',
      );
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException(
        'Role EMPLOYEE tidak memiliki izin untuk menyetujui permohonan cuti',
      );
    }

    if (currentUser.role === UserRole.MANAGER) {
      const managerEmployee =
        await this.leaveRequestRepository.findEmployeeById(
          currentUser.employeeId,
        );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== leaveRequest.employee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat menyetujui permohonan cuti untuk karyawan di departemen Anda',
        );
      }
    }

    // Validasi overlap: pastikan belum ada cuti APPROVED lain pada rentang tanggal tersebut
    const overlappingApproved =
      await this.leaveRequestRepository.findOverlappingApproved(
        leaveRequest.employeeId,
        leaveRequest.startDate,
        leaveRequest.endDate,
      );

    if (overlappingApproved && overlappingApproved.id !== leaveRequest.id) {
      throw new ConflictException(
        'Terdapat permohonan cuti lain yang sudah disetujui (APPROVED) pada rentang tanggal tersebut',
      );
    }

    return this.leaveRequestRepository.approve(
      id,
      currentUser.employeeId,
      new Date(),
    );
  }

  async reject(
    id: string,
    currentUser: AuthenticatedUser,
    dto: RejectLeaveRequestDto,
  ) {
    if (!currentUser.employeeId) {
      throw new ForbiddenException(
        'Akun Anda tidak terhubung dengan data karyawan',
      );
    }

    const leaveRequest = await this.leaveRequestRepository.findById(id);
    if (!leaveRequest) {
      throw new NotFoundException(
        `Permohonan cuti dengan ID '${id}' tidak ditemukan`,
      );
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException(
        `Hanya permohonan cuti berstatus PENDING yang dapat ditolak, status saat ini: ${leaveRequest.status}`,
      );
    }

    if (currentUser.employeeId === leaveRequest.employeeId) {
      throw new ForbiddenException(
        'Anda tidak dapat menolak permohonan cuti Anda sendiri',
      );
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      throw new ForbiddenException(
        'Role EMPLOYEE tidak memiliki izin untuk menolak permohonan cuti',
      );
    }

    if (currentUser.role === UserRole.MANAGER) {
      const managerEmployee =
        await this.leaveRequestRepository.findEmployeeById(
          currentUser.employeeId,
        );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== leaveRequest.employee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat menolak permohonan cuti untuk karyawan di departemen Anda',
        );
      }
    }

    return this.leaveRequestRepository.reject(
      id,
      currentUser.employeeId,
      new Date(),
      dto.rejectionReason,
    );
  }

  async findAll(query: LeaveRequestQueryDto, currentUser: AuthenticatedUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    let targetEmployeeId = query.employeeId;
    let targetDepartmentId = query.departmentId;

    // 1. Role: EMPLOYEE -> Hanya melihat permohonan milik sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      targetEmployeeId = currentUser.employeeId;
      targetDepartmentId = undefined;
    }

    // 2. Role: MANAGER -> Hanya melihat permohonan karyawan di departemen yang sama
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const managerEmployee =
        await this.leaveRequestRepository.findEmployeeById(
          currentUser.employeeId,
        );
      if (!managerEmployee) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      targetDepartmentId = managerEmployee.departmentId;
    }

    // 3. Eksekusi query terpaginasi
    const [data, total] = await Promise.all([
      this.leaveRequestRepository.findAll({
        skip,
        take: limit,
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        leaveType: query.leaveType,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
      this.leaveRequestRepository.countAll({
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        leaveType: query.leaveType,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

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

  async findById(id: string, currentUser: AuthenticatedUser) {
    const leaveRequest = await this.leaveRequestRepository.findById(id);
    if (!leaveRequest) {
      throw new NotFoundException(
        `Permohonan cuti dengan ID '${id}' tidak ditemukan`,
      );
    }

    // 1. Role: EMPLOYEE -> Hanya boleh melihat cuti miliknya sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== leaveRequest.employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat detail permohonan cuti Anda sendiri',
        );
      }
    }

    // 2. Role: MANAGER -> Hanya boleh melihat cuti departemennya sendiri
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException(
          'Akun Manager tidak terhubung dengan data karyawan',
        );
      }

      const managerEmployee =
        await this.leaveRequestRepository.findEmployeeById(
          currentUser.employeeId,
        );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== leaveRequest.employee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat permohonan cuti untuk karyawan di departemen Anda',
        );
      }
    }

    return leaveRequest;
  }
}
