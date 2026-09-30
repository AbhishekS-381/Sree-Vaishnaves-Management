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
      ['test/unit/proxy.test.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/app/actions/**/*.ts',
        'src/hooks/**/*.ts',
        'src/lib/**/*.ts',
        'src/proxy.ts',
        'src/components/**/*.tsx',
      ],
      exclude: [
        'src/app/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/[id]/page.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: {
        // Global floors — raised as coverage improved. Keep these just under the
        // measured values so a small regression fails the build rather than
        // silently eroding coverage.
        lines: 93,
        functions: 88,
        branches: 84,
        statements: 91,
        // Per-path floors
        'src/app/actions/**': { lines: 95, functions: 90, branches: 85, statements: 93 },
        'src/hooks/**': { lines: 98, functions: 100, branches: 95, statements: 96 },
        'src/lib/audit.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/jwt.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/utils.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/menuResolver.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/menuMigration.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/positionsSummary.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/rate-limit.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/lib/db.ts': { lines: 100, functions: 100, branches: 90, statements: 100 },
        'src/proxy.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        // Components are interaction-heavy; floor reflects measured coverage.
        'src/components/**': { lines: 85, functions: 82, branches: 78, statements: 83 },
      }
    } as any
  } as any
})
