import { describe, it, expect } from 'vitest';

describe('Limits Enforcement', () => {
  function canUpload(photoCount: number, maxPhotos: number): boolean {
    return photoCount < maxPhotos;
  }

  describe('Per-guest photo limit', () => {
    it('should allow upload when under limit', () => {
      expect(canUpload(0, 20)).toBe(true);
      expect(canUpload(5, 20)).toBe(true);
      expect(canUpload(19, 20)).toBe(true);
    });

    it('should deny upload at limit', () => {
      expect(canUpload(20, 20)).toBe(false);
    });

    it('should deny upload over limit', () => {
      expect(canUpload(21, 20)).toBe(false);
    });

    it('should work with limit of 1', () => {
      expect(canUpload(0, 1)).toBe(true);
      expect(canUpload(1, 1)).toBe(false);
    });

    it('should work with high limits', () => {
      expect(canUpload(99, 100)).toBe(true);
      expect(canUpload(100, 100)).toBe(false);
    });
  });
});
