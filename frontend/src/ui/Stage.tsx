import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DrawOp } from '../engine/display';
import { typeSystemById } from '../engine/fonts';
import type { Frame } from '../engine/frame';
import { rasterize, renderVector } from '../engine/render';
import { measure } from '../engine/text';
import { DOTS_PER_MM, dotsToMm, fmtMm, mmToPt } from '../engine/units';
import { getMeasurer, type Composed } from '../state/compose';
import { useKindState, useStore, type ViewMode } from '../state/store';
import { Icon } from './icons';

export interface BatchItem {
  id: string;
  title: string;
  composed: Composed;
}

const WEIGHTS: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
const ACTUAL_SIZE = 96 / 25.4;

interface Hover {
  clientX: number;
  clientY: number;
  /** Position in printable-area mm. */
  x: number;
  y: number;
}

/* ───────── one label ───────── */

const LabelView = memo(function LabelView({
  item,
  scale,
  view,
  guides,
  active,
  index,
  count,
  onSelect,
  onHover,
}: {
  item: BatchItem;
  scale: number;
  view: ViewMode;
  guides: boolean;
  active: boolean;
  index: number;
  count: number;
  onSelect: () => void;
  onHover?: (h: Hover | null, raster: HTMLCanvasElement | null) => void;
}) {
  const { frame, layout, issues } = item.composed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raster = useMemo(() => (view === 'dots' || active ? rasterize(layout.ops, frame) : null), [layout, frame, view, active]);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const w = frame.wMm * scale;
  const h = frame.hMm * scale;

  useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (view === 'dots' && raster) {
      // Below one device pixel per dot, nearest-neighbour would drop dots; smooth instead.
      ctx.imageSmoothingEnabled = (scale * dpr) / DOTS_PER_MM < 1;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(raster, 0, 0, c.width, c.height);
    } else {
      ctx.scale(dpr, dpr);
      renderVector(ctx, layout.ops, frame, scale);
    }
  }, [layout, frame, scale, view, raster, w, h, dpr]);

  const radius = frame.shape === 'round' ? '50%' : frame.shape === 'diecut' ? `${1.6 * scale}px` : '0';
  const worst = issues.find((i) => i.severity === 'error') ? 'error' : issues.find((i) => i.severity === 'warn') ? 'warn' : null;

  return (
    <div
      className={`label ${active ? 'active' : 'inactive'}`}
      style={{ width: frame.physW * scale, height: frame.physH * scale, borderRadius: radius }}
      onClick={onSelect}
      onMouseMove={
        active && onHover
          ? (e) => {
              const r = canvasRef.current!.getBoundingClientRect();
              onHover({ clientX: e.clientX, clientY: e.clientY, x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }, raster);
            }
          : undefined
      }
      onMouseLeave={active && onHover ? () => onHover(null, null) : undefined}
      role="img"
      aria-label={`${item.title} label${active ? ', selected' : ''}`}
    >
      <canvas ref={canvasRef} style={{ left: frame.offX * scale, top: frame.offY * scale, width: w, height: h, borderRadius: frame.shape === 'round' ? '50%' : undefined }} />
      {guides && <Guides frame={frame} scale={scale} />}
      {count > 1 && (
        <div className="badge">
          <span className="num">
            {index + 1}/{count}
          </span>
          {worst && <span className={`sev-dot ${worst}`} />}
        </div>
      )}
    </div>
  );
});

/** Printable area and the margin the head cannot reach, hatched. */
function Guides({ frame, scale }: { frame: Frame; scale: number }) {
  const W = frame.physW * scale;
  const H = frame.physH * scale;
  const x = frame.offX * scale;
  const y = frame.offY * scale;
  const w = frame.wMm * scale;
  const h = frame.hMm * scale;
  const id = `hatch-${frame.media.id}-${Math.round(scale * 10)}`;
  const outer = frame.shape === 'round' ? `M ${W / 2} 0 a ${W / 2} ${H / 2} 0 1 0 0.01 0 Z` : `M0 0H${W}V${H}H0Z`;
  return (
    <svg className="guides" width={W} height={H}>
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#1f47d6" strokeOpacity="0.16" strokeWidth="1.4" />
        </pattern>
      </defs>
      {frame.shape !== 'round' && <path d={`${outer} M${x} ${y}V${y + h}H${x + w}V${y}Z`} fill={`url(#${id})`} fillRule="evenodd" />}
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="none" stroke="#1f47d6" strokeOpacity="0.45" strokeDasharray="3 3" />
    </svg>
  );
}

/* ───────── loupe ───────── */

const LOUPE = 196;
const DOT_PX = 6;

function describe(ops: DrawOp[], x: number, y: number, frame: Frame): { title: string; detail: string } {
  const m = getMeasurer();
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.t === 'text') {
      const met = m.metrics(op.font);
      const width = measure(m, op.text, { font: op.font, tracking: op.tracking }, op.sizeMm);
      if (x >= op.x && x <= op.x + width && y >= op.y - met.ascent * op.sizeMm && y <= op.y + met.descent * op.sizeMm) {
        const pt = mmToPt(op.sizeMm);
        const track = op.tracking ? ` · tracking ${op.tracking > 0 ? '+' : ''}${(op.tracking * 1000).toFixed(0)}/1000 em` : '';
        return {
          title: `${op.font.family} ${WEIGHTS[op.font.weight] ?? op.font.weight}`,
          detail: `${pt.toFixed(2).replace(/\.?0+$/, '')} pt · cap height ${(met.cap * op.sizeMm).toFixed(2)} mm${track}`,
        };
      }
    } else if (op.t === 'matrix') {
      const x0 = dotsToMm(op.xDots);
      const y0 = dotsToMm(op.yDots);
      if (x >= x0 && x <= x0 + dotsToMm(op.cols * op.moduleDots) && y >= y0 && y <= y0 + dotsToMm(op.rows * op.rowDots)) {
        return {
          title: `${op.name ?? 'Barcode'} · ${op.rows > 1 ? `${op.cols} × ${op.rows} modules` : `${op.cols} modules`}`,
          detail: `${op.moduleDots} dots per module (${dotsToMm(op.moduleDots).toFixed(3)} mm), on the dot grid`,
        };
      }
    }
  }
  const inside = x >= 0 && y >= 0 && x <= frame.wMm && y <= frame.hMm;
  return inside ? { title: 'Paper', detail: '300 dpi · 1 dot = 0.085 mm' } : { title: 'Margin', detail: 'The print head cannot reach here' };
}

function Loupe({ hover, raster, frame, ops }: { hover: Hover; raster: HTMLCanvasElement; frame: Frame; ops: DrawOp[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pixels = useMemo(() => raster.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, raster.width, raster.height), [raster]);
  useLayoutEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = LOUPE * dpr;
    c.height = LOUPE * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fdfdfb';
    ctx.fillRect(0, 0, LOUPE, LOUPE);
    const n = Math.ceil(LOUPE / DOT_PX);
    const cx = Math.floor(hover.x * DOTS_PER_MM) - Math.floor(n / 2);
    const cy = Math.floor(hover.y * DOTS_PER_MM) - Math.floor(n / 2);
    const d = pixels.data;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const px = cx + i;
        const py = cy + j;
        const outside = px < 0 || py < 0 || px >= pixels.width || py >= pixels.height;
        if (outside) {
          ctx.fillStyle = '#eef0f3';
          ctx.fillRect(i * DOT_PX, j * DOT_PX, DOT_PX, DOT_PX);
          continue;
        }
        const k = (py * pixels.width + px) * 4;
        if (d[k + 1] > 128) continue;
        // Thermal dots are slightly round and bleed into their neighbours.
        ctx.fillStyle = d[k] > 128 ? '#cf2330' : '#1a1a1a';
        ctx.beginPath();
        ctx.roundRect(i * DOT_PX - 0.3, j * DOT_PX - 0.3, DOT_PX + 0.6, DOT_PX + 0.6, 1.6);
        ctx.fill();
      }
    }
    // Dot grid.
    ctx.strokeStyle = 'rgba(31,71,214,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * DOT_PX + 0.5, 0);
      ctx.lineTo(i * DOT_PX + 0.5, LOUPE);
      ctx.moveTo(0, i * DOT_PX + 0.5);
      ctx.lineTo(LOUPE, i * DOT_PX + 0.5);
      ctx.stroke();
    }
    const mid = Math.floor(n / 2) * DOT_PX;
    ctx.strokeStyle = '#1f47d6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mid + 0.75, mid + 0.75, DOT_PX - 1.5, DOT_PX - 1.5);
  }, [hover, pixels]);
  const spec = describe(ops, hover.x, hover.y, frame);
  const left = Math.min(hover.clientX + 24, window.innerWidth - LOUPE - 12);
  const top = Math.max(12, hover.clientY - LOUPE - 60);
  return (
    <div className="loupe" style={{ left, top }}>
      <canvas ref={ref} style={{ width: LOUPE, height: LOUPE }} />
      <div className="spec">
        <b>{spec.title}</b>
        <span>{spec.detail}</span>
      </div>
    </div>
  );
}

/* ───────── stage ───────── */

export function Stage({ items, activeIndex }: { items: BatchItem[]; activeIndex: number }) {
  const view = useStore((s) => s.view);
  const guides = useStore((s) => s.guides);
  const loupe = useStore((s) => s.loupe);
  const zoom = useStore((s) => s.zoom);
  const setStore = useStore((s) => s.set);
  const setActive = useStore((s) => s.setActive);
  const ks = useKindState();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<{ h: Hover; raster: HTMLCanvasElement } | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const active = items[activeIndex] ?? items[0];
  const frame = active?.composed.frame;
  const fitScale = frame ? Math.max(1.5, Math.min(24, (size.w - 260) / frame.physW, (size.h - 220) / frame.physH)) : 6;
  const scale = zoom === 'fit' ? fitScale : zoom;

  useEffect(() => {
    // After layout settles, so a batch that just grew does not cut the scroll short.
    const id = requestAnimationFrame(() => activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
    return () => cancelAnimationFrame(id);
  }, [activeIndex, scale, items.length]);

  const vertical = frame ? !frame.readAlong : false;
  const continuous = frame?.shape === 'continuous';
  const gap = (continuous ? 2.5 : 3) * scale;
  const linerPad = continuous ? 0 : 1.4 * scale;
  const ts = typeSystemById(ks.typeSystemId);
  const zoomBy = (f: number) => setStore('zoom', Math.max(1, Math.min(40, scale * f)));

  return (
    <main className="stage" aria-label="Label preview">
      <div className="stage-tools">
        <div className="group">
          <div className="seg" role="group" aria-label="Preview mode">
            <button aria-pressed={view === 'vector'} onClick={() => setStore('view', 'vector')} title="Smooth preview">
              Preview
            </button>
            <button aria-pressed={view === 'dots'} onClick={() => setStore('view', 'dots')} title="Exactly the dots the printer will burn">
              Print dots
            </button>
          </div>
        </div>
        <div className="group">
          <button className="tool" aria-pressed={guides} onClick={() => setStore('guides', !guides)} title="Show printable area (G)">
            Margins
          </button>
          <button className="tool" aria-pressed={loupe} onClick={() => setStore('loupe', !loupe)} title="Inspect dots and type under the pointer (L)">
            Loupe
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="group">
          <button className="tool" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">
            −
          </button>
          <button className="tool" onClick={() => setStore('zoom', 'fit')} aria-pressed={zoom === 'fit'}>
            Fit
          </button>
          <button className="tool" onClick={() => setStore('zoom', ACTUAL_SIZE)} aria-pressed={zoom !== 'fit' && Math.abs(zoom - ACTUAL_SIZE) < 0.01} title="Actual size on a 96 ppi screen">
            1:1
          </button>
          <button className="tool" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
            +
          </button>
          <span className="tool num" aria-live="polite" style={{ cursor: 'default' }}>
            {Math.round((scale / ACTUAL_SIZE) * 100)}%
          </span>
        </div>
      </div>

      <div className="roll-viewport" ref={viewportRef}>
        {items.length === 0 ? (
          <div className="empty" style={{ margin: 'auto' }}>
            Choose a record on the left, or add one, to put it on a label.
          </div>
        ) : (
          <div className={`roll${vertical ? ' vertical' : ''}`}>
            <div className={`liner${continuous ? ' continuous' : ''}`} style={{ gap, padding: vertical ? `${gap}px ${linerPad}px` : `${linerPad}px ${gap}px` }}>
              {items.slice(0, 40).map((item, i) => (
                <div key={item.id} ref={i === activeIndex ? activeRef : undefined}>
                  <LabelView
                    item={item}
                    scale={scale}
                    view={view}
                    guides={guides && i === activeIndex}
                    active={i === activeIndex}
                    index={i}
                    count={items.length}
                    onSelect={() => setActive(item.id)}
                    onHover={loupe ? (h, raster) => setHover(h && raster ? { h, raster } : null) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {frame && (
        <div className="statusbar">
          <span>
            <b>{frame.media.id}</b> {frame.media.name}
          </span>
          <span className="sep" />
          <span className="num">
            {frame.media.shape === 'continuous' ? `${frame.media.widthMm} mm × ${Math.round(frame.readAlong ? frame.physW : frame.physH)} mm cut` : `${frame.media.widthMm} × ${frame.media.lengthMm} mm`}
          </span>
          <span className="sep" />
          <span className="num" title="Printable area">
            {fmtMm(frame.wMm)} × {fmtMm(frame.hMm)} printable · {frame.wDots} × {frame.hDots} dots
          </span>
          <span className="sep" />
          <span>{ts.name}</span>
          {items.length > 1 && (
            <span className="pager">
              <button className="tool" aria-label="Previous label" disabled={activeIndex <= 0} onClick={() => setActive(items[activeIndex - 1].id)}>
                <Icon.chevronL />
              </button>
              <span className="num">
                {activeIndex + 1} of {items.length}
              </span>
              <button className="tool" aria-label="Next label" disabled={activeIndex >= items.length - 1} onClick={() => setActive(items[activeIndex + 1].id)}>
                <Icon.chevronR />
              </button>
            </span>
          )}
        </div>
      )}
      {hover && loupe && active && <Loupe hover={hover.h} raster={hover.raster} frame={active.composed.frame} ops={active.composed.layout.ops} />}
    </main>
  );
}
