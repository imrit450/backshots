import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../../src/index';

describe('Events API', () => {
  let hostToken: string;
  let eventId: string;
  let eventCode: string;

  beforeAll(async () => {
    await prisma.photo.deleteMany();
    await prisma.guestSession.deleteMany();
    await prisma.export.deleteMany();
    await prisma.event.deleteMany();
    await prisma.host.deleteMany();

    // Create host
    const res = await request(app)
      .post('/v1/auth/host/signup')
      .send({
        email: 'eventhost@backshots.app',
        password: 'password123',
        displayName: 'Event Host',
      });
    hostToken = res.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /v1/events', () => {
    it('should create an event', async () => {
      const res = await request(app)
        .post('/v1/events')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Wedding Reception',
          startDatetime: '2026-06-15T18:00:00.000Z',
          timezone: 'America/New_York',
          revealDelayHours: 2,
          maxPhotosPerGuest: 10,
          moderationMode: 'AUTO',
        });

      expect(res.status).toBe(201);
      expect(res.body.event.title).toBe('Wedding Reception');
      expect(res.body.event.eventCode).toBeDefined();
      expect(res.body.event.revealDelayHours).toBe(2);
      expect(res.body.event.maxPhotosPerGuest).toBe(10);
      eventId = res.body.event.id;
      eventCode = res.body.event.eventCode;
    });

    it('should reject without auth', async () => {
      const res = await request(app)
        .post('/v1/events')
        .send({ title: 'Unauthorized Event', startDatetime: '2026-06-15T18:00:00.000Z' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /v1/events', () => {
    it('should list host events', async () => {
      const res = await request(app)
        .get('/v1/events')
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].title).toBe('Wedding Reception');
    });
  });

  describe('GET /v1/events/:eventId', () => {
    it('should get event details with stats', async () => {
      const res = await request(app)
        .get(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Wedding Reception');
      expect(res.body.event.stats).toBeDefined();
      expect(res.body.event.stats.total).toBe(0);
    });
  });

  describe('PATCH /v1/events/:eventId', () => {
    it('should update event settings', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          maxPhotosPerGuest: 15,
          moderationMode: 'APPROVE_FIRST',
        });

      expect(res.status).toBe(200);
      expect(res.body.event.maxPhotosPerGuest).toBe(15);
      expect(res.body.event.moderationMode).toBe('APPROVE_FIRST');
    });
  });

  describe('GET /v1/events/:eventCode/public', () => {
    it('should return public event info', async () => {
      const res = await request(app).get(`/v1/events/${eventCode}/public`);

      expect(res.status).toBe(200);
      expect(res.body.event.title).toBe('Wedding Reception');
      expect(res.body.event.guestGalleryEnabled).toBe(true);
    });

    it('should return 404 for invalid code', async () => {
      const res = await request(app).get('/v1/events/INVALID/public');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/events/:eventId/qr', () => {
    it('should generate QR code', async () => {
      const res = await request(app)
        .get(`/v1/events/${eventId}/qr`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.qrCode).toContain('data:image/png;base64');
      expect(res.body.eventUrl).toContain(eventCode);
      expect(res.body.eventCode).toBe(eventCode);
    });
  });
});
