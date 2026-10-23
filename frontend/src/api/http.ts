/** The Labelcraft server (Quarkus), reached on the same origin under /api. */
import type { DbRecord } from '../db/types';
import type { EntityId, EntityPrefs } from '../db/entities';
import type { LabelcraftApi, PrintJob } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined || body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'The Labelcraft server cannot be reached.');
  }
  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    const fields = problem?.fields ?? {};
    const detail = Object.entries(fields).map(([k, v]) => `${k} ${v}`).join(', ');
    throw new ApiError(res.status, detail ? `${problem.message}: ${detail}` : (problem?.message ?? `${res.status} ${res.statusText}`), fields);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const recordsApi = {
  list: (entity: EntityId) => call<DbRecord[]>('GET', `/records/${entity}`),
  put: (entity: EntityId, rec: DbRecord) => call<DbRecord>('PUT', `/records/${entity}/${encodeURIComponent(rec.id)}`, rec),
  remove: (entity: EntityId, id: string) => call<void>('DELETE', `/records/${entity}/${encodeURIComponent(id)}`),
  reset: (entity: EntityId) => call<DbRecord[]>('POST', `/records/${entity}/reset`),
};

export const settingsApi = {
  all: () => call<Partial<Record<EntityId, EntityPrefs>>>('GET', '/settings/entities'),
  put: (entity: EntityId, prefs: EntityPrefs) => call<EntityPrefs>('PUT', `/settings/entities/${entity}`, prefs),
};

export const httpApi: LabelcraftApi = {
  organisation: () => call('GET', '/organisation'),
  printers: () => call('GET', '/printers'),
  jobs: () => call('GET', '/print-jobs'),
  async print(req, onUpdate) {
    const printerName = req.printerId;
    const title = req.pages.length === 1 ? req.pages[0].title : `${req.pages[0]?.title ?? 'Labels'} + ${req.pages.length - 1} more`;
    const pending: PrintJob = { id: `pending-${Date.now()}`, printerId: req.printerId, printerName, kind: req.kind, title, total: req.pages.length * req.copies, printed: 0, state: 'queued', createdAt: Date.now() };
    onUpdate(pending);
    const form = new FormData();
    const { pages, document, ...meta } = req;
    form.append('job', new Blob([JSON.stringify({ ...meta, titles: pages.map((p) => p.title) })], { type: 'application/json' }));
    if (document) form.append('document', document, 'labels.pdf');
    else pages.forEach((p, i) => p.png && form.append('page', p.png, `label-${i + 1}.png`));
    try {
      const job = await call<PrintJob>('POST', '/print-jobs', form);
      onUpdate({ ...job, id: pending.id });
      return job;
    } catch (e) {
      const failed: PrintJob = { ...pending, state: 'failed', error: (e as Error).message };
      onUpdate(failed);
      return failed;
    }
  },
};
