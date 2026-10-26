import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Organisation } from '../api/types';
import type { Box, Contact, FoodProduct, InventoryItem, Sign, StorageLocation } from '../db/types';
import { loadFonts } from '../engine/fonts';
import { landscapeReadAlong } from '../engine/frame';
import { mediaById } from '../engine/media';
import { renderVector } from '../engine/render';
import { KINDS } from '../kinds';
import type { KindId, Rec } from '../kinds/types';
import { compose } from '../state/compose';
import { initialKinds, type KindState } from '../state/store';
import { Icon, Mark } from './icons';

/** Records from the sample organisation that every new account starts with. */
const SENDER: Organisation = {
  name: 'Nordlicht Manufaktur GmbH',
  address: { company: 'Nordlicht Manufaktur GmbH', street: 'Lindwurmstraße', houseNumber: '88', postalCode: '80337', city: 'München', country: 'DE' },
};

const SAMPLES = {
  address: { id: 'c5', group: 'Customers', honorific: 'Ms', givenName: 'Priya', familyName: 'Natarajan', company: 'Folio & Thread Ltd', street: 'Shoreditch High Street', houseNumber: '135', postalCode: 'E1 6JE', city: 'London', country: 'GB' },
  asset: { id: 'i1', assetTag: 'NL-004219', name: 'MacBook Pro 14″ M3 Pro', category: 'Computers', model: 'Mac15,6', serial: 'C02XK1ZJMD6R', location: 'Studio · Desk 4', owner: 'A. Kovač', uri: 'https://inv.nordlicht.de/a/NL-004219' },
  location: { id: 'l1', segments: [{ label: 'aisle', value: 'A' }, { label: 'rack', value: '03' }, { label: 'shelf', value: '2' }], area: 'Workshop stores', contents: 'Senkkopfschrauben M3 × 12, Edelstahl A2', sku: 'DIN 7991', arrow: 'down' },
  contents: { id: 'b2', title: 'Mikrofone', items: ['Shure SM58 (6)', 'Shure SM57 (4)', 'Shure Beta 52A', 'Shure Beta 91A', 'Sennheiser e904 (4)', 'Neumann KM 184 (2)', 'Sennheiser MD 421 (3)', 'Klemmen und Clips'] },
  food: { id: 'f1', name: 'Rinderbrühe, hausgemacht', category: 'Fonds & Suppen', shelfLifeHours: 72, storage: 'chilled', allergens: ['L'] },
  text: { id: 't1', title: 'Vorsicht, zerbrechlich', subtitle: 'Bitte nicht werfen – Inhalt: Glas' },
} satisfies Record<KindId, Contact | InventoryItem | StorageLocation | Box | FoodProduct | Sign> as Record<KindId, Rec>;

/** The food label on two-colour tape, so its use-by block prints red. */
function sampleKind(kindId: KindId): KindState {
  const ks = initialKinds[kindId];
  if (kindId !== 'food') return ks;
  return { ...ks, mediaId: 'DK-22251', readAlong: landscapeReadAlong(mediaById('DK-22251')) };
}

const DETAILS: Record<KindId, string> = {
  address: 'Line order, postcode format and casing for 20 countries, from DIN 5008 to USPS. Adds the destination country in the sender’s language and parses pasted address blocks.',
  asset: 'Your logo and ownership line, and a QR code that opens the record in your inventory system or in Labeleur. Or a Data Matrix with the tag.',
  location: 'Aisle, rack and shelf as large figures with captions, a knocked-out direction arrow, and a Code 128 only where it will scan.',
  contents: 'The case’s name in condensed capitals, then what is in it, set in as many columns as gives the largest type. A QR code opens the case here.',
  food: 'Computes use-by from shelf life and preparation time, shows the weekday as the main signal, declares EU allergens and prints the block in red.',
  text: 'Free text with optimal line breaks and German and English hyphenation. Suggests a cut length on continuous tape.',
};

/** A sample record set by the real engine, drawn on its label. */
function SampleLabel({ kindId, box }: { kindId: KindId; box: { w: number; h: number } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const composed = useMemo(() => compose({ kindId, rec: SAMPLES[kindId], ks: sampleKind(kindId), locale: 'de', org: SENDER, now: new Date() }), [kindId]);
  const { frame } = composed;
  const scale = Math.min(box.w / frame.wMm, box.h / frame.hMm);
  const w = frame.wMm * scale;
  const h = frame.hMm * scale;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    renderVector(ctx, composed.layout.ops, frame, scale);
  }, [composed, frame, w, h, scale]);

  const radius = frame.shape === 'round' ? '50%' : frame.shape === 'continuous' ? '1px' : `${Math.min(8, 1.5 * scale)}px`;
  return <canvas ref={ref} className="lp-label" style={{ width: w, height: h, borderRadius: radius }} role="img" aria-label={`${kindId} label: ${frame.media.id}`} />;
}

const FEATURES = [
  {
    title: 'Typography for 300 dpi',
    text: 'Type is fitted by binary search in quarter points, broken into lines with a compact Knuth–Plass, aligned to the ink rather than the em box, and snapped to the printer’s dot grid. Quotes, dashes, primes and non-breaking spaces are set for you.',
  },
  {
    title: 'What you see is what prints',
    text: 'The stage shows the label on its liner with the unprintable margin hatched. Switch to print dots to see the 1-bit raster the head will burn, and use the loupe to inspect font, size and tracking under the pointer.',
  },
  {
    title: 'Preflight before paper',
    text: 'Undersized type, unreadable barcodes, the wrong roll in the printer, malformed postcodes and expired dates are flagged before you print. Most findings come with a one-click fix.',
  },
  {
    title: 'Linked to your systems',
    text: 'Every record keeps a link to its original in your CRM, inventory or ERP. Labeleur prints; your leading system stays the source of truth.',
  },
];

function SignInLinks({ large }: { large?: boolean }) {
  return (
    <div className={`lp-actions${large ? ' large' : ''}`}>
      <a className="btn primary" href="/register">
        Create an account
      </a>
      <a className="btn" href="/login">
        Sign in
      </a>
    </div>
  );
}

/** What signed-out visitors see at /: what Labeleur is, and the way in. */
export function Landing() {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    void loadFonts().then(() => setFontsReady(true));
  }, []);

  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="brand" href="/" aria-label="Labeleur">
          <Mark />
          Labeleur
        </a>
        <nav>
          <a className="btn ghost" href="/login">
            Sign in
          </a>
          <a className="btn primary" href="/register">
            Create an account
          </a>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-eyebrow">Label designer for Brother QL printers</p>
            <h1>Labels that know what they are printing.</h1>
            <p className="lp-lead">
              You don’t draw text boxes. Choose what the label is (an address, an asset tag, a shelf, a road case, a food date or a sign), point it at a record, and Labeleur sets it.
            </p>
            <SignInLinks large />
            <p className="lp-note">New accounts start with a sample organisation’s records, so there is something to print straight away.</p>
          </div>
          <div className="lp-desk" aria-label="Labels set by Labeleur">
            {fontsReady && (
              <>
                <div className="lp-desk-item a">
                  <SampleLabel kindId="address" box={{ w: 360, h: 140 }} />
                </div>
                <div className="lp-desk-item b">
                  <SampleLabel kindId="food" box={{ w: 230, h: 120 }} />
                </div>
                <div className="lp-desk-item c">
                  <SampleLabel kindId="asset" box={{ w: 250, h: 100 }} />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="lp-section">
          <h2>Six labels, each with its own rules</h2>
          <p className="lp-section-lead">Every label type knows the conventions of what it prints, and reads from its own kind of record.</p>
          <div className="lp-kinds">
            {KINDS.map((k) => {
              const KindIcon = Icon[k.id];
              return (
                <article key={k.id} className="lp-kind">
                  <div className="lp-kind-preview">{fontsReady && <SampleLabel kindId={k.id} box={{ w: 260, h: 120 }} />}</div>
                  <h3>
                    <KindIcon />
                    {k.name}
                  </h3>
                  <p className="lp-tagline">{k.tagline}</p>
                  <p>{DETAILS[k.id]}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="lp-section">
          <h2>Set like print, not like a form</h2>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature">
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-cta">
          <h2>Print your first label in a minute.</h2>
          <p>Register with your email address, confirm it, choose a password, and the sample records are waiting.</p>
          <SignInLinks large />
        </section>
      </main>

      <footer className="lp-footer">
        <span>Labeleur · MIT licence</span>
        <a href="https://github.com/d135-1r43/labeleur">Source on GitHub</a>
      </footer>
    </div>
  );
}
