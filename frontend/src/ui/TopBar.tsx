import { useCallback, useState } from 'react';
import type { Printer } from '../api/types';
import { mediaById } from '../engine/media';
import { useKindState, useStore } from '../state/store';
import { Segmented, relativeTime, useDismiss } from './controls';
import { Icon, Mark } from './icons';

const STATUS_TEXT: Record<Printer['status'], string> = {
  ready: 'Ready',
  printing: 'Printing',
  offline: 'Offline',
  'cover-open': 'Cover open',
  'no-media': 'No labels loaded',
};

function PrinterMenu() {
  const printers = useStore((s) => s.printers);
  const printerId = useStore((s) => s.printerId);
  const set = useStore((s) => s.set);
  const ks = useKindState();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const printer = printers.find((p) => p.id === printerId);
  if (!printer) return null;
  const mismatch = printer.loadedMedia !== ks.mediaId;
  return (
    <div className="pop-anchor" ref={ref}>
      <button className="printer-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={`status ${printer.status}`} aria-hidden />
        <span>
          <b style={{ fontWeight: 600 }}>{printer.name}</b> <span className="meta">{printer.model}</span>
        </span>
        <span className={`roll-chip${mismatch ? ' mismatch' : ''}`} title={mismatch ? 'Loaded roll differs from this label' : 'Loaded roll'}>
          {printer.loadedMedia}
        </span>
      </button>
      {open && (
        <div className="popover" role="listbox" aria-label="Printers">
          {printers.map((p) => {
            const media = mediaById(p.loadedMedia);
            return (
              <button
                key={p.id}
                className="opt"
                role="option"
                aria-selected={p.id === printerId}
                onClick={() => {
                  set('printerId', p.id);
                  setOpen(false);
                }}
              >
                <span className={`status ${p.status}`} aria-hidden />
                <span>
                  <b style={{ fontWeight: 600 }}>{p.name}</b> · {p.model}
                  <small>
                    {STATUS_TEXT[p.status]} · {p.location} · {p.connection}
                  </small>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span className="roll-chip">{media.id}</span>
                  <small>{p.remaining ?? '—'}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JobsMenu() {
  const jobs = useStore((s) => s.jobs);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  const running = jobs.filter((j) => j.state === 'queued' || j.state === 'printing').length;
  return (
    <div className="pop-anchor" ref={ref}>
      <button className="btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon.queue />
        Queue
        {running > 0 && <span className="roll-chip num">{running}</span>}
      </button>
      {open && (
        <div className="popover jobs" style={{ minWidth: 340 }}>
          {jobs.length === 0 && <div className="empty">Nothing printed yet.</div>}
          {jobs.map((j) => (
            <div className="job" key={j.id}>
              <div className="top">
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.title}</span>
                <small className="num">
                  {j.printed}/{j.total}
                </small>
              </div>
              <small>
                {j.state === 'done' ? (j.mode === 'vector' ? 'Vector PDF ready' : 'PDF ready') : j.state === 'failed' ? 'Failed' : j.state === 'queued' ? 'Preparing' : 'Printing'} for {j.printerName} · {relativeTime(j.createdAt)}
              </small>
              {j.state === 'printing' && (
                <div className="progress">
                  <i style={{ width: `${(j.printed / j.total) * 100}%` }} />
                </div>
              )}
              {j.error && <div className="err">{j.error}</div>}
              {j.pdfUrl && (
                <a className="pdf-link" href={j.pdfUrl} target="_blank" rel="noopener noreferrer">
                  Open PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function UserMenu() {
  const me = useStore((s) => s.me);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);
  if (!me) return null;
  const name = me.name || me.email || 'Signed in';
  return (
    <div className="pop-anchor" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label={`Account: ${name}`} title={name}>
        {initials(name)}
      </button>
      {open && (
        <div className="popover user-menu" role="menu">
          <div className="who">
            <b>{name}</b>
            {me.email && me.email !== name && <small>{me.email}</small>}
          </div>
          {me.accountUrl && (
            <a className="opt" role="menuitem" href={me.accountUrl} target="_blank" rel="noopener noreferrer">
              Account and password
              <Icon.external />
            </a>
          )}
          <a className="opt" role="menuitem" href={me.logoutUrl}>
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const locale = useStore((s) => s.locale);
  const set = useStore((s) => s.set);
  const org = useStore((s) => s.org);
  return (
    <header className="topbar">
      <div className="brand">
        <Mark />
        Labeleur
      </div>
      {org && <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.name}</span>}
      <div className="spacer" />
      <span className="locale-label" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
        Label language
      </span>
      <Segmented
        label="Label language"
        value={locale}
        onChange={(v) => set('locale', v)}
        options={[
          { value: 'de', label: 'Deutsch' },
          { value: 'en', label: 'English' },
        ]}
      />
      <JobsMenu />
      <PrinterMenu />
      <button className="btn icon ghost" aria-label="Preferences" title="Preferences" onClick={() => set('prefsOpen', true)}>
        <Icon.gear />
      </button>
      <UserMenu />
    </header>
  );
}
