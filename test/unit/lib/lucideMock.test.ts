import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Guard test.
 *
 * `vi.mock('lucide-react')` resolves to the manual mock at
 * `__mocks__/lucide-react.tsx`. ES modules can't export names dynamically, so
 * that mock lists icons explicitly — which means adding a new icon to a
 * component silently makes it `undefined` in tests. React then fails with the
 * very unhelpful:
 *
 *   "Element type is invalid: expected a string ... but got: undefined"
 *
 * This test fails early with an actionable message instead.
 */

const ROOT = path.resolve(__dirname, '../../..')
const SRC = path.join(ROOT, 'src')
const MOCK = path.join(ROOT, '__mocks__', 'lucide-react.tsx')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Collect every identifier imported from 'lucide-react' across src/. */
function collectImportedIcons(): Map<string, string[]> {
  const icons = new Map<string, string[]>()
  const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/g

  for (const file of walk(SRC)) {
    const code = fs.readFileSync(file, 'utf-8')
    let m: RegExpExecArray | null
    while ((m = importRe.exec(code)) !== null) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim()
        if (!name) continue
        const rel = path.relative(ROOT, file)
        if (!icons.has(name)) icons.set(name, [])
        icons.get(name)!.push(rel)
      }
    }
  }
  return icons
}

describe('lucide-react manual mock completeness', () => {
  it('exports every icon that src/ imports', () => {
    const mockSource = fs.readFileSync(MOCK, 'utf-8')
    const exported = new Set(
      Array.from(mockSource.matchAll(/export const (\w+)\s*=/g)).map(m => m[1])
    )

    const imported = collectImportedIcons()
    const missing: string[] = []

    for (const [icon, files] of imported.entries()) {
      if (!exported.has(icon)) {
        missing.push(`  ${icon}  (used in ${files.join(', ')})`)
      }
    }

    expect(
      missing.length,
      missing.length === 0
        ? ''
        : `\n\n${missing.length} lucide icon(s) are imported in src/ but missing from ` +
          `__mocks__/lucide-react.tsx.\nAdd them or component tests will fail with ` +
          `"Element type is invalid ... got: undefined":\n\n${missing.join('\n')}\n`
    ).toBe(0)
  })

  it('finds a non-trivial number of icons (sanity check the scanner works)', () => {
    const imported = collectImportedIcons()
    expect(imported.size).toBeGreaterThan(20)
  })
})
