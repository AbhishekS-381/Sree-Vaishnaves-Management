import { useCallback } from 'react';

const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  data: T;
  savedAt: number;
}

export function useDraft(keyPrefix: string) {
  const saveDraft = useCallback(<T>(keySuffix: string, data: T): void => {
    try {
      const fullKey = `rms_draft_${keyPrefix}_${keySuffix}`;
      const envelope: DraftEnvelope<T> = { data, savedAt: Date.now() };
      window.localStorage.setItem(fullKey, JSON.stringify(envelope));
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e);
    }
  }, [keyPrefix]);

  const loadDraft = useCallback(<T>(keySuffix: string): T | null => {
    try {
      const fullKey = `rms_draft_${keyPrefix}_${keySuffix}`;
      const item = window.localStorage.getItem(fullKey);
      if (!item) return null;
      const envelope: DraftEnvelope<T> = JSON.parse(item);
      if (Date.now() - envelope.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(fullKey);
        return null;
      }
      return envelope.data;
    } catch (e) {
      console.warn('Failed to read draft from localStorage', e);
      return null;
    }
  }, [keyPrefix]);

  const clearDraft = useCallback((keySuffix: string): void => {
    try {
      const fullKey = `rms_draft_${keyPrefix}_${keySuffix}`;
      window.localStorage.removeItem(fullKey);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage', e);
    }
  }, [keyPrefix]);

  return { saveDraft, loadDraft, clearDraft };
}
