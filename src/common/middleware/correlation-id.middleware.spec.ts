import { CorrelationIdMiddleware, RequestWithCorrelationId } from './correlation-id.middleware';
import { Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate a correlationId if none is provided in headers', () => {
    const req = { headers: {} } as RequestWithCorrelationId;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(typeof req.correlationId).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', req.correlationId);
    expect(next).toHaveBeenCalled();
  });

  it('should reuse existing x-correlation-id header', () => {
    const req = {
      headers: { 'x-correlation-id': 'custom-trace-id-123' },
    } as unknown as RequestWithCorrelationId;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('custom-trace-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'custom-trace-id-123');
    expect(next).toHaveBeenCalled();
  });

  it('should fallback to x-request-id header if present', () => {
    const req = {
      headers: { 'x-request-id': 'req-id-456' },
    } as unknown as RequestWithCorrelationId;
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.correlationId).toBe('req-id-456');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'req-id-456');
    expect(next).toHaveBeenCalled();
  });
});
