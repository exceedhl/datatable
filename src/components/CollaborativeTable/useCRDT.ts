import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';

export function useCRDT(room: string, currentUser: { id: string; name: string; color: string }) {
  const [data, setData] = useState<any[]>([]);
  const ydocRef = useRef<Y.Doc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ymapRef = useRef<Y.Map<any> | null>(null);
  const [awarenessStates, setAwarenessStates] = useState<Record<string, any>>({});

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const ymap = ydoc.getMap('data');
    ymapRef.current = ymap;

    // --- Data Observer ---
    const updateData = () => {
      const arr: any[] = [];
      let orderCounter = 0;
      for (const [key, val] of ymap.entries()) {
        const item = val instanceof Y.Map ? val.toJSON() : val;
        const itemData: Record<string, any> = typeof item === 'object' && item !== null ? item : { value: item };
        // Assign implicit _order if missing (based on insertion order in Y.Map)
        if (itemData._order == null) {
          itemData._order = orderCounter;
        }
        arr.push({ ...itemData, _yMapRef: val, _id: key });
        orderCounter++;
      }
      // Sort by _order to maintain stable positioning
      arr.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
      setData(arr);
    };
    ymap.observeDeep(updateData);

    // --- WebSocket Connection ---
    const wsUrl = `ws://localhost:3001/api/sandbox-ws/${room}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WS] Connected to room: ${room}`);
    };

    ws.onmessage = (event) => {
      try {
        const update = new Uint8Array(event.data);
        Y.applyUpdate(ydoc, update);
      } catch (err) {
        console.error('[WS] Error applying incoming update:', err);
      }
    };

    ws.onclose = () => {
      console.log(`[WS] Disconnected from room: ${room}`);
    };

    // Listen for local changes and broadcast
    const onLocalUpdate = (update: Uint8Array, origin: any) => {
      if (origin !== 'remote' && ws.readyState === WebSocket.OPEN) {
        ws.send(update);
      }
    };
    ydoc.on('update', onLocalUpdate);

    return () => {
      ydoc.off('update', onLocalUpdate);
      ws.close();
      ydoc.destroy();
    };
  }, [room]);

  // Helper: get current data sorted by _order
  const getOrderedData = useCallback((): { id: string; order: number }[] => {
    const ymap = ymapRef.current;
    if (!ymap) return [];
    const items: { id: string; order: number }[] = [];
    let counter = 0;
    for (const [key, val] of ymap.entries()) {
      const item = val instanceof Y.Map ? val.toJSON() : val;
      const order = item?._order ?? counter;
      items.push({ id: key, order });
      counter++;
    }
    items.sort((a, b) => a.order - b.order);
    return items;
  }, []);

  const updateCell = useCallback((rowId: string, columnId: string, value: any) => {
    const rowMap = ymapRef.current?.get(rowId) as Y.Map<any> | undefined;
    if (rowMap) {
      rowMap.set(columnId, value);
    }
  }, []);

  // DT-C8: Add row at the end
  const addRow = useCallback((defaultData?: Record<string, any>): string => {
    const rowId = uuidv4();
    const ymap = ymapRef.current;
    if (ymap) {
      // Find max _order
      const ordered = getOrderedData();
      const maxOrder = ordered.length > 0 ? ordered[ordered.length - 1].order : 0;
      const rowMap = new Y.Map();
      rowMap.set('_order', maxOrder + 1000);
      if (defaultData) {
        Object.entries(defaultData).forEach(([k, v]) => rowMap.set(k, v));
      }
      ymap.set(rowId, rowMap);
    }
    return rowId;
  }, [getOrderedData]);

  // DT-C8: Add N rows near a specific row (before/after)
  const addRowsNear = useCallback((anchorRowId: string, position: 'before' | 'after', count: number, defaultData?: Record<string, any>): string[] => {
    const newIds: string[] = [];
    const ymap = ymapRef.current;
    const ydoc = ydocRef.current;
    if (!ymap || !ydoc) return newIds;

    const ordered = getOrderedData();
    const anchorIdx = ordered.findIndex(r => r.id === anchorRowId);
    if (anchorIdx < 0) return newIds;

    const anchorOrder = ordered[anchorIdx].order;
    let neighborOrder: number;

    if (position === 'before') {
      neighborOrder = anchorIdx > 0 ? ordered[anchorIdx - 1].order : anchorOrder - 1000;
    } else {
      neighborOrder = anchorIdx < ordered.length - 1 ? ordered[anchorIdx + 1].order : anchorOrder + 1000;
    }

    // Distribute new rows evenly between anchor and neighbor
    const step = (neighborOrder - anchorOrder) / (count + 1);

    ydoc.transact(() => {
      for (let i = 0; i < count; i++) {
        const rowId = uuidv4();
        const rowMap = new Y.Map();
        const newOrder = anchorOrder + step * (i + 1);
        rowMap.set('_order', newOrder);
        if (defaultData) {
          Object.entries(defaultData).forEach(([k, v]) => rowMap.set(k, v));
        }
        ymap.set(rowId, rowMap);
        newIds.push(rowId);
      }
    });

    return newIds;
  }, [getOrderedData]);

  // DT-C8: Delete single row
  const deleteRow = useCallback((rowId: string) => {
    ymapRef.current?.delete(rowId);
  }, []);

  // DT-C8: Delete multiple rows
  const deleteRows = useCallback((rowIds: string[]) => {
    const ydoc = ydocRef.current;
    const ymap = ymapRef.current;
    if (ydoc && ymap) {
      ydoc.transact(() => {
        rowIds.forEach(id => ymap.delete(id));
      });
    }
  }, []);

  return {
    data,
    updateCell,
    addRow,
    addRowsNear,
    deleteRow,
    deleteRows,
    wsRef,
    awarenessStates,
    setAwarenessStates,
    currentUser,
  };
}
