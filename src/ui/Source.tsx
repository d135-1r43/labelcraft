import { useMemo, useState } from 'react';
import { KINDS, kindById } from '../kinds';
import type { KindId } from '../kinds/types';
import { recordsOf, useKindState, useStore } from '../state/store';
import { relativeTime } from './controls';
import { Icon } from './icons';

export function KindRail() {
  const kindId = useStore((s) => s.kindId);
  const setKind = useStore((s) => s.setKind);
  return (
    <nav className="rail" aria-label="Label types">
      {KINDS.map((k) => {
        const I = Icon[k.id as KindId];
        return (
          <button key={k.id} aria-current={k.id === kindId ? 'page' : undefined} onClick={() => setKind(k.id)} title={`${k.name}: ${k.tagline}`}>
            <I />
            {k.name}
          </button>
        );
      })}
    </nav>
  );
}

export function SourcePanel() {
  const kindId = useStore((s) => s.kindId);
  const def = kindById(kindId);
  const records = useStore((s) => s.records);
  const drafts = useStore((s) => s.drafts);
  const loading = useStore((s) => s.loading[kindId]);
  const syncedAt = useStore((s) => s.syncedAt[kindId]);
  const load = useStore((s) => s.load);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const setActive = useStore((s) => s.setActive);
  const setSelection = useStore((s) => s.setSelection);
  const createRecord = useStore((s) => s.createRecord);
  const ks = useKindState();
  const [query, setQuery] = useState('');

  const all = useMemo(() => recordsOf({ records, drafts }, kindId), [records, drafts, kindId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => `${def.source.title(r)} ${def.source.subtitle(r)} ${def.source.group?.(r) ?? ''}`.toLowerCase().includes(q));
  }, [all, query, def]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const g = def.source.group?.(r) ?? '';
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    return [...map.entries()];
  }, [filtered, def]);

  const selected = new Set(ks.selection);
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <aside className="source" aria-label={def.source.name}>
      <header>
        <h2>
          {def.source.name}
          <small>{all.length ? `${all.length} ${all.length === 1 ? def.source.noun : def.source.noun + (def.source.noun.endsWith('s') ? 'es' : 's')}` : ''}</small>
        </h2>
        {!def.source.editable && (
          <div className="sync">
            <span className="dot" />
            {loading ? 'Syncing…' : syncedAt ? `Live from ${def.source.name.toLowerCase()} · synced ${relativeTime(syncedAt)}` : ''}
            <button className="btn ghost small" style={{ marginLeft: 'auto' }} onClick={() => load(kindId, true)} disabled={loading}>
              Refresh
            </button>
          </div>
        )}
        <div className="search">
          <Icon.search />
          <input className="input" placeholder={`Search ${def.source.name.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${def.source.name}`} />
        </div>
        <div className="batchbar">
          <span>
            {ks.selection.length <= 1 ? 'Tick several to print a batch' : <><b className="num">{ks.selection.length}</b> in this batch</>}
          </span>
          {filtered.length > 1 && (
            <button className="btn ghost small" onClick={() => setSelection(allFilteredSelected ? ks.selection.filter((id) => !filtered.some((r) => r.id === id)) : [...new Set([...ks.selection, ...filtered.map((r) => r.id)])])}>
              {allFilteredSelected ? 'Clear' : query ? 'Select matches' : 'Select all'}
            </button>
          )}
        </div>
      </header>
      <div className="list" role="list">
        {loading && !all.length && [0, 1, 2, 3, 4].map((i) => <div className="skeleton" key={i} />)}
        {!loading && filtered.length === 0 && <div className="empty">{query ? `Nothing matches “${query}”.` : `No ${def.source.noun}s yet.`}</div>}
        {groups.map(([group, recs]) => (
          <div key={group || '_'}>
            {group && <div className="group">{group}</div>}
            {recs.map((r) => (
              <div key={r.id} role="listitem" className="item" aria-current={ks.activeId === r.id} onClick={() => setActive(r.id)}>
                <input
                  type="checkbox"
                  className="check"
                  checked={selected.has(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelected(r.id)}
                  aria-label={`Include ${def.source.title(r)} in batch`}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="title">{def.source.title(r)}</div>
                  <div className="sub">{def.source.subtitle(r) || ' '}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {def.source.editable && (
        <footer>
          <button className="btn" style={{ flex: 1 }} onClick={createRecord}>
            <Icon.plus />
            New {def.source.noun}
          </button>
        </footer>
      )}
    </aside>
  );
}
