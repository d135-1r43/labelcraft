# Labelcraft

A label designer for Brother QL printers that knows what it is printing. You don't draw text boxes. You choose what the label is (an address, an asset tag, a shelf location, a food date or a sign), point it at a record, and Labelcraft sets it.

```
./mvnw quarkus:dev    # http://localhost:8080 — app, API, database, Keycloak and mail
./mvnw test           # backend tests (PostgreSQL via Dev Services)
cd frontend && npm test   # engine and address tests
```

Dev mode needs Docker running. Quarkus starts PostgreSQL itself, and `compose-devservices.yml` adds Keycloak and Mailpit:

| | |
|---|---|
| App | http://localhost:8080. Register an account on the sign-in page |
| Mail (verification, password reset) | http://localhost:8025 |
| Keycloak admin | http://localhost:8180, `admin` / `admin` |

To try the registration allowlist in dev, start with `LABELCRAFT_REGISTRATION_ALLOWLIST=@example.com ./mvnw quarkus:dev`.

## Layout

```
pom.xml                    Quarkus (REST, Hibernate ORM with Panache, Flyway, Quinoa)
src/main/java/…            backend: account, records, settings, printing, seed
src/main/resources/
  application.properties
  db/migration/            Flyway schema
  seed/                    sample organisation: contacts, inventory, printers …
keycloak/                  Keycloak image: realm, login theme, email allowlist provider
deploy/                    production compose file and .env.example
frontend/                  React app (Vite, TypeScript)
  src/engine/              typography, barcodes, rendering
  src/kinds/               the label types
```

## What each label knows

| Label | Records | Semantics |
|---|---|---|
| **Address** | Contacts | Line order, postcode format and casing for 20 countries (DIN 5008, Royal Mail, USPS, La Poste, PostNL, Canada Post …). Adds the destination country line in the sender's language; writes the return-address country in English. Parses pasted address blocks. Splits long company names over two lines when that lets the address be set larger. |
| **Asset tag** | Inventory | QR code that opens the record in the inventory system (its link), or a Data Matrix with the tag. Tag prefix set one weight lighter. Text aligned to the code's top and bottom edges. |
| **Storage location** | Locations | Aisle, rack and shelf as large figures with captions, a knocked-out direction arrow, and Code 128 only where it will scan. |
| **Food date** | Recipes | Computes use-by from shelf life and preparation time (follows the clock), shows the weekday as the main signal, declares EU allergens, and prints the use-by block in red on DK-22251. |
| **Sign** | Signs | Free text with optimal line breaks and hyphenation; suggests a cut length on continuous tape. |

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

## Accounts

Keycloak signs people in (OIDC code flow with PKCE; the app holds the session). Every user has their own records, settings, sender address and print jobs, keyed by their OIDC subject. A new user starts with the sample organisation's data and can restore it per entity later.

- **Self-registration** asks for email and name. Keycloak sends a verification link, and the password is chosen after the address is confirmed.
- **Forgotten passwords** are reset by email.
- **Allowlist**: `LABELCRAFT_REGISTRATION_ALLOWLIST` on Keycloak limits who may register, as full addresses or whole domains (`anna@example.com, @example.org`). Empty or unset lets everyone with a verified email register. A small Keycloak provider (`keycloak/extension`) checks it in the registration form, so changing it needs only a Keycloak restart.
- **Theme**: `keycloak/themes/labelcraft` restyles Keycloak's base templates with the app's type and colours, in English and German.

## Records and leading systems

Labelcraft keeps its own database of the records it prints: contacts, inventory, locations, recipes and signs, one PostgreSQL table each. Everything is edited in Labelcraft, but the organisation's CRM, inventory or ERP stays the source of truth: every record carries a `uri` to its original there. The record panel shows the link, opens it, and offers to link by asset tag or bin code when the leading system addresses records that way. Asset QR codes encode that link.

In **Preferences** (cog, top right) each label type is a card with a live preview. It can be switched off, which removes it from the sidebar, and given a leading system: a name and the base URL its records live under.

On a fresh database the sample organisation is seeded from `src/main/resources/seed` (`labelcraft.seed-on-start`).

## Backend

Quarkus with Hibernate ORM and Panache in the repository pattern: one `PanacheRepositoryBase` per entity, services own the transactions, resources stay thin. The schema is managed by Flyway.

| Endpoint | |
|---|---|
| `GET /api/records/{collection}` | `contacts`, `inventory`, `locations`, `recipes`, `signs` |
| `PUT /api/records/{collection}/{id}` | create or replace; ids are chosen by the client |
| `DELETE /api/records/{collection}/{id}` | removes Labelcraft's copy only |
| `POST /api/records/{collection}/reset` | restore the samples |
| `GET`, `PUT /api/settings/entities[/{id}]` | on/off and leading system per entity |
| `GET /api/me` | the signed-in user; sets up their sample data on first call |
| `GET`, `PUT /api/organisation` | the user's sender: return address and owner line |
| `GET /api/printers` | printers and their loaded roll (simulated) |
| `POST /api/print-jobs` | multipart: `job` (JSON) and one `page` PNG per label |
| `GET /api/print-jobs`, `GET /api/print-jobs/{id}/pdf` | recent jobs and their PDFs |

OpenAPI at `/q/openapi`, Swagger UI at `/q/swagger-ui` in dev mode.

## Printing

Until printers are driven directly, a print job becomes a PDF with one page per label at the label's physical size. Print it through the Brother driver at 100 %; the PDF switches print scaling off. The print bar offers two ways to make it, so the two can be compared on a real printer:

- **Exact dots** (default): the server places the 1-bit 300 dpi raster over the printable area, the dots exactly as the preview shows them. Two-colour labels keep their red.
- **Vector**: the browser writes the PDF (`frontend/src/engine/pdf.ts`, pdf-lib). Text becomes glyph outlines from the bundled fonts, with kerning and tracking as on screen; rules and boxes keep their dot-grid positions. Barcodes stay images with one pixel per printer dot, because a module that lands between dots prints at the wrong width. The driver rasterizes, which on QL-8xx models can mean 300 × 600 dpi. Set the driver's halftone to binary, not dither.

Java formatting follows [pruefstein](https://github.com/explore-de/pruefstein): the Eclipse profile in `formatter/java.xml` and import order are checked at `validate`; `./mvnw formatter:format impsort:sort` fixes them.

Guides: [Quinoa](https://docs.quarkiverse.io/quarkus-quinoa/dev/), [Hibernate ORM with Panache](https://quarkus.io/guides/hibernate-orm-panache), [Flyway](https://quarkus.io/guides/flyway), [Dev Services for databases](https://quarkus.io/guides/databases-dev-services), [REST](https://quarkus.io/guides/rest).

## Build and release

GitHub Actions (`.github/workflows/ci.yml`) tests the frontend and the backend, builds the JVM image, and starts it against PostgreSQL to check that it serves records, the UI and a print job's PDF.

- A push to `main` publishes `ghcr.io/<owner>/labelcraft:latest`.
- `./mvnw release:prepare` sets the version, tags `vX.Y.Z` and pushes; the tag publishes `X.Y.Z`, `X.Y` and `X`. `release:perform` only verifies the tag; nothing goes to a Maven repository.

Each build publishes two images, `labelcraft` and `labelcraft-keycloak`, and the smoke test starts both with `deploy/docker-compose.yml` and signs in. To run Labelcraft yourself, copy `deploy/.env.example` to `deploy/.env`, set the public URLs, secrets and SMTP server, and run `docker compose up -d` in `deploy/`.

Dependabot opens one pull request per ecosystem and week (Maven, npm, GitHub Actions, Docker, Compose), with every update in it.

## Licence

MIT, see [LICENSE](LICENSE). Bundled fonts are under the SIL Open Font License via Fontsource.
