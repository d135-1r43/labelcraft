import { useState } from 'react';
import type { Contact, FoodProduct, InventoryItem, StorageLocation } from '../api/types';
import { countryName, normalizePostcode, parseAddress, ruleFor, SUPPORTED_COUNTRIES } from '../kinds/address/address';
import type { AddressOptions } from '../kinds/address/kind';
import type { AssetOptions } from '../kinds/asset/kind';
import { ALLERGENS, useBy, type FoodOptions } from '../kinds/food/kind';
import { locationCode, type LocationOptions } from '../kinds/location/kind';
import type { TextNote, TextOptions } from '../kinds/text/kind';
import { useStore } from '../state/store';
import { Field, Section, Segmented, TextInput, Toggle, relativeTime } from './controls';
import { Icon } from './icons';

export interface EditorProps<R, O> {
  rec: R;
  options: O;
  edited: boolean;
  onChange(rec: R): void;
  setOption(key: keyof O & string, value: unknown): void;
  now: Date;
}

/* ───────── address ───────── */

const ENDORSEMENTS = {
  de: ['Einschreiben', 'Prio', 'Bitte nicht knicken', 'Zerbrechlich'],
  en: ['Registered', 'Priority', 'Do not bend', 'Fragile'],
};

function PasteAddress({ country, onParsed }: { country: string; onParsed: (a: ReturnType<typeof parseAddress>) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [unplaced, setUnplaced] = useState<string[]>([]);
  if (!open)
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Paste an address…
      </button>
    );
  const apply = (t: string) => {
    if (!t.trim()) return;
    const r = parseAddress(t, country);
    setUnplaced(r.unplaced);
    onParsed(r);
  };
  return (
    <div className="paste">
      <Field label="Paste from an e-mail, order or signature" hint="Lines are sorted into fields. Phone numbers and e-mail addresses are ignored.">
        <textarea
          className="input"
          rows={5}
          autoFocus
          value={text}
          placeholder={'Frau Dr. Erika Schwarz\nKunstmühle Schwarz GmbH\nAm Mühlbach 3\n83022 Rosenheim'}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            setTimeout(() => apply(t), 0);
          }}
        />
      </Field>
      {unplaced.length > 0 && <div className="unplaced">Not placed: {unplaced.join(' · ')}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn primary small" onClick={() => apply(text)} disabled={!text.trim()}>
          Fill fields
        </button>
        <button className="btn ghost small" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}

const countryOptions = [...SUPPORTED_COUNTRIES].sort((a, b) => countryName(a, 'en').localeCompare(countryName(b, 'en')));

export function AddressEditor({ rec, options, edited, onChange, setOption }: EditorProps<Contact, AddressOptions>) {
  const locale = useStore((s) => s.locale);
  const removeDraft = useStore((s) => s.removeDraft);
  const rule = ruleFor(rec.country);
  const set = (patch: Partial<Contact>) => onChange({ ...rec, ...patch });
  const pcValid = !rec.postalCode || !rule.postcode || rule.postcode.re.test(normalizePostcode(rec.country, rec.postalCode) ?? '');
  const isLocal = rec.id.startsWith('local-');
  const cityLabel = rec.country === 'GB' ? 'Post town' : rec.country === 'US' || rec.country === 'CA' ? 'City' : 'Town or city';

  const street = (
    <div className={`row street${rule.numberFirst ? ' number-first' : ''}`}>
      {rule.numberFirst && (
        <Field label="No.">
          <TextInput value={rec.houseNumber} onChange={(v) => set({ houseNumber: v })} />
        </Field>
      )}
      <Field label="Street">
        <TextInput value={rec.street} onChange={(v) => set({ street: v })} autoComplete="off" />
      </Field>
      {!rule.numberFirst && (
        <Field label="No.">
          <TextInput value={rec.houseNumber} onChange={(v) => set({ houseNumber: v })} />
        </Field>
      )}
    </div>
  );

  const postcode = (
    <Field label={rec.country === 'US' ? 'ZIP code' : 'Postcode'} hint={!pcValid ? `Expected like ${rule.postcode?.example}` : undefined}>
      <TextInput value={rec.postalCode} invalid={!pcValid} onChange={(v) => set({ postalCode: v })} onBlur={() => set({ postalCode: normalizePostcode(rec.country, rec.postalCode) })} placeholder={rule.postcode?.example} />
    </Field>
  );
  const city = (
    <Field label={cityLabel}>
      <TextInput value={rec.city} onChange={(v) => set({ city: v })} />
    </Field>
  );

  return (
    <>
      <Section
        title="Recipient"
        aside={
          edited ? (
            <button className="btn ghost small" onClick={() => removeDraft(rec.id)}>
              {isLocal ? 'Delete' : 'Revert to contact'}
            </button>
          ) : (
            'From contacts'
          )
        }
      >
        <PasteAddress country={rec.country} onParsed={({ address }) => onChange({ id: rec.id, group: rec.group, ...address })} />
        <Field label="Country" hint={rec.country === useStore.getState().org?.address.country ? 'Domestic: no country line' : 'Country line added in the label language'}>
          <select className="select" value={rec.country} onChange={(e) => set({ country: e.target.value, postalCode: normalizePostcode(e.target.value, rec.postalCode) })}>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {countryName(c, 'en')}
              </option>
            ))}
          </select>
        </Field>
        <div className="row">
          <Field label="Salutation">
            <select className="select" value={rec.honorific ?? ''} onChange={(e) => set({ honorific: e.target.value || undefined })}>
              <option value="">None</option>
              {rule.honorifics.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <TextInput value={rec.title} onChange={(v) => set({ title: v || undefined })} placeholder="Dr." />
          </Field>
        </div>
        <div className="row">
          <Field label="Given name">
            <TextInput value={rec.givenName} onChange={(v) => set({ givenName: v })} />
          </Field>
          <Field label="Family name">
            <TextInput value={rec.familyName} onChange={(v) => set({ familyName: v })} />
          </Field>
        </div>
        <Field label="Company">
          <TextInput value={rec.company} onChange={(v) => set({ company: v || undefined })} />
        </Field>
        {(rec.department !== undefined || rec.company) && (
          <Field label="Department">
            <TextInput value={rec.department} onChange={(v) => set({ department: v || undefined })} />
          </Field>
        )}
        {street}
        <Field label="Address line 2" hint="c/o, apartment, building, PO box">
          <TextInput value={rec.extra} onChange={(v) => set({ extra: v || undefined })} />
        </Field>
        {rec.country === 'GB' ? (
          <>
            {city}
            <div className="row">{postcode}</div>
          </>
        ) : (
          <div className="row pc">
            {postcode}
            {city}
          </div>
        )}
        {(rule.regionLabel || rec.region) && (
          <Field label={rule.regionLabel ?? 'Region'}>
            <TextInput value={rec.region} onChange={(v) => set({ region: v.toUpperCase() || undefined })} placeholder={rec.country === 'US' ? 'NY' : rec.country === 'CA' ? 'QC' : ''} />
          </Field>
        )}
      </Section>
      <Section title="Layout">
        <Toggle checked={options.showSender} onChange={(v) => setOption('showSender', v)} label="Return address" hint="Your address in one line above the recipient" />
        <Toggle checked={options.emphasiseName} onChange={(v) => setOption('emphasiseName', v)} label="Emphasise the addressee" hint="First line one weight heavier" />
        <Field label="Endorsement" hint="Printed in capitals above the address; red on two-colour tape">
          <TextInput value={options.endorsement} onChange={(v) => setOption('endorsement', v)} placeholder="None" />
        </Field>
        <div className="chips">
          {ENDORSEMENTS[locale].map((e) => (
            <button key={e} className="chip" aria-pressed={options.endorsement === e} onClick={() => setOption('endorsement', options.endorsement === e ? '' : e)}>
              {e}
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ───────── asset ───────── */

export function AssetEditor({ rec, options, setOption, now }: EditorProps<InventoryItem, AssetOptions>) {
  const org = useStore((s) => s.org);
  return (
    <>
      <Section title="Asset" aside="Read-only, from inventory">
        <div className="record-card">
          <div className="head">
            <span className="linked">
              <Icon.link /> Linked · changed {relativeTime(rec.updatedAt, now.getTime())}
            </span>
            <span className="num">{rec.assetTag}</span>
          </div>
          <dl>
            <dt>Name</dt>
            <dd>{rec.name}</dd>
            {rec.model && (
              <>
                <dt>Model</dt>
                <dd>{rec.model}</dd>
              </>
            )}
            <dt>Serial</dt>
            <dd className="num">{rec.serial ?? '—'}</dd>
            <dt>Location</dt>
            <dd>{rec.location}</dd>
            <dt>Assigned to</dt>
            <dd>{rec.owner ?? 'Pool'}</dd>
            <dt>Code opens</dt>
            <dd className="num" style={{ fontSize: 12 }}>
              {options.symbology === 'qr' ? `${org?.inventoryUrl}${rec.assetTag}` : rec.assetTag}
            </dd>
          </dl>
        </div>
      </Section>
      <Section title="Layout">
        <Field label="Code" hint={options.symbology === 'qr' ? 'Any phone camera opens the inventory record' : 'Smaller for the same data; needs a scanner app'}>
          <Segmented
            block
            label="Code"
            value={options.symbology}
            onChange={(v) => setOption('symbology', v)}
            options={[
              { value: 'qr', label: 'QR code' },
              { value: 'datamatrix', label: 'Data Matrix' },
            ]}
          />
        </Field>
        <Field label="Details line">
          <select className="select" value={options.detail} onChange={(e) => setOption('detail', e.target.value)}>
            <option value="serial">Serial number</option>
            <option value="location">Location</option>
            <option value="both">Serial and location</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Toggle checked={options.ownerLine} onChange={(v) => setOption('ownerLine', v)} label="Ownership line" hint={`“Property of ${org?.name ?? 'your organisation'}”`} />
      </Section>
    </>
  );
}

/* ───────── location ───────── */

export function LocationEditor({ rec, options, setOption }: EditorProps<StorageLocation, LocationOptions>) {
  return (
    <>
      <Section title="Location" aside="Read-only, from warehouse">
        <div className="record-card">
          <div className="head">
            <span>{rec.area}</span>
            <span className="num">{locationCode(rec)}</span>
          </div>
          <dl>
            {rec.segments.map((s) => (
              <FragmentRow key={s.label} k={s.label[0].toUpperCase() + s.label.slice(1)} v={s.value} />
            ))}
            <dt>Contents</dt>
            <dd>{rec.contents}</dd>
            <dt>Direction</dt>
            <dd>{rec.arrow ? { up: 'Shelf above the label', down: 'Shelf below the label', left: 'To the left', right: 'To the right' }[rec.arrow] : 'Not set'}</dd>
          </dl>
        </div>
      </Section>
      <Section title="Layout">
        <Toggle checked={options.arrow === 'auto'} onChange={(v) => setOption('arrow', v ? 'auto' : 'none')} label="Direction arrow" hint="Points at the shelf the label belongs to" />
        <Toggle checked={options.barcode} onChange={(v) => setOption('barcode', v)} label="Barcode" hint="Code 128 for scanners; left off where it would not scan" />
        <Toggle checked={options.contents} onChange={(v) => setOption('contents', v)} label="Contents line" />
      </Section>
    </>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </>
  );
}

/* ───────── food ───────── */

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function FoodEditor({ rec, options, setOption, now }: EditorProps<FoodProduct, FoodOptions>) {
  const locale = useStore((s) => s.locale);
  const { until } = useBy(rec, options, now);
  const hours = rec.shelfLifeHours;
  const life = hours < 24 ? `${hours} hours` : hours < 24 * 60 ? `${Math.round(hours / 24)} days` : `${Math.round(hours / 24 / 30)} months`;
  const untilText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(until);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffH = (until.getTime() - now.getTime()) / 3600_000;
  const rel = Math.abs(diffH) < 48 ? rtf.format(Math.round(diffH), 'hour') : rtf.format(Math.round(diffH / 24), 'day');
  return (
    <>
      <Section title="Product" aside="From recipes">
        <div className="record-card">
          <div className="head">
            <span>{rec.category}</span>
            <span>{{ chilled: 'Chilled', frozen: 'Frozen', ambient: 'Ambient' }[rec.storage]}</span>
          </div>
          <dl>
            <dt>Name</dt>
            <dd>{rec.name}</dd>
            <dt>Shelf life</dt>
            <dd>{life}</dd>
            <dt>Allergens</dt>
            <dd>{rec.allergens.length ? rec.allergens.map((a) => `${a} ${ALLERGENS[a][locale]}`).join(', ') : 'None declared'}</dd>
          </dl>
        </div>
      </Section>
      <Section title="This batch">
        <Toggle checked={options.preparedAt === null} onChange={(v) => setOption('preparedAt', v ? null : now.toISOString())} label="Prepared just now" hint="Follows the clock until you print" />
        {options.preparedAt !== null && (
          <Field label="Prepared at">
            <input className="input" type="datetime-local" value={toLocalInput(new Date(options.preparedAt))} onChange={(e) => e.target.value && setOption('preparedAt', new Date(e.target.value).toISOString())} />
          </Field>
        )}
        <Field label="Prepared by" hint="Initials, for traceability">
          <TextInput value={options.preparedBy} maxLength={4} onChange={(v) => setOption('preparedBy', v.toUpperCase())} />
        </Field>
        <div className="allclear" style={{ background: 'var(--accent-soft)', color: 'var(--ink)', display: 'grid', gap: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Use by</span>
          <b style={{ fontWeight: 600 }}>{untilText}</b>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{rel}</span>
        </div>
        <Toggle checked={options.allergens} onChange={(v) => setOption('allergens', v)} label="Allergen line" hint="EU Regulation 1169/2011" />
      </Section>
    </>
  );
}

/* ───────── text ───────── */

export function TextEditor({ rec, options, onChange, setOption, edited }: EditorProps<TextNote, TextOptions>) {
  const removeDraft = useStore((s) => s.removeDraft);
  return (
    <>
      <Section
        title="Text"
        aside={
          edited ? (
            <button className="btn ghost small" onClick={() => removeDraft(rec.id)}>
              {rec.id.startsWith('local-') ? 'Delete' : 'Revert'}
            </button>
          ) : undefined
        }
      >
        <Field label="Heading" hint="Quotes, dashes and units are typeset for you. Return forces a line break.">
          <textarea className="input" rows={2} value={rec.title} onChange={(e) => onChange({ ...rec, title: e.target.value })} />
        </Field>
        <Field label="Second line">
          <TextInput value={rec.subtitle} onChange={(v) => onChange({ ...rec, subtitle: v })} placeholder="Optional" />
        </Field>
      </Section>
      <Section title="Layout">
        <Field label="Alignment">
          <Segmented
            block
            label="Alignment"
            value={options.align}
            onChange={(v) => setOption('align', v)}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centred' },
            ]}
          />
        </Field>
        <Toggle checked={options.caps} onChange={(v) => setOption('caps', v)} label="Capitals" hint="Letterspaced, in the display weight" />
      </Section>
    </>
  );
}

export const EDITORS: Record<string, (p: EditorProps<never, never>) => JSX.Element> = {
  address: AddressEditor as never,
  asset: AssetEditor as never,
  location: LocationEditor as never,
  food: FoodEditor as never,
  text: TextEditor as never,
};
