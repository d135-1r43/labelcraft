import { useMemo, useState } from 'react';
import { entityById, hostOf } from '../db/entities';
import { useDb } from '../db/store';
import { KINDS, kindById } from '../kinds';
import type { KindId } from '../kinds/types';
import { enabledKinds, useKindState, useRecords, useStore } from '../state/store';
import { Icon } from './icons';

export function KindRail() {
  const kindId = useStore((s) => s.kindId);
  const setKind = useStore((s) => s.setKind);
  const entities = useStore((s) => s.entities);
  const enabled = enabledKinds(entities);
  return (
    <nav className="rail" aria-label="Label types">
      {KINDS.filter((k) => enabled.includes(k.id)).map((k) => {
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
  const entity = entityById(kindById(kindId).entity);
  const prefs = useStore((s) => s.entities[entity.id]);
  const all = useRecords(kindId);
  const set = useStore((s) => s.set);
  const saveError = useDb((d) => d.saveError);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const setActive = useStore((s) => s.setActive);
  const setSelection = useStore((s) => s.setSelection);
  const createRecord = useStore((s) => s.createRecord);
  const ks = useKindState();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => `${entity.title(r)} ${entity.subtitle(r)} ${entity.group(r) ?? ''}`.toLowerCase().includes(q));
  }, [all, query, entity]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const g = entity.group(r) ?? '';
      map.set(g, [...(map.get(g) ?? []), r]);
    }
    return [...map.entries()];
  }, [filtered, entity]);

  const selected = new Set(ks.selection);
  const unlinked = all.filter((r) => !r.uri).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <aside className="source" aria-label={entity.name}>
      <header>
        <h2>
          {entity.name}
          <small>{all.length ? `${all.length} ${all.length === 1 ? entity.noun : entity.plural}` : ''}</small>
        </h2>
        <button className="leading" onClick={() => set('prefsOpen', true)} title="Change in Preferences">
          <Icon.link />
          {prefs.baseUrl ? (
            <span>
              Leads: <b>{prefs.name || hostOf(prefs.baseUrl)}</b>
              {prefs.name && hostOf(prefs.baseUrl) ? <> · {hostOf(prefs.baseUrl)}</> : null}
              {unlinked > 0 && <em> · {unlinked} not linked</em>}
            </span>
          ) : (
            <span>Kept in Labeleur only</span>
          )}
        </button>
        {saveError && (
          <div className="save-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="search">
          <Icon.search />
          <input className="input" placeholder={`Search ${entity.name.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${entity.name}`} />
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
        {filtered.length === 0 && <div className="empty">{query ? `Nothing matches “${query}”.` : `No ${entity.plural} yet. Add the first one below.`}</div>}
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
                  aria-label={`Include ${entity.title(r)} in batch`}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    {entity.title(r)}
                    {prefs.baseUrl && !r.uri && <span className="unlinked" title={`Not linked to ${prefs.name || 'the leading system'}`} />}
                  </div>
                  <div className="sub">{entity.subtitle(r) || ' '}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <footer>
        <button className="btn" style={{ flex: 1 }} onClick={createRecord}>
          <Icon.plus />
          New {entity.noun}
        </button>
      </footer>
    </aside>
  );
}
