/**
 * Labelcraft's own database: one collection per entity, kept in the browser.
 * Records are working copies; each carries the URI of its leading record.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ENTITIES, entityById, type EntityId } from './entities';
import { SEED } from './seed';
import type { DbRecord } from './types';

interface Db {
  collections: Record<EntityId, DbRecord[]>;
  /** Insert or replace a record and stamp it as changed. */
  put(entity: EntityId, rec: DbRecord): void;
  create(entity: EntityId): DbRecord;
  remove(entity: EntityId, id: string): void;
  /** Replace a collection with the sample data. */
  reset(entity: EntityId): void;
}

const seed = (id: EntityId) => (SEED[id] as DbRecord[]).map((r) => ({ ...r }));
const newId = (entity: EntityId) => `${entity.slice(0, 3)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const useDb = create<Db>()(
  persist(
    (set) => ({
      collections: Object.fromEntries(ENTITIES.map((e) => [e.id, seed(e.id)])) as Record<EntityId, DbRecord[]>,
      put(entity, rec) {
        const stamped = { ...rec, updatedAt: new Date().toISOString() };
        set((s) => {
          const list = s.collections[entity];
          const i = list.findIndex((r) => r.id === rec.id);
          const next = i < 0 ? [...list, stamped] : list.map((r, j) => (j === i ? stamped : r));
          return { collections: { ...s.collections, [entity]: next } };
        });
      },
      create(entity) {
        const rec = { ...entityById(entity).blank(), id: newId(entity), updatedAt: new Date().toISOString() } as DbRecord;
        set((s) => ({ collections: { ...s.collections, [entity]: [...s.collections[entity], rec] } }));
        return rec;
      },
      remove(entity, id) {
        set((s) => ({ collections: { ...s.collections, [entity]: s.collections[entity].filter((r) => r.id !== id) } }));
      },
      reset(entity) {
        set((s) => ({ collections: { ...s.collections, [entity]: seed(entity) } }));
      },
    }),
    {
      name: 'labelcraft-db',
      version: 1,
      partialize: (s) => ({ collections: s.collections }),
      // An entity added in a later release starts with its sample data.
      merge: (persisted, current) => ({ ...current, collections: { ...current.collections, ...(persisted as Partial<Db>)?.collections } }),
    },
  ),
);
