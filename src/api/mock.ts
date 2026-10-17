/**
 * In-memory backend with realistic latency. Swap for an HTTP client that
 * implements `LabelcraftApi` when the real services exist.
 */
import type { Contact, FoodProduct, InventoryItem, LabelcraftApi, Organisation, PrintJob, Printer, StorageLocation } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => delay(180 + Math.random() * 260);

const ORG: Organisation = {
  name: 'Nordlicht Manufaktur GmbH',
  address: { company: 'Nordlicht Manufaktur GmbH', street: 'Lindwurmstraße', houseNumber: '88', postalCode: '80337', city: 'München', country: 'DE' },
  inventoryUrl: 'https://inv.nordlicht.de/a/',
};

const PRINTERS: Printer[] = [
  { id: 'p-office', name: 'Office', model: 'QL-820NWB', location: 'Front desk', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-11201', remaining: '312 labels' },
  { id: 'p-ship', name: 'Shipping', model: 'QL-1110NWB', location: 'Dispatch', connection: 'Ethernet', status: 'ready', loadedMedia: 'DK-11202', remaining: '188 labels' },
  { id: 'p-shop', name: 'Workshop', model: 'QL-810W', location: 'Workshop bench', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-22205', remaining: '21.4 m' },
  { id: 'p-kitchen', name: 'Kitchen', model: 'QL-820NWB', location: 'Canteen', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-22251', remaining: '9.8 m' },
  { id: 'p-store', name: 'Stores', model: 'QL-700', location: 'Warehouse', connection: 'USB', status: 'offline', loadedMedia: 'DK-11204' },
];

const CONTACTS: Contact[] = [
  { id: 'c1', group: 'Customers', company: 'Kunstmühle Schwarz GmbH', honorific: 'Frau', title: 'Dr.', givenName: 'Erika', familyName: 'Schwarz', street: 'Am Mühlbach', houseNumber: '3', postalCode: '83022', city: 'Rosenheim', country: 'DE' },
  { id: 'c2', group: 'Customers', honorific: 'Herrn', givenName: 'Johannes', familyName: 'Weißgerber', street: 'Kastanienallee', houseNumber: '17a', extra: 'Hinterhaus, 3. OG', postalCode: '10435', city: 'Berlin', country: 'DE' },
  { id: 'c3', group: 'Suppliers', company: 'Holzwerkstätten Gruber & Söhne KG', department: 'Einkauf', givenName: 'Theresa', familyName: 'Gruber', street: 'Mariahilfer Straße', houseNumber: '120', postalCode: '1070', city: 'Wien', country: 'AT' },
  { id: 'c4', group: 'Customers', honorific: 'Frau', givenName: 'Lea', familyName: 'Graf-Imhof', street: 'Seefeldstrasse', houseNumber: '45', postalCode: '8008', city: 'Zürich', country: 'CH' },
  { id: 'c5', group: 'Customers', honorific: 'Ms', givenName: 'Priya', familyName: 'Natarajan', company: 'Folio & Thread Ltd', street: 'Shoreditch High Street', houseNumber: '135', postalCode: 'E1 6JE', city: 'London', country: 'GB' },
  { id: 'c6', group: 'Customers', givenName: 'Jordan', familyName: 'Ellis-Okafor', company: 'Hollow Pine Studio LLC', street: 'NW Flanders Street', houseNumber: '1120', extra: 'Suite 300', postalCode: '97209', city: 'Portland', region: 'OR', country: 'US' },
  { id: 'c7', group: 'Customers', honorific: 'Madame', givenName: 'Camille', familyName: 'Lefèvre', street: 'rue des Archives', houseNumber: '42', postalCode: '75004', city: 'Paris', country: 'FR' },
  { id: 'c8', group: 'Suppliers', company: 'Van der Berg Papier B.V.', givenName: 'Sanne', familyName: 'van der Berg', street: 'Keizersgracht', houseNumber: '214', postalCode: '1016 DZ', city: 'Amsterdam', country: 'NL' },
  { id: 'c9', group: 'Customers', givenName: 'Marco', familyName: 'Bellandi', company: 'Legatoria Bellandi S.r.l.', street: 'Via dei Servi', houseNumber: '28', postalCode: '50122', city: 'Firenze', region: 'FI', country: 'IT' },
  { id: 'c10', group: 'Customers', givenName: 'Émilie', familyName: 'Tremblay', street: 'Rue Saint-Paul Ouest', houseNumber: '410', postalCode: 'H2Y 2A3', city: 'Montréal', region: 'QC', country: 'CA' },
  { id: 'c11', group: 'Partners', company: 'Bundesanstalt für Materialforschung und -prüfung', department: 'Fachbereich 5.1 Materialographie, Fraktographie und Alterung technischer Werkstoffe', honorific: 'Herrn', title: 'Prof. Dr.-Ing.', givenName: 'Karl-Friedrich', familyName: 'von Hohenstein', street: 'Unter den Eichen', houseNumber: '87', postalCode: '12205', city: 'Berlin', country: 'DE', note: 'Long department name — a good stress test' },
];

const INVENTORY: InventoryItem[] = [
  { id: 'i1', assetTag: 'NL-004219', name: 'MacBook Pro 14″ M3 Pro', category: 'Computers', model: 'Mac15,6', serial: 'C02XK1ZJMD6R', location: 'Studio · Desk 4', owner: 'A. Kovač', purchased: '2024-02-12', updatedAt: '2026-10-15T09:12:00Z' },
  { id: 'i2', assetTag: 'NL-004220', name: 'Eizo ColorEdge CG2700X', category: 'Displays', serial: '27X1048821', location: 'Studio · Desk 4', owner: 'A. Kovač', purchased: '2024-02-12', updatedAt: '2026-09-02T14:40:00Z' },
  { id: 'i3', assetTag: 'NL-003117', name: 'Festool Kapex KS 120 REB Kapp-Zugsäge', category: 'Tools', serial: '10394852', location: 'Workshop · Bay 2', purchased: '2021-06-30', updatedAt: '2026-08-21T07:03:00Z' },
  { id: 'i4', assetTag: 'NL-003118', name: 'Festool Domino DF 500 Q', category: 'Tools', serial: '20581133', location: 'Workshop · Cabinet T3', purchased: '2021-06-30', updatedAt: '2026-10-01T16:22:00Z' },
  { id: 'i5', assetTag: 'NL-005001', name: 'Fujifilm X-T5', category: 'Cameras', serial: '3DA04419', location: 'Photo room · Locker 1', owner: 'J. Brandt', purchased: '2025-03-18', updatedAt: '2026-10-16T11:45:00Z' },
  { id: 'i6', assetTag: 'NL-005002', name: 'Fujinon XF 33 mm F1.4 R LM WR', category: 'Cameras', serial: '4BC11092', location: 'Photo room · Locker 1', purchased: '2025-03-18', updatedAt: '2026-10-16T11:45:00Z' },
  { id: 'i7', assetTag: 'NL-002004', name: 'Epson EB-L630U Projector', category: 'AV', serial: 'X8NF2300114', location: 'Meeting room Isar', purchased: '2020-11-04', updatedAt: '2026-05-11T08:00:00Z' },
  { id: 'i8', assetTag: 'NL-004377', name: 'Dell Latitude 7450', category: 'Computers', serial: '7H2LQX3', location: 'Office · Desk 11', owner: 'M. Steiner', purchased: '2025-08-20', updatedAt: '2026-10-10T13:30:00Z' },
  { id: 'i9', assetTag: 'NL-006012', name: 'Fluke 87V Digital Multimeter', category: 'Test equipment', serial: '45210977', location: 'Electronics lab · Drawer E2', purchased: '2019-01-15', updatedAt: '2026-07-07T10:10:00Z' },
  { id: 'i10', assetTag: 'NL-006013', name: 'Weller WT 1013 Soldering Station', category: 'Test equipment', serial: 'WT13-0098812', location: 'Electronics lab · Bench 1', purchased: '2022-04-02', updatedAt: '2026-07-07T10:10:00Z' },
  { id: 'i11', assetTag: 'NL-001090', name: 'Brother QL-820NWB', category: 'Office', serial: 'U64032H0N123456', location: 'Front desk', purchased: '2023-01-09', updatedAt: '2026-10-17T08:55:00Z' },
  { id: 'i12', assetTag: 'NL-007003', name: 'Bosch GSR 18V-90 C Akku-Bohrschrauber', category: 'Tools', serial: '702004567', location: 'Workshop · Wall rack W1', purchased: '2024-09-01', updatedAt: '2026-09-30T15:20:00Z' },
];

const seg = (a: string, r: string, s: string) => [
  { label: 'aisle', value: a },
  { label: 'rack', value: r },
  { label: 'shelf', value: s },
];

const LOCATIONS: StorageLocation[] = [
  { id: 'l1', segments: seg('A', '03', '2'), area: 'Workshop stores', contents: 'Senkkopfschrauben M3 × 12, Edelstahl A2', sku: 'DIN 7991', arrow: 'down' },
  { id: 'l2', segments: seg('A', '03', '3'), area: 'Workshop stores', contents: 'Senkkopfschrauben M4 × 16, Edelstahl A2', sku: 'DIN 7991', arrow: 'down' },
  { id: 'l3', segments: seg('A', '04', '1'), area: 'Workshop stores', contents: 'Unterlegscheiben M3–M8, sortiert', arrow: 'up' },
  { id: 'l4', segments: seg('B', '01', '1'), area: 'Packaging', contents: 'Versandkartons 300 × 200 × 150 mm', arrow: 'down' },
  { id: 'l5', segments: seg('B', '01', '2'), area: 'Packaging', contents: 'Luftpolsterfolie, Rolle 50 cm', arrow: 'up' },
  { id: 'l6', segments: seg('B', '02', '4'), area: 'Packaging', contents: 'DK-11202 Versandetiketten, Ersatzrollen' },
  { id: 'l7', segments: seg('C', '12', '1'), area: 'Electronics', contents: 'Widerstände E12, 1/4 W, Metallfilm', arrow: 'left' },
  { id: 'l8', segments: seg('C', '12', '2'), area: 'Electronics', contents: 'Kondensatoren, Elko 10–1000 µF', arrow: 'right' },
  { id: 'l9', segments: [{ label: 'zone', value: 'K' }, { label: 'rack', value: '7' }], area: 'Cold room', contents: 'Molkereiprodukte, ungeöffnet', arrow: 'down' },
];

const FOOD: FoodProduct[] = [
  { id: 'f1', name: 'Rinderbrühe, hausgemacht', category: 'Fonds & Suppen', shelfLifeHours: 72, storage: 'chilled', allergens: ['L'] },
  { id: 'f2', name: 'Sauce hollandaise', category: 'Saucen', shelfLifeHours: 4, storage: 'ambient', allergens: ['C', 'G'] },
  { id: 'f3', name: 'Basilikumpesto', category: 'Saucen', shelfLifeHours: 120, storage: 'chilled', allergens: ['G', 'H'] },
  { id: 'f4', name: 'Pizzateig, 24 h geführt', category: 'Teige', shelfLifeHours: 48, storage: 'chilled', allergens: ['A'] },
  { id: 'f5', name: 'Gravlax vom Lachs', category: 'Fisch', shelfLifeHours: 96, storage: 'chilled', allergens: ['D', 'M'] },
  { id: 'f6', name: 'Rotkohl, geschmort', category: 'Beilagen', shelfLifeHours: 24 * 90, storage: 'frozen', allergens: ['O'] },
  { id: 'f7', name: 'Sesam-Erdnuss-Dressing', category: 'Saucen', shelfLifeHours: 168, storage: 'chilled', allergens: ['E', 'F', 'N'] },
  { id: 'f8', name: 'Vanillepudding', category: 'Desserts', shelfLifeHours: 48, storage: 'chilled', allergens: ['C', 'G'] },
  { id: 'f9', name: 'Granola mit Haselnüssen', category: 'Frühstück', shelfLifeHours: 24 * 21, storage: 'ambient', allergens: ['A', 'H'] },
];

let jobSeq = 1;
const printers = PRINTERS.map((p) => ({ ...p }));

export const mockApi: LabelcraftApi = {
  async organisation() {
    await latency();
    return ORG;
  },
  async printers() {
    await latency();
    return printers.map((p) => ({ ...p }));
  },
  async contacts() {
    await latency();
    return CONTACTS;
  },
  async inventory() {
    await latency();
    return INVENTORY;
  },
  async locations() {
    await latency();
    return LOCATIONS;
  },
  async foodProducts() {
    await latency();
    return FOOD;
  },
  async print(req, onUpdate) {
    const printer = printers.find((p) => p.id === req.printerId);
    const total = req.pages.length * req.copies;
    const job: PrintJob = {
      id: `job-${jobSeq++}`,
      printerId: req.printerId,
      printerName: printer?.name ?? req.printerId,
      kind: req.kind,
      title: req.pages.length === 1 ? req.pages[0].title : `${req.pages[0]?.title ?? 'Labels'} + ${req.pages.length - 1} more`,
      total,
      printed: 0,
      state: 'queued',
      createdAt: Date.now(),
    };
    onUpdate({ ...job });
    await delay(450);
    if (!printer || printer.status === 'offline') {
      job.state = 'failed';
      job.error = `${printer?.name ?? 'Printer'} is offline. Check that it is switched on and connected.`;
      onUpdate({ ...job });
      return job;
    }
    if (printer.loadedMedia !== req.mediaId) {
      job.state = 'failed';
      job.error = `${printer.name} has ${printer.loadedMedia} loaded, the job needs ${req.mediaId}.`;
      onUpdate({ ...job });
      return job;
    }
    job.state = 'printing';
    printer.status = 'printing';
    onUpdate({ ...job });
    for (let i = 0; i < total; i++) {
      // A QL-820NWB prints a 62 × 100 mm label in well under a second.
      await delay(380 + req.pages[i % req.pages.length].lengthDots * 0.25);
      job.printed = i + 1;
      onUpdate({ ...job });
    }
    printer.status = 'ready';
    job.state = 'done';
    onUpdate({ ...job });
    return job;
  },
};
