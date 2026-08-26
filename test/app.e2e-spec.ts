import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';

describe('App & Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check (/api/v1/health)', () => {
    it('GET /api/v1/health - Public health check returns status 200 with structured JSON', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'erp-hris-backend',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Protected Route Guard (/api/v1/auth/me)', () => {
    it('GET /api/v1/auth/me - Protected route without token returns 401 Unauthorized', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('Rate Limiting (/api/v1/auth/login)', () => {
    it('POST /api/v1/auth/login - Request ke-6 dalam 1 menit menghasilkan 429 Too Many Requests', async () => {
      const invalidCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      // Kirim 5 request pertama (menghasilkan 401 karena credentials salah, namun terhitung dalam throttle limit)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(invalidCredentials)
          .expect(401);
      }

      // Request ke-6 harus ditolak oleh ThrottlerGuard dengan status 429 Too Many Requests
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(invalidCredentials)
        .expect(429);

      expect(response.body.message).toContain('ThrottlerException');
    });
  });
});
