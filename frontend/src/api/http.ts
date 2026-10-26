/** The Labeleur server (Quarkus), reached on the same origin under /api. */
import type { DbRecord } from '../db/types';
import type { EntityId, EntityPrefs } from '../db/entities';
import type { LabeleurApi, Organisation, PrintJob } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** The session ended (Quarkus answers 499 to marked requests instead of redirecting): sign in again. */
function sessionEnded(): never {
  window.location.reload();
  throw new ApiError(401, 'Signing in again…');
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'X-Requested-With': 'JavaScript',
        ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': body instanceof Blob ? body.type : 'application/json' }),
      },
      body: body === undefined ? undefined : body instanceof FormData || body instanceof Blob ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'The Labeleur server cannot be reached.');
  }
  if (res.status === 499 || res.status === 401) sessionEnded();
  if (!res.ok) {
    const problem = await res.json().catch(() => null);
    const fields = problem?.fields ?? {};
    const detail = Object.entries(fields).map(([k, v]) => `${k} ${v}`).join(', ');
    throw new ApiError(res.status, detail ? `${problem.message}: ${detail}` : (problem?.message ?? `${res.status} ${res.statusText}`), fields);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** The signed-in user, and where they manage their account and sign out. */
export interface Me {
  id: string;
  name?: string;
  email?: string;
  accountUrl?: string;
  logoutUrl: string;
}

export const accountApi = {
  me: () => call<Me>('GET', '/me'),
  /** Whether this browser has a session; signed out, the landing page shows instead of the app. */
  async signedIn(): Promise<boolean> {
    try {
      const res = await fetch('/api/me', { headers: { 'X-Requested-With': 'JavaScript' } });
      return res.status !== 499 && res.status !== 401;
    } catch {
      // Unreachable server: let the app boot and say so.
      return true;
    }
  },
  setSender: ({ logo: _logo, ...org }: Organisation) => call<Organisation>('PUT', '/organisation', org),
  uploadLogo: (file: Blob) => call<Organisation>('PUT', '/organisation/logo', file),
  removeLogo: () => call<Organisation>('DELETE', '/organisation/logo'),
  /** The logo as uploaded, or null without one. */
  async logo(): Promise<Blob | null> {
    const res = await fetch('/api/organisation/logo', { headers: { 'X-Requested-With': 'JavaScript' } });
    if (res.status === 499 || res.status === 401) sessionEnded();
    return res.ok ? res.blob() : null;
  },
};

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

export const httpApi: LabeleurApi = {
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
