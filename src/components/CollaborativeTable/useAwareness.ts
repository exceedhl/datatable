import { create } from 'zustand';

type CursorInfo = {
  userId: string;
  name: string;
  color: string;
  rowId: string;
  colId: string;
};

type AwarenessState = {
  activeCursors: Record<string, CursorInfo>;
  setCursor: (clientId: string, data: CursorInfo) => void;
  removeCursor: (clientId: string) => void;
};

export const useAwarenessStore = create<AwarenessState>((set) => ({
  activeCursors: {},
  setCursor: (clientId, data) =>
    set((state) => ({
      activeCursors: { ...state.activeCursors, [clientId]: data },
    })),
  removeCursor: (clientId) =>
    set((state) => {
      const next = { ...state.activeCursors };
      delete next[clientId];
      return { activeCursors: next };
    }),
}));
