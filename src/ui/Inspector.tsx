import { useState } from 'react';
import type { FixAction, Issue } from '../engine/display';
import { TYPE_SYSTEMS, fontCss } from '../engine/fonts';
import { clampLength } from '../engine/frame';
import { MAX_CONTINUOUS_MM, MEDIA, MIN_CONTINUOUS_MM, mediaById } from '../engine/media';
import { kindById } from '../kinds';
import type { Rec } from '../kinds/types';
import { downloadPng, printBatch } from '../state/print';
import { useKindState, useRecords, useStore } from '../state/store';
import { entityById } from '../db/entities';
import { Field, Section } from './controls';
import { EDITORS, LeadingRecord } from './editors';
import { Icon } from './icons';
import type { BatchItem } from './Stage';

const SEV_ICON = { error: Icon.error, warn: Icon.warn, info: Icon.info };

export function useApplyFix() {
  const setMedia = useStore((s) => s.setMedia);
  const patchKind = useStore((s) => s.patchKind);
  const setOption = useStore((s) => s.setOption);
  const ks = useKindState();
  return (a: FixAction) => {
    if (a.type === 'media') setMedia(a.mediaId);
    else if (a.type === 'length') patchKind({ lengthMm: clampLength(a.lengthMm) });
    else if (a.type === 'option') setOption(a.key, a.value);
    else patchKind({ readAlong: !ks.readAlong });
  };
}

function IssueList({ issues }: { issues: Issue[] }) {
  const apply = useApplyFix();
  if (!issues.length)
    return (
      <div className="allclear">
        <Icon.check /> Ready to print
      </div>
    );
  return (
    <div className="issues">
      {issues.map((i) => {
        const I = SEV_ICON[i.severity];
        return (
          <div key={i.id + i.message} className={`issue ${i.severity}`}>
            <I />
            <div>
              <div className="msg">{i.message}</div>
              {i.detail && <div className="detail">{i.detail}</div>}
              {i.fix && (
                <button className="btn small" onClick={() => apply(i.fix!.action)}>
                  {i.fix.label}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LabelSetup({ preferredLength }: { preferredLength?: number }) {
  const kindId = useStore((s) => s.kindId);
  const ks = useKindState();
  const setMedia = useStore((s) => s.setMedia);
  const patchKind = useStore((s) => s.patchKind);
  const def = kindById(kindId);
  const media = mediaById(ks.mediaId);
  const suggested = def.media.map(mediaById);
  const others = MEDIA.filter((m) => !def.media.includes(m.id));
  const describe = (m: (typeof MEDIA)[number]) => `${m.id} · ${m.name}${m.lengthMm ? `, ${m.widthMm} × ${m.lengthMm} mm` : ''}`;
  const canRotate = media.shape !== 'round' && media.lengthMm !== media.widthMm;
  return (
    <Section title="Label" aside={media.material === 'film' ? 'Film, water-resistant' : undefined}>
      <Field label="Roll">
        <select className="select" value={ks.mediaId} onChange={(e) => setMedia(e.target.value)}>
          <optgroup label={`Suggested for ${def.name.toLowerCase()}`}>
            {suggested.map((m) => (
              <option key={m.id} value={m.id}>
                {describe(m)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other rolls">
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {describe(m)}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      {media.shape === 'continuous' && (
        <Field label="Cut length" hint={preferredLength ? undefined : 'The printer cuts the tape after each label'}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="range" min={MIN_CONTINUOUS_MM} max={Math.min(MAX_CONTINUOUS_MM, 200)} value={ks.lengthMm} onChange={(e) => patchKind({ lengthMm: Number(e.target.value) })} style={{ flex: 1, accentColor: 'var(--accent)' }} aria-label="Cut length in millimetres" />
            <input className="input num" style={{ width: 64 }} type="number" min={MIN_CONTINUOUS_MM} max={MAX_CONTINUOUS_MM} value={ks.lengthMm} onChange={(e) => patchKind({ lengthMm: clampLength(Number(e.target.value) || MIN_CONTINUOUS_MM) })} aria-label="Cut length" />
            <span style={{ color: 'var(--ink-3)' }}>mm</span>
          </div>
          {preferredLength && preferredLength !== ks.lengthMm && (
            <button className="btn small" style={{ justifySelf: 'start', marginTop: 4 }} onClick={() => patchKind({ lengthMm: clampLength(preferredLength) })}>
              Fit to text: {preferredLength} mm
            </button>
          )}
        </Field>
      )}
      {canRotate && (
        <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => patchKind({ readAlong: !ks.readAlong })}>
          <Icon.rotate /> Rotate · text runs {ks.readAlong ? 'along' : 'across'} the tape
        </button>
      )}
    </Section>
  );
}

function TypeSystems() {
  const ks = useKindState();
  const patchKind = useStore((s) => s.patchKind);
  return (
    <Section title="Type">
      <div className="typecards">
        {TYPE_SYSTEMS.map((t) => (
          <button key={t.id} className="typecard" aria-pressed={ks.typeSystemId === t.id} onClick={() => patchKind({ typeSystemId: t.id })}>
            <span className="aa" style={{ font: fontCss(t.roles.strong, 26) }}>
              Ag
            </span>
            <span>
              <b>{t.name}</b>
              <small>{t.description}</small>
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

export function Inspector({ items, activeIndex, activeRec, now }: { items: BatchItem[]; activeIndex: number; activeRec: Rec | null; now: Date }) {
  const kindId = useStore((s) => s.kindId);
  const ks = useKindState();
  const records = useRecords(kindId);
  const saveRecord = useStore((s) => s.saveRecord);
  const setOption = useStore((s) => s.setOption);
  const setActive = useStore((s) => s.setActive);
  const printers = useStore((s) => s.printers);
  const printerId = useStore((s) => s.printerId);
  const copies = useStore((s) => s.copies);
  const locale = useStore((s) => s.locale);
  const org = useStore((s) => s.org);
  const set = useStore((s) => s.set);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const def = kindById(kindId);
  const Editor = EDITORS[kindId];
  const active = items[activeIndex];
  const printer = printers.find((p) => p.id === printerId);

  const flagged = items.filter((i) => i.composed.issues.some((x) => x.severity === 'error' || x.severity === 'warn'));
  const errors = items.filter((i) => i.composed.issues.some((x) => x.severity === 'error')).length;
  const total = items.length * copies;
  const offline = printer?.status === 'offline';

  const print = async () => {
    if (!printer || !org || !items.length) return;
    if (errors && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    setBusy(true);
    const recs = ks.selection.map((id) => records.find((r) => r.id === id)).filter(Boolean) as Rec[];
    try {
      await printBatch({ kindId, recs, ks, locale, org, printer, copies, now: new Date() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="inspector" aria-label="Label settings">
      <div className="scroll">
        {activeRec && Editor ? (
          <>
            <LeadingRecord key={activeRec.id} rec={activeRec} onChange={saveRecord} now={now} />
            <Editor rec={activeRec as never} options={ks.options as never} onChange={(r: Rec) => saveRecord(r)} setOption={(k: string, v: unknown) => setOption(k, v)} now={now} />
          </>
        ) : (
          <Section title={def.name}>
            <div style={{ color: 'var(--ink-3)' }}>Pick {/^[aeiou]/.test(entityById(def.entity).noun) ? 'an' : 'a'} {entityById(def.entity).noun} on the left, or add one.</div>
          </Section>
        )}
        <LabelSetup preferredLength={active?.composed.layout.preferredLengthMm} />
        <TypeSystems />
        <Section title="Preflight" aside={items.length > 1 ? `${items.length - flagged.length} of ${items.length} clean` : undefined}>
          {active && <IssueList issues={active.composed.issues} />}
          {items.length > 1 && flagged.length > 0 && (
            <div className="field">
              <span>Other labels in this batch</span>
              <div className="chips">
                {flagged
                  .filter((f) => f !== active)
                  .map((f) => (
                    <button key={f.id} className="chip" onClick={() => setActive(f.id)} title={f.composed.issues[0]?.message}>
                      <span className={`sev-dot ${f.composed.issues.some((x) => x.severity === 'error') ? 'error' : 'warn'}`} style={{ marginRight: 5 }} />
                      {f.title}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </Section>
      </div>
      <div className="print-bar">
        <div className="line">
          <div className="stepper" aria-label="Copies">
            <button onClick={() => set('copies', Math.max(1, copies - 1))} aria-label="Fewer copies">
              −
            </button>
            <span className="num" aria-live="polite">
              {copies}×
            </span>
            <button onClick={() => set('copies', Math.min(99, copies + 1))} aria-label="More copies">
              +
            </button>
          </div>
          <button className={`btn ${confirming ? 'warn' : 'primary'}`} style={confirming ? { flex: 1, height: 36 } : undefined} onClick={print} disabled={!items.length || busy || offline || !printer}>
            <Icon.printer />
            {confirming ? `Print anyway (${errors} with errors)` : `Print ${total} ${total === 1 ? 'label' : 'labels'}`}
          </button>
          <button
            className="btn icon"
            style={{ height: 36, width: 36 }}
            title="Download the 300 dpi print raster as PNG"
            aria-label="Download PNG"
            disabled={!activeRec || !org}
            onClick={() => activeRec && org && downloadPng({ kindId, rec: activeRec, ks, locale, org, printer, now })}
          >
            <Icon.download />
          </button>
        </div>
        <div className={`note${offline ? ' bad' : ''}`}>
          {offline
            ? `${printer?.name} is offline. Choose another printer at the top.`
            : printer
              ? `On ${printer.name} (${printer.model}) · ${printer.loadedMedia} loaded`
              : 'No printer'}
          {!offline && <> · <span className="kbd">⌘P</span></>}
        </div>
      </div>
    </aside>
  );
}
