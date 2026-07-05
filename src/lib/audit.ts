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

export async function logAction(action: string, entityType: string, details: string, entityId?: string) {
  try {
    let session = null;
    try {
      session = await getSession();
    } catch (e) {}
    
    
    const logs = await readJSON<AuditLogEntry>(DB_FILES.AUDIT_LOGS).catch(() => [] as AuditLogEntry[]);
    
    logs.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: session?.userId ?? 'system',
      userName: session?.name ?? 'system',
      action,
      entityType,
      entityId,
      details
    });

    await writeJSON(DB_FILES.AUDIT_LOGS, logs);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
