/**
 * IndexedDB Offline Sync Queue Engine for IGNOU SC-2033
 * 
 * Safely persists outgoing mutations (ADD_INTAKE, EDIT_INTAKE, DELETE_INTAKE, UPDATE_MARKS)
 * locally when network is unavailable or Google Sheets is temporarily unreachable.
 * Implements exponential backoff auto-retry and notifies listeners in real-time.
 */

export type SyncActionType =
  | 'ADD_INTAKE'
  | 'EDIT_INTAKE'
  | 'DELETE_INTAKE'
  | 'UPDATE_MARKS'
  | 'LOCK_MARKS'
  | 'UPDATE_DATE'
  | 'CUSTOM_MUTATION';

export interface SyncQueueItem {
  id: string;
  type: SyncActionType;
  actionLabel: string;
  payload: any;
  endpoint?: string;
  queuedAt: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

const DB_NAME = 'ignou_sc2033_sync_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sync_queue';

// In-memory fallback if IndexedDB is blocked or unsupported
let memoryQueueFallback: SyncQueueItem[] = [];

type QueueChangeListener = (items: SyncQueueItem[]) => void;
const listeners: Set<QueueChangeListener> = new Set();

function notifyListeners(items: SyncQueueItem[]) {
  listeners.forEach((fn) => {
    try {
      fn(items);
    } catch (e) {
      console.warn('[SyncQueue] Listener notification error:', e);
    }
  });
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = (err) => {
        console.warn('[SyncQueue] IndexedDB open error, falling back to memory/localStorage:', err);
        resolve(null);
      };
    } catch (err) {
      console.warn('[SyncQueue] IndexedDB exception:', err);
      resolve(null);
    }
  });
}

/**
 * Retrieve all pending sync queue items sorted by queuedAt ascending
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  if (!db) {
    try {
      const saved = localStorage.getItem('ignou_sc2033_fallback_sync_queue');
      if (saved) {
        memoryQueueFallback = JSON.parse(saved);
      }
    } catch {}
    return [...memoryQueueFallback];
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result || []) as SyncQueueItem[];
        results.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
        resolve(results);
      };

      req.onerror = () => {
        resolve([...memoryQueueFallback]);
      };
    } catch {
      resolve([...memoryQueueFallback]);
    }
  });
}

/**
 * Enqueue a new mutation to be synced to Google Sheets
 */
export async function enqueueSyncMutation(
  type: SyncActionType,
  actionLabel: string,
  payload: any,
  endpoint?: string
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type,
    actionLabel,
    payload,
    endpoint,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    maxAttempts: 10,
    status: 'pending',
  };

  const db = await openDB();
  if (!db) {
    memoryQueueFallback.push(item);
    try {
      localStorage.setItem('ignou_sc2033_fallback_sync_queue', JSON.stringify(memoryQueueFallback));
    } catch {}
    notifyListeners([...memoryQueueFallback]);
    return item;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(item);

      req.onsuccess = async () => {
        const all = await getPendingSyncItems();
        notifyListeners(all);
        resolve(item);
      };

      req.onerror = () => {
        memoryQueueFallback.push(item);
        notifyListeners([...memoryQueueFallback]);
        resolve(item);
      };
    } catch {
      memoryQueueFallback.push(item);
      notifyListeners([...memoryQueueFallback]);
      resolve(item);
    }
  });
}

/**
 * Update the attempt count, last error, or status of an existing queue item
 */
export async function updateSyncItemStatus(
  id: string,
  updates: Partial<Pick<SyncQueueItem, 'status' | 'attempts' | 'lastError' | 'lastAttemptAt'>>
): Promise<void> {
  const db = await openDB();
  if (!db) {
    const idx = memoryQueueFallback.findIndex((i) => i.id === id);
    if (idx !== -1) {
      memoryQueueFallback[idx] = { ...memoryQueueFallback[idx], ...updates };
      try {
        localStorage.setItem('ignou_sc2033_fallback_sync_queue', JSON.stringify(memoryQueueFallback));
      } catch {}
      notifyListeners([...memoryQueueFallback]);
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing = getReq.result as SyncQueueItem;
        if (existing) {
          const merged = { ...existing, ...updates };
          store.put(merged);
        }
      };

      tx.oncomplete = async () => {
        const all = await getPendingSyncItems();
        notifyListeners(all);
        resolve();
      };

      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Remove an item from the pending sync queue (after successful dispatch or manual discard)
 */
export async function removeSyncItem(id: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    memoryQueueFallback = memoryQueueFallback.filter((i) => i.id !== id);
    try {
      localStorage.setItem('ignou_sc2033_fallback_sync_queue', JSON.stringify(memoryQueueFallback));
    } catch {}
    notifyListeners([...memoryQueueFallback]);
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);

      tx.oncomplete = async () => {
        const all = await getPendingSyncItems();
        notifyListeners(all);
        resolve();
      };

      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Clear all items from the pending sync queue
 */
export async function clearAllSyncQueue(): Promise<void> {
  memoryQueueFallback = [];
  try {
    localStorage.removeItem('ignou_sc2033_fallback_sync_queue');
  } catch {}

  const db = await openDB();
  if (!db) {
    notifyListeners([]);
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();

      tx.oncomplete = () => {
        notifyListeners([]);
        resolve();
      };

      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Subscribe to real-time sync queue mutations
 */
export function subscribeToSyncQueue(callback: QueueChangeListener): () => void {
  listeners.add(callback);
  // Initial broadcast
  getPendingSyncItems().then((items) => {
    callback(items);
  });

  return () => {
    listeners.delete(callback);
  };
}

let isProcessingQueue = false;

/**
 * Sequentially process pending queue items with exponential backoff delay calculation
 */
export async function processSyncQueue(
  dispatcher: (item: SyncQueueItem) => Promise<boolean>
): Promise<{ succeeded: number; failed: number }> {
  if (isProcessingQueue) {
    return { succeeded: 0, failed: 0 };
  }

  isProcessingQueue = true;
  let succeeded = 0;
  let failed = 0;

  try {
    const queue = await getPendingSyncItems();
    for (const item of queue) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        // Stop processing if offline
        break;
      }

      // Check exponential backoff (1s * 2^attempts, max 60s)
      const delayMs = Math.min(1000 * Math.pow(2, item.attempts), 60000);
      if (item.lastAttemptAt) {
        const elapsed = Date.now() - new Date(item.lastAttemptAt).getTime();
        if (elapsed < delayMs) {
          continue; // Not ready for backoff retry yet
        }
      }

      await updateSyncItemStatus(item.id, {
        status: 'syncing',
        attempts: item.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
      });

      try {
        const success = await dispatcher(item);
        if (success) {
          await removeSyncItem(item.id);
          succeeded++;
        } else {
          await updateSyncItemStatus(item.id, {
            status: 'failed',
            lastError: 'Google Sheets sync endpoint rejected mutation',
          });
          failed++;
        }
      } catch (err: any) {
        await updateSyncItemStatus(item.id, {
          status: 'failed',
          lastError: err?.message || 'Network error during queue dispatch',
        });
        failed++;
      }
    }
  } finally {
    isProcessingQueue = false;
  }

  return { succeeded, failed };
}

// Automatically bind window 'online' event to trigger background sync queue resolution
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SyncQueue] Browser online event detected. Pending queue ready for automatic processing.');
    getPendingSyncItems().then((items) => notifyListeners(items));
  });
  window.addEventListener('offline', () => {
    console.log('[SyncQueue] Browser offline event detected.');
    getPendingSyncItems().then((items) => notifyListeners(items));
  });
}
