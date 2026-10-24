import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ENTITIES, hostOf, isUri, type EntityDef } from '../db/entities';
import { useDb } from '../db/store';
import { renderVector } from '../engine/render';
import { kindById } from '../kinds';
import type { KindId } from '../kinds/types';
import { compose } from '../state/compose';
import { useStore } from '../state/store';
import { accountApi } from '../api/http';
import { countryName, SUPPORTED_COUNTRIES } from '../kinds/address/address';
import { Field, TextInput } from './controls';
import { Icon } from './icons';

const PREVIEW = { w: 236, h: 132 };

/** The label this entity prints, set from its first record with the current settings. */
function MiniLabel({ kindId, entity }: { kindId: KindId; entity: EntityDef }) {
  const ks = useStore((s) => s.kinds[kindId]);
  const locale = useStore((s) => s.locale);
  const org = useStore((s) => s.org);
  const first = useDb((d) => d.collections[entity.id][0]);
  const ref = useRef<HTMLCanvasElement>(null);
  const composed = useMemo(() => {
    if (!org) return null;
    const rec = first ?? { id: 'preview', ...entity.blank() };
    return compose({ kindId, rec, ks, locale, org, now: new Date() });
  }, [kindId, entity, first, ks, locale, org]);
  const frame = composed?.frame;
  const scale = frame ? Math.min((PREVIEW.w - 24) / frame.wMm, (PREVIEW.h - 24) / frame.hMm, 4) : 1;
  const w = frame ? frame.wMm * scale : 0;
  const h = frame ? frame.hMm * scale : 0;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !composed) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    renderVector(ctx, composed.layout.ops, composed.frame, scale);
  }, [composed, w, h, scale]);

  if (!frame) return null;
  const radius = frame.shape === 'round' ? '50%' : frame.shape === 'continuous' ? '1px' : `${Math.min(6, 1.5 * scale)}px`;
  return (
    <figure className="mini">
      <canvas ref={ref} style={{ width: w, height: h, borderRadius: radius }} aria-hidden />
      <figcaption>
        {frame.media.id} · {frame.media.name}
      </figcaption>
    </figure>
  );
}

const SENDER_SAVE_DELAY_MS = 500;
let senderTimer: ReturnType<typeof setTimeout> | undefined;
const countries = [...SUPPORTED_COUNTRIES].sort((a, b) => countryName(a, 'en').localeCompare(countryName(b, 'en')));

/** The return address on address labels and the owner on asset tags. */
function SenderCard() {
  const org = useStore((s) => s.org);
  const set = useStore((s) => s.set);
  const [error, setError] = useState<string | null>(null);
  if (!org) return null;
  const a = org.address;
  const change = (patch: Partial<typeof org>, address?: Partial<typeof a>) => {
    const next = { ...org, ...patch, address: { ...a, ...address } };
    set('org', next);
    clearTimeout(senderTimer);
    senderTimer = setTimeout(() => {
      accountApi.setSender(next).then(
        () => setError(null),
        (e: Error) => setError(e.message),
      );
    }, SENDER_SAVE_DELAY_MS);
  };
  const line = [a.street && `${a.street} ${a.houseNumber ?? ''}`.trim(), [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  return (
    <article className="sender-card">
      <div className="content">
        <div className="head">
          <span className="name">Sender</span>
          <small>Your return address on address labels, and the owner on asset tags</small>
        </div>
        <div className="row">
          <Field label="Name or organisation">
            <TextInput value={org.name} onChange={(v) => change({ name: v }, { company: v || undefined })} />
          </Field>
          <Field label="Country">
            <select className="select" value={a.country} onChange={(e) => change({}, { country: e.target.value })}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c, 'en')}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row street">
          <Field label="Street">
            <TextInput value={a.street} onChange={(v) => change({}, { street: v || undefined })} />
          </Field>
          <Field label="No.">
            <TextInput value={a.houseNumber} onChange={(v) => change({}, { houseNumber: v || undefined })} />
          </Field>
        </div>
        <div className="row pc">
          <Field label="Postcode">
            <TextInput value={a.postalCode} onChange={(v) => change({}, { postalCode: v || undefined })} />
          </Field>
          <Field label="Town or city">
            <TextInput value={a.city} onChange={(v) => change({}, { city: v || undefined })} />
          </Field>
        </div>
        <p className="explain">{error ? <span className="bad">Not saved. {error}</span> : line ? <>Printed as: {[org.name, line].join(' · ')}</> : 'No return address yet.'}</p>
      </div>
    </article>
  );
}

function EntityCard({ entity, lastOn }: { entity: EntityDef; lastOn: boolean }) {
  const prefs = useStore((s) => s.entities[entity.id]);
  const setEntity = useStore((s) => s.setEntity);
  const records = useDb((d) => d.collections[entity.id]);
  const reset = useDb((d) => d.reset);
  const [confirmReset, setConfirmReset] = useState(false);
  const kindId = entity.kinds[0];
  const labelName = entity.kinds.map((k) => kindById(k).name).join(', ');
  const linked = records.filter((r) => r.uri).length;
  const urlValid = !prefs.baseUrl || isUri(prefs.baseUrl);
  const example = records.find((r) => r.uri && prefs.baseUrl && r.uri.startsWith(prefs.baseUrl))?.uri ?? (prefs.baseUrl && urlValid ? `${prefs.baseUrl}…` : null);
  const count = `${records.length} ${records.length === 1 ? entity.noun : entity.plural}`;
  const system = prefs.name || hostOf(prefs.baseUrl);

  return (
    <article className={`entity-card${prefs.enabled ? '' : ' off'}`} aria-labelledby={`entity-${entity.id}`}>
      <div className="preview">
        <MiniLabel kindId={kindId} entity={entity} />
      </div>
      <div className="content">
        <label className="toggle head">
          <span className="label">
            <span id={`entity-${entity.id}`} className="name">
              {labelName}
            </span>
            <small>
              {prefs.enabled ? (
                <>
                  Prints {entity.name.toLowerCase()} · {count}
                  {prefs.baseUrl && records.length > 0 && <>, {linked === records.length ? 'all linked' : `${records.length - linked} not linked`}</>}
                </>
              ) : (
                <>Hidden from the sidebar. The {count} stay saved.</>
              )}
            </small>
          </span>
          <input type="checkbox" checked={prefs.enabled} disabled={lastOn} onChange={(e) => setEntity(entity.id, { enabled: e.target.checked })} />
          <span className="switch" aria-hidden title={lastOn ? 'One label type always stays on' : undefined} />
        </label>

        {prefs.enabled && (
          <>
            <div className="row system">
              <Field label="Leading system" hint="Owns these records">
                <TextInput value={prefs.name} placeholder={entity.system.name || 'e.g. CRM'} onChange={(v) => setEntity(entity.id, { name: v })} />
              </Field>
              <Field label="Record links start with" hint={!urlValid ? 'Not a complete address. Start with https://' : undefined}>
                <TextInput className="input num" value={prefs.baseUrl} invalid={!urlValid} placeholder="https://…" spellCheck={false} onChange={(v) => setEntity(entity.id, { baseUrl: v.trim() })} />
              </Field>
            </div>
            <p className="explain">
              {example ? (
                <>
                  Each {entity.noun} links to its original in {system}, for example
                  <span className="example num" title={example}>
                    {example}
                  </span>
                </>
              ) : (
                <>No leading system: {entity.name.toLowerCase()} live only in Labelcraft.</>
              )}
            </p>
            <div className="actions">
              {confirmReset ? (
                <>
                  <span>Replace all {count} with the samples?</span>
                  <button className="btn small danger" onClick={() => (reset(entity.id), setConfirmReset(false))}>
                    Replace
                  </button>
                  <button className="btn ghost small" onClick={() => setConfirmReset(false)}>
                    Keep mine
                  </button>
                </>
              ) : (
                <button className="btn ghost small" onClick={() => setConfirmReset(true)}>
                  Restore sample {entity.plural}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export function Preferences() {
  const open = useStore((s) => s.prefsOpen);
  const set = useStore((s) => s.set);
  const entities = useStore((s) => s.entities);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const onCount = ENTITIES.filter((e) => entities[e.id].enabled).length;
  return (
    <dialog ref={ref} className="prefs" aria-labelledby="prefs-title" onClose={() => set('prefsOpen', false)} onClick={(e) => e.target === ref.current && set('prefsOpen', false)}>
      <header>
        <h2 id="prefs-title">Preferences</h2>
        <button className="btn icon ghost" aria-label="Close" onClick={() => set('prefsOpen', false)}>
          <Icon.close />
        </button>
      </header>
      {open && (
        <div className="body">
          <SenderCard />
          <div className="intro">
            <h3>Label types</h3>
            <p>Switch on the labels you print. Each one prints from its own list of records, which Labelcraft keeps a copy of. Where those records are really maintained, in your CRM or inventory, is the leading system. Every record links back to it.</p>
            <ol className="flow" aria-label="How records flow">
              <li>Leading system</li>
              <li>Labelcraft copy</li>
              <li>Printed label</li>
            </ol>
          </div>
          {ENTITIES.map((e) => (
            <EntityCard key={e.id} entity={e} lastOn={onCount === 1 && entities[e.id].enabled} />
          ))}
        </div>
      )}
      <footer>
        <span className="meta">Saved in this browser as you type</span>
        <button className="btn primary" onClick={() => set('prefsOpen', false)}>
          Done
        </button>
      </footer>
    </dialog>
  );
}
