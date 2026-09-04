import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReparentDepartmentDto } from './reparent-department.dto';

describe('ReparentDepartmentDto', () => {
  const VALID_UUID = '36cf2c07-3cba-41ca-807d-2720f3e9fef2';

  it('should pass validation when parentId is a valid UUIDv4', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: VALID_UUID,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should pass validation when parentId is explicitly null (promote to root)', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: null,
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject validation when parentId is an invalid UUID string', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: 'not-a-valid-uuid',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('parentId');
    expect(errors[0].constraints?.isUuid).toContain('UUID format v4');
  });

  it('should reject validation when parentId is omitted / undefined', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {});

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('parentId');
  });

  it('should reject validation when parentId is a number or boolean', async () => {
    const dtoNum = plainToInstance(ReparentDepartmentDto, {
      parentId: 12345,
    });
    const errorsNum = await validate(dtoNum);
    expect(errorsNum.length).toBeGreaterThan(0);

    const dtoBool = plainToInstance(ReparentDepartmentDto, {
      parentId: true,
    });
    const errorsBool = await validate(dtoBool);
    expect(errorsBool.length).toBeGreaterThan(0);
  });

  it('should pass validation with optional reason <= 255 characters', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: VALID_UUID,
      reason: 'Restrukturisasi divisi teknologi Q3 2026',
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject validation when reason exceeds 255 characters', async () => {
    const longReason = 'A'.repeat(256);
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: VALID_UUID,
      reason: longReason,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
    expect(errors[0].constraints?.maxLength).toContain(
      'maksimal 255 karakter',
    );
  });

  it('should reject validation when reason is not a string', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: VALID_UUID,
      reason: 99999,
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
    expect(errors[0].constraints?.isString).toContain('berupa string');
  });

  it('should reject unwhitelisted properties like level when forbidNonWhitelisted is enabled', async () => {
    const dto = plainToInstance(ReparentDepartmentDto, {
      parentId: VALID_UUID,
      level: 2, // Client attempting to supply level directly
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('level');
    expect(errors[0].constraints).toBeDefined();
    expect(Object.keys(errors[0].constraints!)).toContain('whitelistValidation');
  });
});
