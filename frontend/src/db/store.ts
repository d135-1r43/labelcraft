/**
 * The records Labeleur keeps, mirrored from the server. Edits apply here
 * at once and are saved shortly after the typing stops; each record carries
 * the URI of its original in the leading system.
 */
import { create } from 'zustand';
import { recordsApi } from '../api/http';
import { ENTITIES, entityById, type EntityId } from './entities';
import type { DbRecord } from './types';

interface Db {
  collections: Record<EntityId, DbRecord[]>;
  loaded: boolean;
  /** The last save that failed, until the next one succeeds. */
  saveError: string | null;
  load(): Promise<void>;
  /** Replace a record locally and save it to the server. */
  put(entity: EntityId, rec: DbRecord): void;
  create(entity: EntityId): DbRecord;
  remove(entity: EntityId, id: string): void;
  /** Replace a collection with the sample records. */
  reset(entity: EntityId): Promise<void>;
}

const SAVE_DELAY_MS = 400;
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; entity: EntityId; rec: DbRecord }>();
const newId = (entity: EntityId) => `${entity.slice(0, 3)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const empty = () => Object.fromEntries(ENTITIES.map((e) => [e.id, []])) as unknown as Record<EntityId, DbRecord[]>;

export const useDb = create<Db>()((set, get) => {
  const replace = (entity: EntityId, rec: DbRecord) =>
    set((s) => {
      const list = s.collections[entity];
      const i = list.findIndex((r) => r.id === rec.id);
      return { collections: { ...s.collections, [entity]: i < 0 ? [...list, rec] : list.map((r, j) => (j === i ? rec : r)) } };
    });

  const save = async (entity: EntityId, rec: DbRecord) => {
    try {
      await recordsApi.put(entity, rec);
      if (get().saveError) set({ saveError: null });
    } catch (e) {
      set({ saveError: `${entityById(entity).title(rec)} was not saved. ${(e as Error).message}` });
    }
  };

  const schedule = (entity: EntityId, rec: DbRecord, delay = SAVE_DELAY_MS) => {
    const key = `${entity}/${rec.id}`;
    clearTimeout(pending.get(key)?.timer);
    pending.set(key, {
      entity,
      rec,
      timer: setTimeout(() => {
        pending.delete(key);
        void save(entity, rec);
      }, delay),
    });
  };

  return {
    collections: empty(),
    loaded: false,
    saveError: null,
    async load() {
      const lists = await Promise.all(ENTITIES.map((e) => recordsApi.list(e.id)));
      set({ collections: Object.fromEntries(ENTITIES.map((e, i) => [e.id, lists[i]])) as Record<EntityId, DbRecord[]>, loaded: true });
    },
    put(entity, rec) {
      const stamped = { ...rec, updatedAt: new Date().toISOString() };
      replace(entity, stamped);
      schedule(entity, stamped);
    },
    create(entity) {
      const rec = { ...entityById(entity).blank(), id: newId(entity), updatedAt: new Date().toISOString() } as DbRecord;
      replace(entity, rec);
      schedule(entity, rec, 0);
      return rec;
    },
    remove(entity, id) {
      const key = `${entity}/${id}`;
      clearTimeout(pending.get(key)?.timer);
      pending.delete(key);
      set((s) => ({ collections: { ...s.collections, [entity]: s.collections[entity].filter((r) => r.id !== id) } }));
      recordsApi.remove(entity, id).catch((e: Error) => set({ saveError: `Not removed on the server. ${e.message}` }));
    },
    async reset(entity) {
      set((s) => ({ collections: { ...s.collections, [entity]: [] } }));
      const recs = await recordsApi.reset(entity);
      set((s) => ({ collections: { ...s.collections, [entity]: recs } }));
    },
  };
});

// Leaving the page must not lose the last keystrokes.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const { entity, rec } of pending.values()) {
      navigator.sendBeacon?.(`/api/records/${entity}/${encodeURIComponent(rec.id)}`, new Blob([JSON.stringify(rec)], { type: 'application/json' }));
    }
  });
}
