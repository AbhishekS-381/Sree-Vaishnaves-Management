import { db, auditLogs } from './db';
import { getSession } from '@/app/actions/auth';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: string;
}

const MAX_AUDIT_ENTRIES = 3000;

export async function logAction(
  action: string,
  entityType: string,
  details: string,
  entityId?: string
) {
  try {
    let session = null;
    try {
      session = await getSession();
    } catch {}

    await db.insert(auditLogs).values({
      id: randomUUID(),
      timestamp: new Date(),
      userId: session?.userId ?? 'system',
      userName: session?.name ?? 'system',
      action,
      entityType,
      entityId,
      details,
    });

    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs);

    const count = rows[0]?.count ?? 0;
    if (count > MAX_AUDIT_ENTRIES) {
      const excess = count - MAX_AUDIT_ENTRIES;
      await db.execute(
        sql`DELETE FROM audit_logs WHERE pk IN (SELECT pk FROM audit_logs ORDER BY timestamp ASC LIMIT ${excess})`
      );
    }
  } catch (error) {
    // Audit failure must never crash the calling operation
    console.error('Failed to write audit log:', error);
  }
}
