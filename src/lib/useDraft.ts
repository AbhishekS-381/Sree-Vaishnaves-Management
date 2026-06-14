import { useCallback } from 'react';

export function useDraft(keyPrefix: string) {
  const saveDraft = useCallback((keySuffix: string, data: any) => {
    try {
      const fullKey = `draft_${keyPrefix}_${keySuffix}`;
      window.localStorage.setItem(fullKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e);
    }
  }, [keyPrefix]);

  const loadDraft = useCallback((keySuffix: string) => {
    try {
      const fullKey = `draft_${keyPrefix}_${keySuffix}`;
      const item = window.localStorage.getItem(fullKey);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.warn('Failed to read draft from localStorage', e);
      return null;
    }
  }, [keyPrefix]);

  const clearDraft = useCallback((keySuffix: string) => {
    try {
      const fullKey = `draft_${keyPrefix}_${keySuffix}`;
      window.localStorage.removeItem(fullKey);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage', e);
    }
  }, [keyPrefix]);

  return { saveDraft, loadDraft, clearDraft };
}
