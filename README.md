# Labelcraft

A label designer for Brother QL printers that knows what it is printing. You don't draw text boxes. You choose what the label is (an address, an asset tag, a shelf location, a food date or a sign), point it at a record, and Labelcraft sets it.

```
npm install
npm run dev      # http://localhost:5178
npm test         # engine and address tests
```

## What each label knows

| Label | Data | Semantics |
|---|---|---|
| **Address** | Contacts | Line order, postcode format and casing for 20 countries (DIN 5008, Royal Mail, USPS, La Poste, PostNL, Canada Post …). Adds the destination country line in the sender's language; writes the return-address country in English. Parses pasted address blocks. Splits long company names over two lines when that lets the address be set larger. |
| **Asset tag** | Inventory (read-only, live) | QR code pointing at the inventory record, or a Data Matrix with the tag. Tag prefix set one weight lighter. Text aligned to the code's top and bottom edges. |
| **Storage location** | Warehouse | Aisle, rack and shelf as large figures with captions, a knocked-out direction arrow, and Code 128 only where it will scan. |
| **Food date** | Recipes | Computes use-by from shelf life and preparation time (follows the clock), shows the weekday as the main signal, declares EU allergens, and prints the use-by block in red on DK-22251. |
| **Sign** | Local | Free text with optimal line breaks and hyphenation; suggests a cut length on continuous tape. |

## Typography

The engine in `src/engine` works in printer dots, not CSS pixels.

- **Fitting** (`text.ts`): size is found by binary search in quarter points. Candidates with fewer lines and no hyphens are scored against larger ones, so "Vorsicht, zerbrechlich" goes on two clean lines instead of three with a hyphen.
- **Line breaking**: a compact Knuth–Plass: minimum squared slack, penalties for hyphens, stacked hyphens and stranded last words. Balanced mode for headings. German and English hyphenation patterns, with three letters kept on each side of a break.
- **Ink alignment**: side bearings are removed at the aligned edge, and opening quotes hang into the margin.
- **Optical tracking**: small sizes are opened up and display sizes tightened. All-caps settings get per-system tracking.
- **Vertical metrics**: blocks are measured from cap height to baseline, not from the em box. Baselines snap to the dot grid.
- **Typesetting** (`typeset.ts`): „German“ and “English” quotes, apostrophes, primes for inches (14″), en dashes for ranges (2–7 °C), × for dimensions, and non-breaking spaces between figures and units and inside abbreviations (z. B.). Identifiers are never touched.
- **Type systems** (`fonts.ts`): three curated pairings (Plex, Atkinson Hyperlegible, Source Serif/Sans), each with a tested minimum size for thermal paper.

## Print fidelity

- **Media** (`media.ts`): DK rolls with Brother's printable dot counts. The stage shows the physical label on its liner, with the unprintable margin hatched.
- **Barcodes** (`barcode.ts`): modules are always a whole number of dots. Quiet zones and module size are checked against the symbology.
- **Print dots view and loupe** (`render.ts`, `Stage.tsx`): the 1-bit 300 dpi raster the head will burn, including red on two-colour tape. The loupe shows the dots under the pointer and the font, size, cap height and tracking of the text there.
- **Preflight**: undersized type, cut lines, unreadable codes, the wrong roll in the selected printer, postcode formats, expired dates. Most findings come with a one-click fix.

## Backend

`src/api/types.ts` defines `LabelcraftApi`. `src/api/mock.ts` implements it in memory with realistic latency and a print queue that reports progress per label. It rejects jobs when the printer is offline or has a different roll loaded. To connect real services, implement the same interface over HTTP and assign it in `src/state/store.ts`.

Print jobs carry one 1-bit PNG per label, already rotated into feed orientation (`toFeedOrientation`), ready for a `brother_ql`-style raster backend.

## Licence

MIT, see [LICENSE](LICENSE). Bundled fonts are under the SIL Open Font License via Fontsource.
