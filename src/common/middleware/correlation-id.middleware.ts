import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelationId, res: Response, next: NextFunction): void {
    const headerCorrelationId =
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string);

    const correlationId = headerCorrelationId || randomUUID();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
