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
    const session = await getSession();
    if (!session) return; // Silent failure if no session

    const logs = await readJSON<AuditLogEntry>(DB_FILES.AUDIT_LOGS).catch(() => [] as AuditLogEntry[]);
    
    logs.push({
      id: `audit_${randomUUID().split('-')[0]}`,
      timestamp: new Date().toISOString(),
      userId: session.userId,
      userName: session.name,
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
