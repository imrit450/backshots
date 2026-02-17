import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { app, prisma } from '../../src/index';
import { getKeyPair } from '../../src/utils/crypto';

/**
 * Encrypt a password using the server's RSA public key
 * (mirrors what the frontend does with Web Crypto API).
 */
function encryptPassword(password: string): string {
  const { publicKey } = getKeyPair();
  const buffer = Buffer.from(password, 'utf8');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buffer
  );
  return encrypted.toString('base64');
}

describe('Auth API', () => {
  beforeAll(async () => {
    await prisma.photo.deleteMany();
    await prisma.guestSession.deleteMany();
    await prisma.export.deleteMany();
    await prisma.event.deleteMany();
    await prisma.host.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  let hostToken: string;

  describe('GET /v1/auth/public-key', () => {
    it('should return an RSA public key in PEM format', async () => {
      const res = await request(app).get('/v1/auth/public-key');
      expect(res.status).toBe(200);
      expect(res.body.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });
  });

  describe('POST /v1/auth/host/signup', () => {
    it('should create a new host account', async () => {
      const res = await request(app)
        .post('/v1/auth/host/signup')
        .send({
          email: 'test@backshots.app',
          encryptedPassword: encryptPassword('password123'),
          displayName: 'Test Host',
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.host.email).toBe('test@backshots.app');
      expect(res.body.host.displayName).toBe('Test Host');
      hostToken = res.body.token;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/v1/auth/host/signup')
        .send({
          email: 'test@backshots.app',
          encryptedPassword: encryptPassword('password456'),
          displayName: 'Another Host',
        });

      expect(res.status).toBe(409);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/v1/auth/host/signup')
        .send({
          email: 'new@backshots.app',
          encryptedPassword: encryptPassword('123'),
          displayName: 'Short Pass Host',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /v1/auth/host/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/v1/auth/host/login')
        .send({
          email: 'test@backshots.app',
          encryptedPassword: encryptPassword('password123'),
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.host.email).toBe('test@backshots.app');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/v1/auth/host/login')
        .send({
          email: 'test@backshots.app',
          encryptedPassword: encryptPassword('wrongpassword'),
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/v1/auth/host/login')
        .send({
          email: 'nonexistent@backshots.app',
          encryptedPassword: encryptPassword('password123'),
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /v1/auth/host/me', () => {
    it('should return host profile with valid token', async () => {
      const loginRes = await request(app)
        .post('/v1/auth/host/login')
        .send({
          email: 'test@backshots.app',
          encryptedPassword: encryptPassword('password123'),
        });
      expect(loginRes.status).toBe(200);
      const freshToken = loginRes.body.token;

      const res = await request(app)
        .get('/v1/auth/host/me')
        .set('Authorization', `Bearer ${freshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.host.email).toBe('test@backshots.app');
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/v1/auth/host/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/v1/auth/host/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });
});
