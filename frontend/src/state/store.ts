import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { accountApi, httpApi, settingsApi, type Me } from '../api/http';
import type { LabeleurApi, Organisation, PdfMode, PrintJob, Printer } from '../api/types';
import { decodeBitmap } from '../engine/bitmap';
import { landscapeReadAlong } from '../engine/frame';
import { mediaById } from '../engine/media';
import type { TypeLocale } from '../engine/typeset';
import { defaultEntityPrefs, entityById, type EntityId, type EntityPrefs } from '../db/entities';
import { useDb } from '../db/store';
import { KINDS, kindById } from '../kinds';
import type { KindId, Rec } from '../kinds/types';

export const api: LabeleurApi = httpApi;

const SETTINGS_SAVE_DELAY_MS = 500;
const settingsTimers = new Map<EntityId, ReturnType<typeof setTimeout>>();

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
  /** How print jobs become PDFs. */
  pdfMode: PdfMode;
  view: ViewMode;
  guides: boolean;
  loupe: boolean;
  zoom: number | 'fit';

  /** Which entities are switched on, and where each one's leading records live. */
  entities: Record<EntityId, EntityPrefs>;
  /** The signed-in user. */
  me: Me | null;
  /** Why the app could not start, if it could not. */
  bootError: string | null;
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
  deleteRecords(ids: string[]): void;
  setEntity(id: EntityId, patch: Partial<EntityPrefs>): void;
  set<K extends keyof Store>(key: K, value: Store[K]): void;
  boot(): Promise<void>;
  /** Upload a new logo, or remove it with null. */
  setLogo(file: File | null): Promise<void>;
  refreshPrinters(): Promise<void>;
  upsertJob(job: PrintJob): void;
}

export const initialKinds = Object.fromEntries(
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
        pdfMode: 'raster',
        view: 'vector',
        guides: true,
        loupe: true,
        zoom: 'fit',
        entities: defaultEntityPrefs(),
        bootError: null,
        me: null,
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
        deleteRecords(ids) {
          const entity = kindById(get().kindId).entity;
          for (const id of ids) useDb.getState().remove(entity, id);
          // Take them out of every batch that prints this entity.
          set((s) => {
            const kinds = { ...s.kinds };
            for (const k of entityById(entity).kinds) {
              const selection = kinds[k].selection.filter((x) => !ids.includes(x));
              const activeId = kinds[k].activeId;
              kinds[k] = { ...kinds[k], selection, activeId: activeId && ids.includes(activeId) ? (selection[0] ?? null) : activeId };
            }
            return { kinds };
          });
        },
        setEntity(id, patch) {
          set((s) => ({ entities: { ...s.entities, [id]: { ...s.entities[id], ...patch } } }));
          clearTimeout(settingsTimers.get(id));
          settingsTimers.set(
            id,
            setTimeout(() => {
              settingsApi.put(id, get().entities[id]).catch(() => {
                /* An incomplete address is shown inline; the next valid edit saves. */
              });
            }, SETTINGS_SAVE_DELAY_MS),
          );
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
          try {
            // First, so a new user's sample data exists before anything else is read.
            const me = await accountApi.me();
            const [org, printers, jobs, entities] = await Promise.all([api.organisation().then(withLogo), api.printers(), api.jobs(), settingsApi.all(), useDb.getState().load()]);
            set({ me, org, printers, jobs, entities: { ...get().entities, ...entities }, bootError: null });
          } catch (e) {
            set({ bootError: (e as Error).message });
            return;
          }
          const kinds = enabledKinds(get().entities);
          if (!kinds.includes(get().kindId) && kinds[0]) set({ kindId: kinds[0] });
          ensureActive(get().kindId);
          openLinkedRecord();
        },
        async setLogo(file) {
          // Decode first: a file the browser cannot draw never reaches the server.
          const logo = file ? await decodeBitmap(file).catch(() => Promise.reject(new Error('This file is not an image the browser can read.'))) : undefined;
          const org = file ? await accountApi.uploadLogo(file) : await accountApi.removeLogo();
          set((s) => ({ org: s.org && { ...s.org, logoUpdatedAt: org.logoUpdatedAt, logo } }));
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
      name: 'labeleur',
      version: 3,
      partialize: (s) => ({ kindId: s.kindId, kinds: s.kinds, locale: s.locale, printerId: s.printerId, view: s.view, guides: s.guides, loupe: s.loupe, pdfMode: s.pdfMode }),
      // Version 1 kept edits as drafts, version 2 kept entity settings; both live on the server now.
      migrate: (persisted) => {
        const { drafts: _drafts, entities: _entities, ...rest } = (persisted ?? {}) as Record<string, unknown>;
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
        return { ...current, ...p, kinds };
      },
    },
  ),
);

/** Fetch and decode the logo, if there is one. A logo that fails to load is left off the labels. */
async function withLogo(org: Organisation): Promise<Organisation> {
  if (!org.logoUpdatedAt) return org;
  try {
    const blob = await accountApi.logo();
    return blob ? { ...org, logo: await decodeBitmap(blob) } : org;
  } catch {
    return org;
  }
}

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

/** A scanned code links to /r/{entity}/{id}: show that record on its label, then drop the path. */
function openLinkedRecord() {
  const link = location.pathname.match(/^\/r\/([a-z]+)\/([^/]+)$/);
  if (!link) return;
  history.replaceState(null, '', '/');
  const entity = link[1] as EntityId;
  const id = decodeURIComponent(link[2]);
  const s = useStore.getState();
  const kind = enabledKinds(s.entities).find((k) => kindById(k).entity === entity);
  if (!kind || !useDb.getState().collections[entity]?.some((r) => r.id === id)) return;
  s.setKind(kind);
  useStore.getState().setActive(id);
}

export const useKindState = () => useStore((s) => s.kinds[s.kindId]);
