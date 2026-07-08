import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('crypto', () => ({
  randomUUID: () => '12345678-1234-1234-1234-123456789012',
  default: {
    randomUUID: () => '12345678-1234-1234-1234-123456789012'
  }
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'session') return { value: 'mocked-session-token' }
      return undefined
    },
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

process.env.DATABASE_URL = 'postgres://mock:mock@mock/mock';
process.env.DATA_DIR = './.data';
