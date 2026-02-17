import { describe, it, expect } from 'vitest';
import { isPhotoVisible } from '../../src/utils/helpers';

describe('Photo Visibility', () => {
  const pastReveal = new Date(Date.now() - 60000); // Past
  const futureReveal = new Date(Date.now() + 3600000); // Future

  describe('AUTO moderation mode', () => {
    it('should show approved revealed photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'APPROVED', revealAt: pastReveal },
          'AUTO'
        )
      ).toBe(true);
    });

    it('should show pending revealed photo (AUTO auto-approves)', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'PENDING', revealAt: pastReveal },
          'AUTO'
        )
      ).toBe(true);
    });

    it('should hide rejected photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'REJECTED', revealAt: pastReveal },
          'AUTO'
        )
      ).toBe(false);
    });

    it('should hide hidden photo', () => {
      expect(
        isPhotoVisible(
          { hidden: true, status: 'APPROVED', revealAt: pastReveal },
          'AUTO'
        )
      ).toBe(false);
    });

    it('should hide unrevealed photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'APPROVED', revealAt: futureReveal },
          'AUTO'
        )
      ).toBe(false);
    });
  });

  describe('APPROVE_FIRST moderation mode', () => {
    it('should show approved revealed photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'APPROVED', revealAt: pastReveal },
          'APPROVE_FIRST'
        )
      ).toBe(true);
    });

    it('should hide pending photo even if revealed', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'PENDING', revealAt: pastReveal },
          'APPROVE_FIRST'
        )
      ).toBe(false);
    });

    it('should hide rejected photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'REJECTED', revealAt: pastReveal },
          'APPROVE_FIRST'
        )
      ).toBe(false);
    });

    it('should hide hidden approved photo', () => {
      expect(
        isPhotoVisible(
          { hidden: true, status: 'APPROVED', revealAt: pastReveal },
          'APPROVE_FIRST'
        )
      ).toBe(false);
    });

    it('should hide unrevealed approved photo', () => {
      expect(
        isPhotoVisible(
          { hidden: false, status: 'APPROVED', revealAt: futureReveal },
          'APPROVE_FIRST'
        )
      ).toBe(false);
    });
  });
});
