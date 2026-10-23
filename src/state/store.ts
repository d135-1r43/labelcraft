import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockApi } from '../api/mock';
import type { LabelcraftApi, Organisation, PrintJob, Printer } from '../api/types';
import { landscapeReadAlong } from '../engine/frame';
import { mediaById } from '../engine/media';
import type { TypeLocale } from '../engine/typeset';
import { defaultEntityPrefs, entityById, type EntityId, type EntityPrefs } from '../db/entities';
import { useDb } from '../db/store';
import { KINDS, kindById } from '../kinds';
import type { KindId, Rec } from '../kinds/types';

export const api: LabelcraftApi = mockApi;

export interface KindState {
  mediaId: string;
  readAlong: boolean;
  lengthMm: number;
  typeSystemId: string;
  options: Record<string, unknown>;
  /** The batch, in print order. */
  selection: string[];
  activeId: string | null;
}

export type ViewMode = 'vector' | 'dots';

interface Store {
  kindId: KindId;
  kinds: Record<KindId, KindState>;
  locale: TypeLocale;
  printerId: string;
  copies: number;
  view: ViewMode;
  guides: boolean;
  loupe: boolean;
  zoom: number | 'fit';

  /** Which entities are switched on, and where each one's leading records live. */
  entities: Record<EntityId, EntityPrefs>;
  prefsOpen: boolean;

  org: Organisation | null;
  printers: Printer[];
  jobs: PrintJob[];

  setKind(id: KindId): void;
  patchKind(patch: Partial<KindState>): void;
  setOption(key: string, value: unknown): void;
  setMedia(mediaId: string): void;
  setActive(id: string): void;
  toggleSelected(id: string): void;
  setSelection(ids: string[]): void;
  saveRecord(rec: Rec): void;
  createRecord(): void;
  deleteRecord(id: string): void;
  setEntity(id: EntityId, patch: Partial<EntityPrefs>): void;
  set<K extends keyof Store>(key: K, value: Store[K]): void;
  boot(): Promise<void>;
  refreshPrinters(): Promise<void>;
  upsertJob(job: PrintJob): void;
}

const initialKinds = Object.fromEntries(
  KINDS.map((k) => {
    const media = mediaById(k.defaultMedia);
    return [
      k.id,
      {
        mediaId: k.defaultMedia,
        readAlong: landscapeReadAlong(media),
        lengthMm: 80,
        typeSystemId: k.defaultTypeSystem,
        options: { ...k.defaultOptions },
        selection: [],
        activeId: null,
      } satisfies KindState,
    ];
  }),
) as unknown as Record<KindId, KindState>;

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const patchCurrent = (fn: (k: KindState) => Partial<KindState>) =>
        set((s) => ({ kinds: { ...s.kinds, [s.kindId]: { ...s.kinds[s.kindId], ...fn(s.kinds[s.kindId]) } } }));
      return {
        kindId: 'address',
        kinds: initialKinds,
        locale: 'de',
        printerId: 'p-office',
        copies: 1,
        view: 'vector',
        guides: true,
        loupe: true,
        zoom: 'fit',
        entities: defaultEntityPrefs(),
        prefsOpen: false,
        org: null,
        printers: [],
        jobs: [],

        setKind(id) {
          set({ kindId: id });
          ensureActive(id);
        },
        patchKind(patch) {
          patchCurrent(() => patch);
        },
        setOption(key, value) {
          patchCurrent((k) => ({ options: { ...k.options, [key]: value } }));
        },
        setMedia(mediaId) {
          const media = mediaById(mediaId);
          patchCurrent(() => ({ mediaId, readAlong: landscapeReadAlong(media) }));
        },
        setActive(id) {
          patchCurrent((k) => ({ activeId: id, selection: k.selection.includes(id) ? k.selection : [...k.selection, id] }));
        },
        toggleSelected(id) {
          patchCurrent((k) => {
            if (k.selection.includes(id)) {
              const selection = k.selection.filter((x) => x !== id);
              return { selection, activeId: k.activeId === id ? (selection[0] ?? null) : k.activeId };
            }
            return { selection: [...k.selection, id], activeId: k.activeId ?? id };
          });
        },
        setSelection(ids) {
          patchCurrent((k) => ({ selection: ids, activeId: ids.includes(k.activeId ?? '') ? k.activeId : (ids[0] ?? null) }));
        },
        saveRecord(rec) {
          useDb.getState().put(kindById(get().kindId).entity, rec);
        },
        createRecord() {
          const rec = useDb.getState().create(kindById(get().kindId).entity);
          get().setActive(rec.id);
        },
        deleteRecord(id) {
          const entity = kindById(get().kindId).entity;
          useDb.getState().remove(entity, id);
          // Take it out of every batch that prints this entity.
          set((s) => {
            const kinds = { ...s.kinds };
            for (const k of entityById(entity).kinds) {
              const selection = kinds[k].selection.filter((x) => x !== id);
              kinds[k] = { ...kinds[k], selection, activeId: kinds[k].activeId === id ? (selection[0] ?? null) : kinds[k].activeId };
            }
            return { kinds };
          });
        },
        setEntity(id, patch) {
          set((s) => ({ entities: { ...s.entities, [id]: { ...s.entities[id], ...patch } } }));
          // Never leave the person on a label whose data was just switched off.
          const s = get();
          if (!s.entities[kindById(s.kindId).entity].enabled) {
            const next = enabledKinds(s.entities)[0];
            if (next) s.setKind(next);
          }
        },
        set(key, value) {
          set({ [key]: value } as Partial<Store>);
        },
        async boot() {
          const [org, printers] = await Promise.all([api.organisation(), api.printers()]);
          set({ org, printers });
          const kinds = enabledKinds(get().entities);
          if (!kinds.includes(get().kindId) && kinds[0]) set({ kindId: kinds[0] });
          ensureActive(get().kindId);
        },
        async refreshPrinters() {
          set({ printers: await api.printers() });
        },
        upsertJob(job) {
          set((s) => {
            const others = s.jobs.filter((j) => j.id !== job.id);
            return { jobs: [job, ...others].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20) };
          });
        },
      };
    },
    {
      name: 'labelcraft',
      version: 2,
      partialize: (s) => ({ kindId: s.kindId, kinds: s.kinds, locale: s.locale, printerId: s.printerId, view: s.view, guides: s.guides, loupe: s.loupe, entities: s.entities }),
      // Version 1 kept edits as drafts over records loaded from the API; the database now holds them.
      migrate: (persisted) => {
        const { drafts: _drafts, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        return rest;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<Store>;
        // New option keys added after a release must still get their defaults.
        const kinds = { ...current.kinds };
        for (const k of KINDS) {
          const saved = p.kinds?.[k.id];
          if (saved) kinds[k.id] = { ...current.kinds[k.id], ...saved, options: { ...k.defaultOptions, ...saved.options } };
        }
        const entities = { ...current.entities };
        for (const [id, prefs] of Object.entries(p.entities ?? {})) if (id in entities) entities[id as EntityId] = { ...entities[id as EntityId], ...prefs };
        return { ...current, ...p, kinds, entities };
      },
    },
  ),
);

/** The kinds whose entity is switched on, in rail order. */
export const enabledKinds = (entities: Record<EntityId, EntityPrefs>) => KINDS.filter((k) => entities[k.entity].enabled).map((k) => k.id);

/** The records a kind prints, straight from the database. */
export const useRecords = (kind: KindId) => useDb((d) => d.collections[kindById(kind).entity]);

/** First visit to a kind: start with something on the label. */
function ensureActive(kind: KindId) {
  const s = useStore.getState();
  const ks = s.kinds[kind];
  const recs = useDb.getState().collections[kindById(kind).entity];
  if (ks.activeId && recs.some((r) => r.id === ks.activeId)) return;
  const first = recs.find((r) => ks.selection.includes(r.id)) ?? recs[0];
  if (!first) return;
  useStore.setState((st) => ({ kinds: { ...st.kinds, [kind]: { ...st.kinds[kind], activeId: first.id, selection: ks.selection.includes(first.id) ? ks.selection : [first.id] } } }));
}

export const useKindState = () => useStore((s) => s.kinds[s.kindId]);
