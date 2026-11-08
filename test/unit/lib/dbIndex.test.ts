import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('db/index.ts — postgres-js driver initialization', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  it('throws error when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL
    delete process.env.AIVEN_DATABASE_URL

    await expect(async () => {
      await import('../../../db/index')
    }).rejects.toThrow('[db] DATABASE_URL is not set')
  })

  it('throws error when AIVEN_DATABASE_URL is set but AIVEN_CA_CERT is missing', async () => {
    process.env.AIVEN_DATABASE_URL = 'postgres://user:pass@host:5432/db'
    delete process.env.AIVEN_CA_CERT

    await expect(async () => {
      await import('../../../db/index')
    }).rejects.toThrow('AIVEN_CA_CERT is required')
  })

  it('initializes postgres client when valid DATABASE_URL is provided', async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/testdb'
    delete process.env.AIVEN_DATABASE_URL
    delete process.env.AIVEN_CA_CERT

    const dbModule = await import('../../../db/index')
    expect(dbModule.db).toBeDefined()
    expect(typeof dbModule.db.select).toBe('function')
  })
})

