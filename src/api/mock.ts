/**
 * In-memory backend with realistic latency: organisation, printers and the
 * print queue. Swap for an HTTP client that implements `LabelcraftApi` when
 * the print service exists. Records are not here; they live in `src/db`.
 */
import type { LabelcraftApi, Organisation, PrintJob, Printer } from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => delay(180 + Math.random() * 260);

const ORG: Organisation = {
  name: 'Nordlicht Manufaktur GmbH',
  address: { company: 'Nordlicht Manufaktur GmbH', street: 'Lindwurmstraße', houseNumber: '88', postalCode: '80337', city: 'München', country: 'DE' },
};

const PRINTERS: Printer[] = [
  { id: 'p-office', name: 'Office', model: 'QL-820NWB', location: 'Front desk', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-11201', remaining: '312 labels' },
  { id: 'p-ship', name: 'Shipping', model: 'QL-1110NWB', location: 'Dispatch', connection: 'Ethernet', status: 'ready', loadedMedia: 'DK-11202', remaining: '188 labels' },
  { id: 'p-shop', name: 'Workshop', model: 'QL-810W', location: 'Workshop bench', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-22205', remaining: '21.4 m' },
  { id: 'p-kitchen', name: 'Kitchen', model: 'QL-820NWB', location: 'Canteen', connection: 'Wi-Fi', status: 'ready', loadedMedia: 'DK-22251', remaining: '9.8 m' },
  { id: 'p-store', name: 'Stores', model: 'QL-700', location: 'Warehouse', connection: 'USB', status: 'offline', loadedMedia: 'DK-11204' },
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
