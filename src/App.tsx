import { useEffect, useMemo, useState } from 'react';
import { loadFonts } from './engine/fonts';
import { kindById } from './kinds';
import { compose, useNow } from './state/compose';
import { entityById } from './db/entities';
import { useKindState, useRecords, useStore } from './state/store';
import { Inspector } from './ui/Inspector';
import { KindRail, SourcePanel } from './ui/Source';
import { Stage, type BatchItem } from './ui/Stage';
import { Preferences } from './ui/Preferences';
import { TopBar } from './ui/TopBar';

function Toast() {
  const job = useStore((s) => s.jobs[0]);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!job) return;
    setVisible(true);
    if (job.state === 'done' || job.state === 'failed') {
      const t = setTimeout(() => setVisible(false), job.state === 'failed' ? 7000 : 3500);
      return () => clearTimeout(t);
    }
  }, [job]);
  if (!job || !visible) return null;
  const text =
    job.state === 'queued'
      ? `Sending to ${job.printerName}…`
      : job.state === 'printing'
        ? `Printing ${job.printed + 1} of ${job.total} on ${job.printerName}`
        : job.state === 'done'
          ? `Printed ${job.total} ${job.total === 1 ? 'label' : 'labels'} on ${job.printerName}`
          : job.error;
  return (
    <div className={`toast ${job.state}`} role="status">
      {text}
    </div>
  );
}

export function App() {
  const [fontsReady, setFontsReady] = useState(false);
  const boot = useStore((s) => s.boot);
  const kindId = useStore((s) => s.kindId);
  const ks = useKindState();
  const all = useRecords(kindId);
  const locale = useStore((s) => s.locale);
  const org = useStore((s) => s.org);
  const printers = useStore((s) => s.printers);
  const printerId = useStore((s) => s.printerId);
  const setActive = useStore((s) => s.setActive);
  const set = useStore((s) => s.set);
  const now = useNow();

  useEffect(() => {
    void loadFonts().then(() => setFontsReady(true));
    void boot();
  }, [boot]);

  const byId = useMemo(() => new Map(all.map((r) => [r.id, r])), [all]);
  const printer = printers.find((p) => p.id === printerId);
  const def = kindById(kindId);
  const entity = entityById(def.entity);

  // Food labels follow the clock; everything else only recomposes when its inputs change.
  const clock = kindId === 'food' ? now : null;
  const items: BatchItem[] = useMemo(() => {
    if (!fontsReady || !org) return [];
    return ks.selection
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((rec) => ({ id: rec.id, title: entity.title(rec), composed: compose({ kindId, rec, ks, locale, org, printer, now: clock ?? new Date() }) }));
  }, [fontsReady, org, ks, byId, def, entity, kindId, locale, printer, clock]);

  const activeIndex = Math.max(0, items.findIndex((i) => i.id === ks.activeId));
  const activeRec = (ks.activeId && byId.get(ks.activeId)) || null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        (document.querySelector('.print-bar .btn.primary, .print-bar .btn.warn') as HTMLButtonElement | null)?.click();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' && items[activeIndex + 1]) setActive(items[activeIndex + 1].id);
      else if (e.key === 'ArrowLeft' && items[activeIndex - 1]) setActive(items[activeIndex - 1].id);
      else if (e.key === 'g') set('guides', !useStore.getState().guides);
      else if (e.key === 'l') set('loupe', !useStore.getState().loupe);
      else if (e.key === 'd') set('view', useStore.getState().view === 'dots' ? 'vector' : 'dots');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, activeIndex, setActive, set]);

  if (!fontsReady || !org) return <div className="boot">Loading type…</div>;

  return (
    <div className="app">
      <TopBar />
      <KindRail />
      <SourcePanel />
      <Stage items={items} activeIndex={activeIndex} />
      <Inspector items={items} activeIndex={activeIndex} activeRec={activeRec} now={now} />
      <Toast />
      <Preferences />
    </div>
  );
}
