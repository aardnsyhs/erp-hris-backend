import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EmployeeDocumentService } from './employee-document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';

@Controller('employees/:employeeId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeDocumentController {
  constructor(
    private readonly employeeDocumentService: EmployeeDocumentService,
  ) {}

  @Post()
  @Roles(UserRole.HR_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeDocumentService.upload(
      employeeId,
      dto,
      file,
      currentUser,
    );
  }

  @Get()
  @Roles(UserRole.HR_ADMIN, UserRole.EMPLOYEE)
  findMany(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: DocumentQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeDocumentService.findMany(
      employeeId,
      query,
      currentUser,
    );
  }

  @Get(':id')
  @Roles(UserRole.HR_ADMIN, UserRole.EMPLOYEE)
  findById(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeDocumentService.findById(employeeId, id, currentUser);
  }

  @Get(':id/download')
  @Roles(UserRole.HR_ADMIN, UserRole.EMPLOYEE)
  async download(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fileResult = await this.employeeDocumentService.download(
      employeeId,
      id,
      currentUser,
    );

    res.set({
      'Content-Type': fileResult.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileResult.fileName)}"`,
      'Content-Length': fileResult.fileSizeBytes.toString(),
    });

    return new StreamableFile(fileResult.stream);
  }

  @Delete(':id')
  @Roles(UserRole.HR_ADMIN)
  remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeDocumentService.remove(employeeId, id, currentUser);
  }
}
