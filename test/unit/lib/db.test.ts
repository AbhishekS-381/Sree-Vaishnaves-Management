import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { withTransaction, readJSON, writeJSON, DATA_DIR } from '@/lib/db'

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}))

describe('Database Library (db.ts)', () => {
  const testFileName = 'test_db.json'
  const testFilePath = path.join(DATA_DIR, testFileName)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
  })

  describe('readJSON', () => {
    it('returns empty array if file does not exist', async () => {
      const error: any = new Error('ENOENT')
      error.code = 'ENOENT'
      vi.mocked(fs.readFile).mockRejectedValue(error)

      const data = await readJSON(testFileName)
      expect(data).toEqual([])
    })

    it('parses and returns JSON array', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('[{"id": 1}]')

      const data = await readJSON(testFileName)
      expect(data).toEqual([{ id: 1 }])
    })
  })

  describe('writeJSON', () => {
    it('writes formatted JSON to file', async () => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      const success = await writeJSON(testFileName, [{ id: 1 }])
      expect(success).toBe(true)
      expect(fs.writeFile).toHaveBeenCalledWith(
        testFilePath,
        JSON.stringify([{ id: 1 }], null, 2),
        'utf-8'
      )
    })
  })

  describe('withTransaction (ACID Mutex)', () => {
    it('should queue concurrent operations and execute sequentially', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('[]')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      let executionOrder: string[] = []

      // Simulate async callbacks taking different times
      const callback1 = async (data: any[]) => {
        executionOrder.push('start1')
        await new Promise(r => setTimeout(r, 50))
        executionOrder.push('end1')
        return [{ id: 1 }]
      }

      const callback2 = async (data: any[]) => {
        executionOrder.push('start2')
        await new Promise(r => setTimeout(r, 10)) // Faster, but should run after callback1 finishes
        executionOrder.push('end2')
        return [{ id: 2 }]
      }

      // Execute concurrently
      const promise1 = withTransaction(testFileName, callback1)
      const promise2 = withTransaction(testFileName, callback2)

      await Promise.all([promise1, promise2])

      // Without a mutex, they would interleave. With a mutex, it must be sequential.
      expect(executionOrder).toEqual(['start1', 'end1', 'start2', 'end2'])
      
      // Total 2 writes
      expect(fs.writeFile).toHaveBeenCalledTimes(2)
    })

    it('should release lock if callback throws an error', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('[]')
      
      const callbackError = async () => {
        throw new Error('Simulation Error')
      }
      
      const callbackSuccess = async (data: any[]) => {
        return [{ id: 'success' }]
      }

      const promiseError = withTransaction(testFileName, callbackError)
      const promiseSuccess = withTransaction(testFileName, callbackSuccess)
      
      const [resError, resSuccess] = await Promise.all([promiseError, promiseSuccess])
      
      expect(resError).toBe(false)
      expect(resSuccess).toBe(true)
      expect(fs.writeFile).toHaveBeenCalledTimes(1)
    })
  })
})
