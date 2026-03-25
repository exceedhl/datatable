import { useEffect, useRef, useCallback } from 'react';
import type { FilterCondition, ConditionalRule, PersistedViewConfig } from './types';

const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 500;

function getStorageKey(roomId: string, userId: string): string {
  return `dt_view_${roomId}_${userId}`;
}

interface ViewState {
  filters: FilterCondition[];
  groupBy: string[];
  columnOrder: string[];
  columnSizing: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  frozenColumnCount: number;
  conditionalRules: ConditionalRule[];
}

interface UseViewPersistenceReturn {
  loadViewConfig: () => Partial<ViewState> | null;
  saveViewConfig: (state: ViewState) => void;
  resetViewConfig: () => void;
}

export function useViewPersistence(roomId: string, userId: string): UseViewPersistenceReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = getStorageKey(roomId, userId);

  const loadViewConfig = useCallback((): Partial<ViewState> | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed: PersistedViewConfig = JSON.parse(raw);
      if (parsed.version !== SCHEMA_VERSION) {
        // Incompatible version, clear stale data
        localStorage.removeItem(key);
        return null;
      }
      return {
        filters: parsed.filters || [],
        groupBy: parsed.groupBy || [],
        columnOrder: parsed.columnOrder || [],
        columnSizing: parsed.columnSizing || {},
        columnVisibility: parsed.columnVisibility || {},
        frozenColumnCount: parsed.frozenColumnCount || 0,
        conditionalRules: parsed.conditionalRules || [],
      };
    } catch {
      // Corrupted data, graceful fallback
      localStorage.removeItem(key);
      return null;
    }
  }, [key]);

  const saveViewConfig = useCallback((state: ViewState) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const config: PersistedViewConfig = {
          version: SCHEMA_VERSION,
          filters: state.filters,
          groupBy: state.groupBy,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
          columnVisibility: state.columnVisibility,
          frozenColumnCount: state.frozenColumnCount,
          conditionalRules: state.conditionalRules,
        };
        localStorage.setItem(key, JSON.stringify(config));
      } catch {
        // Storage full or unavailable, silently ignore
      }
    }, DEBOUNCE_MS);
  }, [key]);

  const resetViewConfig = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(key);
  }, [key]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { loadViewConfig, saveViewConfig, resetViewConfig };
}
