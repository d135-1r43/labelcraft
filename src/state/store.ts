import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockApi } from '../api/mock';
import type { LabelcraftApi, Organisation, PrintJob, Printer } from '../api/types';
import { landscapeReadAlong } from '../engine/frame';
import { mediaById } from '../engine/media';
import type { TypeLocale } from '../engine/typeset';
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

  org: Organisation | null;
  printers: Printer[];
  records: Partial<Record<KindId, Rec[]>>;
  loading: Partial<Record<KindId, boolean>>;
  syncedAt: Partial<Record<KindId, number>>;
  /** Records created or edited in Labelcraft, by kind and id. */
  drafts: Partial<Record<KindId, Record<string, Rec>>>;
  jobs: PrintJob[];

  setKind(id: KindId): void;
  patchKind(patch: Partial<KindState>): void;
  setOption(key: string, value: unknown): void;
  setMedia(mediaId: string): void;
  setActive(id: string): void;
  toggleSelected(id: string): void;
  setSelection(ids: string[]): void;
  saveDraft(rec: Rec): void;
  createRecord(): void;
  removeDraft(id: string): void;
  set<K extends keyof Store>(key: K, value: Store[K]): void;
  load(kind: KindId, force?: boolean): Promise<void>;
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
        org: null,
        printers: [],
        records: {},
        loading: {},
        syncedAt: {},
        drafts: {},
        jobs: [],

        setKind(id) {
          set({ kindId: id });
          void get().load(id);
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
        saveDraft(rec) {
          const kind = get().kindId;
          set((s) => ({ drafts: { ...s.drafts, [kind]: { ...(s.drafts[kind] ?? {}), [rec.id]: rec } } }));
        },
        createRecord() {
          const def = kindById(get().kindId);
          const rec = def.source.create?.();
          if (!rec) return;
          get().saveDraft(rec);
          get().setActive(rec.id);
        },
        removeDraft(id) {
          const kind = get().kindId;
          set((s) => {
            const d = { ...(s.drafts[kind] ?? {}) };
            delete d[id];
            return { drafts: { ...s.drafts, [kind]: d } };
          });
          const k = get().kinds[kind];
          const isLocal = id.startsWith('local-');
          if (isLocal && k.selection.includes(id)) get().toggleSelected(id);
        },
        set(key, value) {
          set({ [key]: value } as Partial<Store>);
        },
        async load(kind, force) {
          if (!force && (get().records[kind] || get().loading[kind])) return;
          set((s) => ({ loading: { ...s.loading, [kind]: true } }));
          const recs = await kindById(kind).source.load(api);
          set((s) => ({
            records: { ...s.records, [kind]: recs },
            loading: { ...s.loading, [kind]: false },
            syncedAt: { ...s.syncedAt, [kind]: Date.now() },
          }));
          // First visit: start with something on the label.
          const ks = get().kinds[kind];
          if (!ks.activeId && recs[0]) {
            set((s) => ({ kinds: { ...s.kinds, [kind]: { ...s.kinds[kind], activeId: recs[0].id, selection: [recs[0].id] } } }));
          }
        },
        async boot() {
          const [org, printers] = await Promise.all([api.organisation(), api.printers()]);
          set({ org, printers });
          await get().load(get().kindId);
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
      version: 1,
      partialize: (s) => ({ kindId: s.kindId, kinds: s.kinds, locale: s.locale, printerId: s.printerId, view: s.view, guides: s.guides, loupe: s.loupe, drafts: s.drafts }),
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

/** Records of a kind: the source's records with local edits applied, plus records created here. */
export function recordsOf(s: Pick<Store, 'records' | 'drafts'>, kind: KindId): Rec[] {
  const base = s.records[kind] ?? [];
  const drafts = s.drafts[kind] ?? {};
  const ids = new Set(base.map((r) => r.id));
  return [...base.map((r) => drafts[r.id] ?? r), ...Object.values(drafts).filter((d) => !ids.has(d.id))];
}

export const useKindState = () => useStore((s) => s.kinds[s.kindId]);
