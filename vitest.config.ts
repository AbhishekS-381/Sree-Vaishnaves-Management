import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    pool: 'vmForks',
    minWorkers: 1,
    maxWorkers: 2,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    include: ['test/unit/**/*.test.ts', 'test/unit/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['test/unit/lib/jwt.test.ts', 'node'],
      ['test/unit/middleware.test.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/app/actions/**/*.ts',
        'src/hooks/**/*.ts',
        'src/lib/**/*.ts',
        'src/middleware.ts',
        'src/components/**/*.tsx',
      ],
      exclude: [
        'src/app/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/[id]/page.tsx',
        'src/**/*.d.ts',
        // StaffModal is a 281-line complex form; its coverage worker crashes (OOM)
        // during instrumentation. Covered by integration tests instead.
        'src/components/StaffModal.tsx',
        'src/components/ScheduleTimeline.tsx',
        'src/components/AutoScheduleModal.tsx',
        'src/lib/db.ts',
      ],
      thresholds: {
        // Global minimum — anchored by backend (actions, lib, hooks) which are ≥90%
        // Components lower threshold because Next.js hooks & class components
        // require special instrumentation tooling beyond jsdom
        lines: 85,
        functions: 85,
        branches: 78,
        statements: 85,
        // Per-path overrides for backend modules
        'src/app/actions/**': { lines: 90, functions: 85, branches: 80, statements: 90 },
        'src/lib/audit.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/jwt.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/utils.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/hooks/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/middleware.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
      }
    } as any
  } as any
})
