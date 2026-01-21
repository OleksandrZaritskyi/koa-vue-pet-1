import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { schemas } from '../middleware/validation.js';

describe('Validation Schemas', () => {
  describe('uuid schema', () => {
    it('should validate valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = schemas.uuid.safeParse(uuid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = schemas.uuid.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('positiveInt schema', () => {
    it('should validate positive integer', () => {
      const result = schemas.positiveInt.safeParse('10');
      expect(result.success).toBe(true);
      expect(result.data).toBe(10);
    });

    it('should reject zero', () => {
      const result = schemas.positiveInt.safeParse('0');
      expect(result.success).toBe(false);
    });

    it('should reject negative number', () => {
      const result = schemas.positiveInt.safeParse('-5');
      expect(result.success).toBe(false);
    });
  });

  describe('nonNegativeInt schema', () => {
    it('should validate zero', () => {
      const result = schemas.nonNegativeInt.safeParse('0');
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it('should validate positive integer', () => {
      const result = schemas.nonNegativeInt.safeParse('42');
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should reject negative number', () => {
      const result = schemas.nonNegativeInt.safeParse('-1');
      expect(result.success).toBe(false);
    });
  });

  describe('paginationQuery schema', () => {
    it('should use defaults', () => {
      const result = schemas.paginationQuery.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ limit: 20, offset: 0 });
    });

    it('should validate custom values', () => {
      const result = schemas.paginationQuery.safeParse({ limit: '50', offset: '10' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ limit: 50, offset: 10 });
    });

    it('should reject limit over 100', () => {
      const result = schemas.paginationQuery.safeParse({ limit: '200' });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = schemas.paginationQuery.safeParse({ offset: '-5' });
      expect(result.success).toBe(false);
    });
  });
});
