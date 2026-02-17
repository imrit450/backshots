import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../../src/index';

describe('Moderation API', () => {
  let hostToken: string;
  let eventId: string;
  let photoId: string;

  beforeAll(async () => {
    await prisma.photo.deleteMany();
    await prisma.guestSession.deleteMany();
    await prisma.export.deleteMany();
    await prisma.event.deleteMany();
    await prisma.host.deleteMany();

    // Create host and grant event creation (tests bypass admin approval)
    const hostRes = await request(app)
      .post('/v1/auth/host/signup')
      .send({
        email: 'modhost@backshots.app',
        password: 'password123',
        displayName: 'Mod Host',
      });
    hostToken = hostRes.body.token;
    await prisma.host.update({
      where: { id: hostRes.body.host.id },
      data: { canCreateEvents: true },
    });

    // Create event
    const eventRes = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Moderation Test Event',
        startDatetime: '2026-06-15T18:00:00.000Z',
        moderationMode: 'APPROVE_FIRST',
      });
    eventId = eventRes.body.event.id;

    // Create a guest session and photo directly in DB
    const session = await prisma.guestSession.create({
      data: {
        eventId,
        displayName: 'Test Guest',
        token: 'test-session-token',
      },
    });

    const photo = await prisma.photo.create({
      data: {
        eventId,
        guestSessionId: session.id,
        status: 'PENDING',
        capturedAt: new Date(),
        revealAt: new Date(),
        thumbUrl: '/uploads/thumbnails/test.jpg',
        largeUrl: '/uploads/large/test.jpg',
        originalUrl: '/uploads/originals/test.jpg',
      },
    });
    photoId = photo.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('PATCH /v1/events/:eventId/photos/:photoId', () => {
    it('should approve a pending photo', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.photo.status).toBe('APPROVED');
    });

    it('should hide a photo', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ hidden: true });

      expect(res.status).toBe(200);
      expect(res.body.photo.hidden).toBe(true);
    });

    it('should unhide a photo', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ hidden: false });

      expect(res.status).toBe(200);
      expect(res.body.photo.hidden).toBe(false);
    });

    it('should reject a photo', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.photo.status).toBe('REJECTED');
    });

    it('should return 404 for non-existent photo', async () => {
      const res = await request(app)
        .patch(`/v1/events/${eventId}/photos/nonexistent`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ hidden: true });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/events/:eventId/stats', () => {
    it('should return dashboard stats', async () => {
      const res = await request(app)
        .get(`/v1/events/${eventId}/stats`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalPhotos).toBeGreaterThanOrEqual(1);
      expect(res.body.stats.guestCount).toBeGreaterThanOrEqual(1);
    });
  });
});
