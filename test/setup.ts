import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('crypto', () => ({
  randomUUID: () => '12345678-1234-1234-1234-123456789012',
  default: {
    randomUUID: () => '12345678-1234-1234-1234-123456789012'
  }
}));
