import { useEffect, useRef, type ReactNode } from 'react';

export function Section({ title, aside, children }: { title: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <h3>
        {title}
        {aside && <small>{aside}</small>}
      </h3>
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  invalid,
  ...rest
}: { value: string | undefined; onChange: (v: string) => void; invalid?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input className="input" value={value ?? ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function Segmented<T extends string>({ value, options, onChange, block, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; block?: boolean; label: string }) {
  return (
    <div className={`seg${block ? ' block' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <span className="label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

/** Close a popover on outside click or Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function relativeTime(ts: number | string, now = Date.now()) {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 45) return rtf.format(-Math.round(s / 86400), 'day');
  return rtf.format(-Math.round(s / (86400 * 30)), 'month');
}
