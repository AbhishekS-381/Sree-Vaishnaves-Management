import { readJSON, writeJSON, DB_FILES } from './db';
import { getSession } from '@/app/actions/auth';
import { randomUUID } from 'crypto';

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

// Keep the most recent N entries — older entries are dropped.
// At ~5 mutations/day by 3 users, 3000 entries ≈ 200 days of history.
// Each entry is ~200 bytes → 3000 entries ≈ 600KB well under blob limits.
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
    } catch (e) {}

    let logs: AuditLogEntry[] = [];
    try {
      logs = await readJSON<AuditLogEntry>(DB_FILES.AUDIT_LOGS);
    } catch (e) {}

    if (!Array.isArray(logs)) logs = [];

    logs.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: session?.userId ?? 'system',
      userName: session?.name ?? 'system',
      action,
      entityType,
      entityId,
      details,
    });

    // Trim to the most recent MAX_AUDIT_ENTRIES — keep the tail (newest)
    if (logs.length > MAX_AUDIT_ENTRIES) {
      logs = logs.slice(logs.length - MAX_AUDIT_ENTRIES);
    }

    await writeJSON(DB_FILES.AUDIT_LOGS, logs);
  } catch (error) {
    // Audit failure must never crash the calling operation
    console.error('Failed to write audit log:', error);
  }
}
