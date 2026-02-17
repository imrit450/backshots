import { describe, it, expect } from 'vitest';
import { computeRevealAt, isRevealed } from '../../src/utils/helpers';

describe('Reveal Logic', () => {
  describe('computeRevealAt', () => {
    it('should return same time when delay is 0', () => {
      const captured = new Date('2026-02-15T12:00:00Z');
      const revealAt = computeRevealAt(captured, 0);
      expect(revealAt.getTime()).toBe(captured.getTime());
    });

    it('should add delay hours to captured time', () => {
      const captured = new Date('2026-02-15T12:00:00Z');
      const revealAt = computeRevealAt(captured, 2);
      expect(revealAt.toISOString()).toBe('2026-02-15T14:00:00.000Z');
    });

    it('should handle 24-hour delay', () => {
      const captured = new Date('2026-02-15T12:00:00Z');
      const revealAt = computeRevealAt(captured, 24);
      expect(revealAt.toISOString()).toBe('2026-02-16T12:00:00.000Z');
    });

    it('should handle large delays (168 hours = 1 week)', () => {
      const captured = new Date('2026-02-15T12:00:00Z');
      const revealAt = computeRevealAt(captured, 168);
      expect(revealAt.toISOString()).toBe('2026-02-22T12:00:00.000Z');
    });
  });

  describe('isRevealed', () => {
    it('should return true for past reveal time', () => {
      const pastTime = new Date(Date.now() - 60000); // 1 min ago
      expect(isRevealed(pastTime)).toBe(true);
    });

    it('should return true for current time', () => {
      const now = new Date();
      expect(isRevealed(now)).toBe(true);
    });

    it('should return false for future reveal time', () => {
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      expect(isRevealed(futureTime)).toBe(false);
    });
  });
});
