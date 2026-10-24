import { useMemo, useState, type JSX } from 'react';
import { entityById, hostOf, isUri, locationCode } from '../db/entities';
import type { AllergenCode, Box, Contact, DbRecord, FoodProduct, InventoryItem, Sign, StorageLocation } from '../db/types';
import { countryName, normalizePostcode, parseAddress, ruleFor, SUPPORTED_COUNTRIES } from '../kinds/address/address';
import type { AddressOptions } from '../kinds/address/kind';
import { assetPayload, type AssetOptions } from '../kinds/asset/kind';
import { boxLink, type ContentsOptions } from '../kinds/contents/kind';
import { ALLERGENS, useBy, type FoodOptions } from '../kinds/food/kind';
import type { LocationOptions } from '../kinds/location/kind';
import type { TextOptions } from '../kinds/text/kind';
import { kindById } from '../kinds';
import { useRecords, useStore } from '../state/store';
import { Field, Section, Segmented, TextInput, Toggle, relativeTime } from './controls';
import { Icon } from './icons';

export interface EditorProps<R, O> {
  rec: R;
  options: O;
  onChange(rec: R): void;
  setOption(key: keyof O & string, value: unknown): void;
  now: Date;
}

/* ───────── the record and its leading system ───────── */

/** The link to the record in its leading system, plus removal of Labeleur's copy. */
export function LeadingRecord({ rec, onChange, now }: { rec: DbRecord; onChange(rec: DbRecord): void; now: Date }) {
  const kindId = useStore((s) => s.kindId);
  const entity = entityById(kindById(kindId).entity);
  const prefs = useStore((s) => s.entities[entity.id]);
  const deleteRecords = useStore((s) => s.deleteRecords);
  const [confirming, setConfirming] = useState(false);
  const uri = rec.uri ?? '';
  const system = prefs.name || hostOf(prefs.baseUrl) || 'the leading system';
  const valid = !uri || isUri(uri);
  const outside = valid && !!uri && !!prefs.baseUrl && !uri.startsWith(prefs.baseUrl);
  const key = entity.key?.(rec);
  const suggestion = !uri && prefs.baseUrl && key ? prefs.baseUrl + encodeURIComponent(key) : null;

  const hint = !valid
    ? 'Not a complete address. It should start with https://'
    : outside
      ? `Outside ${hostOf(prefs.baseUrl)}, where ${system} keeps its ${entity.plural}`
      : uri
        ? `${system} leads. Labeleur prints from its own copy.`
        : prefs.baseUrl
          ? `Not linked. Paste the address of this ${entity.noun} in ${system}.`
          : `Optional. ${entity.name} live in Labeleur unless you set a leading system in Preferences.`;

  return (
    <Section
      title="Record"
      aside={
        <button
          className={`btn ghost small${confirming ? ' danger' : ''}`}
          onClick={() => (confirming ? deleteRecords([rec.id]) : setConfirming(true))}
          onBlur={() => setConfirming(false)}
          title={uri ? `Removes Labeleur's copy. The record in ${system} stays.` : undefined}
        >
          {confirming ? `Remove this ${entity.noun}` : 'Remove'}
        </button>
      }
    >
      <Field label={prefs.baseUrl ? `In ${system}` : 'Link'} hint={hint}>
        <div className="uri">
          <TextInput className="input num" value={uri} invalid={!valid || outside} placeholder={prefs.baseUrl ? `${prefs.baseUrl}…` : 'https://…'} spellCheck={false} onChange={(v) => onChange({ ...rec, uri: v.trim() || undefined })} />
          <a className="btn icon" href={valid && uri ? uri : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!valid || !uri} aria-label={`Open in ${system}`} title={`Open in ${system}`}>
            <Icon.external />
          </a>
        </div>
      </Field>
      {suggestion && (
        <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => onChange({ ...rec, uri: suggestion })}>
          <Icon.link /> Link as …/{encodeURIComponent(key!)}
        </button>
      )}
      {rec.updatedAt && <div className="meta">Changed in Labeleur {relativeTime(rec.updatedAt, now.getTime())}</div>}
    </Section>
  );
}

/** A grouping field (category, area, group) that offers the values already in use. */
function GroupField({ label, value, entityKind, read, onChange }: { label: string; value: string; entityKind: Parameters<typeof useRecords>[0]; read(r: never): string; onChange(v: string): void }) {
  const records = useRecords(entityKind);
  const id = `groups-${entityKind}`;
  const values = useMemo(() => [...new Set(records.map((r) => read(r as never)).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [records, read]);
  return (
    <Field label={label}>
      <TextInput value={value} list={id} onChange={onChange} />
      <datalist id={id}>
        {values.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </Field>
  );
}

const groupOf = {
  contact: (r: Contact) => r.group,
  asset: (r: InventoryItem) => r.category,
  location: (r: StorageLocation) => r.area,
  food: (r: FoodProduct) => r.category,
};

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

export function AddressEditor({ rec, options, onChange, setOption }: EditorProps<Contact, AddressOptions>) {
  const locale = useStore((s) => s.locale);
  const rule = ruleFor(rec.country);
  const set = (patch: Partial<Contact>) => onChange({ ...rec, ...patch });
  const pcValid = !rec.postalCode || !rule.postcode || rule.postcode.re.test(normalizePostcode(rec.country, rec.postalCode) ?? '');
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
      <Section title="Recipient">
        <PasteAddress country={rec.country} onParsed={({ address }) => onChange({ id: rec.id, uri: rec.uri, group: rec.group, note: rec.note, ...address })} />
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
        <GroupField label="Group" value={rec.group} entityKind="address" read={groupOf.contact} onChange={(v) => set({ group: v })} />
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

export function AssetEditor({ rec, options, onChange, setOption }: EditorProps<InventoryItem, AssetOptions>) {
  const org = useStore((s) => s.org);
  const set = (patch: Partial<InventoryItem>) => onChange({ ...rec, ...patch });
  const system = useStore((s) => s.entities.inventory);
  const systemName = system.name || hostOf(system.baseUrl) || 'Inventory system';
  const opens = assetPayload(rec, options, location.origin) || '—';
  return (
    <>
      <Section title="Asset">
        <div className="row">
          <Field label="Asset tag">
            <TextInput className="input num" value={rec.assetTag} onChange={(v) => set({ assetTag: v.toUpperCase() })} placeholder="NL-000000" spellCheck={false} />
          </Field>
          <GroupField label="Category" value={rec.category} entityKind="asset" read={groupOf.asset} onChange={(v) => set({ category: v })} />
        </div>
        <Field label="Name">
          <TextInput value={rec.name} onChange={(v) => set({ name: v })} />
        </Field>
        <div className="row">
          <Field label="Model">
            <TextInput value={rec.model} onChange={(v) => set({ model: v || undefined })} />
          </Field>
          <Field label="Serial number">
            <TextInput className="input num" value={rec.serial} onChange={(v) => set({ serial: v || undefined })} spellCheck={false} />
          </Field>
        </div>
        <Field label="Location">
          <TextInput value={rec.location} onChange={(v) => set({ location: v })} placeholder="Studio · Desk 4" />
        </Field>
        <div className="row">
          <Field label="Assigned to">
            <TextInput value={rec.owner} onChange={(v) => set({ owner: v || undefined })} placeholder="Pool" />
          </Field>
          <Field label="Purchased">
            <input className="input" type="date" value={rec.purchased ?? ''} onChange={(e) => set({ purchased: e.target.value || undefined })} />
          </Field>
        </div>
      </Section>
      <Section title="Layout">
        <Field
          label="Code"
          hint={
            <>
              {options.symbology === 'qr' ? 'Any phone camera opens it: ' : 'Holds the tag; needs a scanner app: '}
              <span className="num">{opens}</span>
            </>
          }
        >
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
        {options.symbology === 'qr' && (
          <Field label="QR code opens" hint={options.qrTarget === 'labeleur' ? 'Scanning asks for a Labeleur sign-in' : rec.uri ? undefined : 'This item has no link yet, so the code holds only the tag'}>
            <Segmented
              block
              label="QR code opens"
              value={options.qrTarget}
              onChange={(v) => setOption('qrTarget', v)}
              options={[
                { value: 'leading', label: systemName },
                { value: 'labeleur', label: 'Labeleur' },
              ]}
            />
          </Field>
        )}
        <Field label="Details line">
          <select className="select" value={options.detail} onChange={(e) => setOption('detail', e.target.value)}>
            <option value="serial">Serial number</option>
            <option value="location">Location</option>
            <option value="both">Serial and location</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Toggle checked={options.ownerLine} onChange={(v) => setOption('ownerLine', v)} label="Ownership line" hint={`“Property of ${org?.name ?? 'your organisation'}”`} />
        <Toggle checked={options.logo} onChange={(v) => setOption('logo', v)} label="Logo" hint={org?.logo ? 'Your logo, top right' : 'No logo yet: add one in Preferences'} />
      </Section>
    </>
  );
}

/* ───────── location ───────── */

const ARROWS = { down: 'Shelf below the label', up: 'Shelf above the label', left: 'To the left', right: 'To the right' } as const;

export function LocationEditor({ rec, options, onChange, setOption }: EditorProps<StorageLocation, LocationOptions>) {
  const set = (patch: Partial<StorageLocation>) => onChange({ ...rec, ...patch });
  const setSegment = (i: number, patch: Partial<StorageLocation['segments'][number]>) => set({ segments: rec.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <>
      <Section title="Location" aside={<span className="num">{locationCode(rec) || '—'}</span>}>
        <div className="field">
          <span>Code, from coarse to fine</span>
          <div className="segments">
            {rec.segments.map((seg, i) => (
              <div className="segment" key={i}>
                <input className="input" value={seg.label} aria-label={`Level ${i + 1} name`} onChange={(e) => setSegment(i, { label: e.target.value.toLowerCase() })} />
                <input className="input num" value={seg.value} aria-label={`Level ${i + 1} value`} onChange={(e) => setSegment(i, { value: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
                <button className="btn icon ghost" aria-label={`Remove ${seg.label || 'level'}`} disabled={rec.segments.length < 2} onClick={() => set({ segments: rec.segments.filter((_, j) => j !== i) })}>
                  <Icon.close />
                </button>
              </div>
            ))}
          </div>
          {rec.segments.length < 4 && (
            <button className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => set({ segments: [...rec.segments, { label: ['aisle', 'rack', 'shelf', 'bin'][rec.segments.length], value: '' }] })}>
              <Icon.plus /> Add a level
            </button>
          )}
        </div>
        <GroupField label="Area" value={rec.area} entityKind="location" read={groupOf.location} onChange={(v) => set({ area: v })} />
        <Field label="Contents">
          <TextInput value={rec.contents} onChange={(v) => set({ contents: v })} />
        </Field>
        <div className="row">
          <Field label="Article or standard">
            <TextInput value={rec.sku} onChange={(v) => set({ sku: v || undefined })} placeholder="DIN 7991" />
          </Field>
          <Field label="Direction">
            <select className="select" value={rec.arrow ?? ''} onChange={(e) => set({ arrow: (e.target.value || undefined) as StorageLocation['arrow'] })}>
              <option value="">None</option>
              {Object.entries(ARROWS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
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

/* ───────── food ───────── */

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ShelfLife({ hours, onChange }: { hours: number; onChange(h: number): void }) {
  const [unit, setUnit] = useState<1 | 24>(hours >= 24 && hours % 24 === 0 ? 24 : 1);
  return (
    <Field label="Shelf life">
      <div className="uri">
        <input className="input num" type="number" min={1} value={Math.round((hours / unit) * 10) / 10} onChange={(e) => onChange(Math.max(1, Math.round(Number(e.target.value) * unit)))} />
        <select className="select" style={{ width: 'auto' }} value={unit} aria-label="Unit" onChange={(e) => setUnit(Number(e.target.value) as 1 | 24)}>
          <option value={1}>hours</option>
          <option value={24}>days</option>
        </select>
      </div>
    </Field>
  );
}

export function FoodEditor({ rec, options, onChange, setOption, now }: EditorProps<FoodProduct, FoodOptions>) {
  const locale = useStore((s) => s.locale);
  const set = (patch: Partial<FoodProduct>) => onChange({ ...rec, ...patch });
  const { until } = useBy(rec, options, now);
  const untilText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(until);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffH = (until.getTime() - now.getTime()) / 3600_000;
  const rel = Math.abs(diffH) < 48 ? rtf.format(Math.round(diffH), 'hour') : rtf.format(Math.round(diffH / 24), 'day');
  const toggleAllergen = (a: AllergenCode) => set({ allergens: rec.allergens.includes(a) ? rec.allergens.filter((x) => x !== a) : (Object.keys(ALLERGENS) as AllergenCode[]).filter((x) => x === a || rec.allergens.includes(x)) });
  return (
    <>
      <Section title="Recipe">
        <Field label="Name" hint="As it should appear on the label">
          <TextInput value={rec.name} onChange={(v) => set({ name: v })} />
        </Field>
        <div className="row">
          <GroupField label="Category" value={rec.category} entityKind="food" read={groupOf.food} onChange={(v) => set({ category: v })} />
          <ShelfLife key={rec.id} hours={rec.shelfLifeHours} onChange={(h) => set({ shelfLifeHours: h })} />
        </div>
        <Field label="Storage">
          <Segmented
            block
            label="Storage"
            value={rec.storage}
            onChange={(v) => set({ storage: v })}
            options={[
              { value: 'chilled', label: 'Chilled' },
              { value: 'frozen', label: 'Frozen' },
              { value: 'ambient', label: 'Ambient' },
            ]}
          />
        </Field>
        <div className="field">
          <span>Allergens</span>
          <div className="chips">
            {(Object.keys(ALLERGENS) as AllergenCode[]).map((a) => (
              <button key={a} className="chip" aria-pressed={rec.allergens.includes(a)} onClick={() => toggleAllergen(a)}>
                <span className="num" style={{ opacity: 0.6, marginRight: 4 }}>{a}</span>
                {ALLERGENS[a][locale]}
              </button>
            ))}
          </div>
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

/* ───────── box contents ───────── */

export function ContentsEditor({ rec, options, onChange, setOption }: EditorProps<Box, ContentsOptions>) {
  const org = useStore((s) => s.org);
  const setPrefs = useStore((s) => s.set);
  const set = (patch: Partial<Box>) => onChange({ ...rec, ...patch });
  const count = rec.items.filter((t) => t.trim()).length;
  return (
    <>
      <Section title="Case">
        <Field label="Name">
          <TextInput value={rec.title} onChange={(v) => set({ title: v })} placeholder="FOH rack" />
        </Field>
        <Field label="Contents" hint={count ? `${count === 1 ? '1 item' : `${count} items`}, one per line. The type shrinks and columns are added as the list grows.` : 'One item per line.'}>
          <textarea className="input contents-list" rows={Math.min(14, Math.max(5, rec.items.length + 1))} value={rec.items.join('\n')} onChange={(e) => set({ items: e.target.value.split('\n') })} placeholder={'Stagebox 32/16\nMulticore 50 m\nDI boxes (4)'} />
        </Field>
      </Section>
      <Section title="Layout">
        <Toggle
          checked={options.ownerTag}
          onChange={(v) => setOption('ownerTag', v)}
          label="Owner"
          hint={org?.name ? `${org.name} and your address` : 'Your address, from Preferences'}
        />
        <Toggle checked={options.logo} onChange={(v) => setOption('logo', v)} label="Logo" hint={org?.logo ? 'Your logo, in black' : 'No logo yet: add one in Preferences'} />
        {options.logo && !org?.logo && (
          <button className="btn small" onClick={() => setPrefs('prefsOpen', true)}>
            Upload a logo
          </button>
        )}
        <Toggle checked={options.qr} onChange={(v) => setOption('qr', v)} label="QR code" hint="Opens this case in Labeleur" />
        {options.qr && <div className="hint num">{boxLink(location.origin, rec)}</div>}
      </Section>
    </>
  );
}

/* ───────── text ───────── */

export function TextEditor({ rec, options, onChange, setOption }: EditorProps<Sign, TextOptions>) {
  return (
    <>
      <Section title="Text">
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
  contents: ContentsEditor as never,
};
