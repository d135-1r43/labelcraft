import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>, size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const Icon = {
  address: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M5 8h4M5 10.5h6.5M5 13h5" />
      <path d="M13.5 7h1.5" strokeWidth="2.2" />
    </svg>
  ),
  asset: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
      <path d="M5 7.5h3v3H5zM7 12.5h1M5 12.5h.01M10.5 8h4.5M10.5 10.5h3M10.5 12.5h4" />
    </svg>
  ),
  location: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <path d="M3 3.5v13M17 3.5v13M3 8h14M3 13h14" />
      <path d="M6 5.8h3M11.5 10.6h3" strokeWidth="2" />
    </svg>
  ),
  food: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 6.8v3.9l2.6 1.6" />
      <path d="M7.5 2.5h5" />
    </svg>
  ),
  text: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <path d="M3.5 15.5 7.6 4.5h.8l4.1 11M5 11.8h6" />
      <path d="M13.5 9.6c.5-.8 1.3-1.1 2.1-1.1 1.2 0 1.9.7 1.9 1.9v5.1M17.5 12.3c-2.6 0-4 .6-4 1.8 0 .9.7 1.5 1.7 1.5 1.3 0 2.3-1 2.3-2.4" />
    </svg>
  ),
  contents: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 22)}>
      <path d="M3 7.2 10 4l7 3.2v7.6L10 18l-7-3.2z" />
      <path d="M3 7.2 10 10.4l7-3.2M10 10.4V18" />
      <path d="M6.2 9.9v2.6" strokeWidth="2" />
    </svg>
  ),
  search: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <circle cx="6" cy="6" r="4.2" />
      <path d="m9.2 9.2 3 3" />
    </svg>
  ),
  error: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 4.8v3.8M8 11h.01" strokeWidth="1.8" />
    </svg>
  ),
  warn: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <path d="M8 2.2 14.3 13H1.7z" />
      <path d="M8 6.3v3.2M8 11.2h.01" strokeWidth="1.8" />
    </svg>
  ),
  info: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 7.3V11M8 5h.01" strokeWidth="1.8" />
    </svg>
  ),
  check: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <path d="m3.5 8.3 3 3 6-6.6" strokeWidth="1.8" />
    </svg>
  ),
  printer: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 18)}>
      <path d="M5.5 7V3h9v4M5.5 14H3.5V8.5A1.5 1.5 0 0 1 5 7h10a1.5 1.5 0 0 1 1.5 1.5V14h-2" />
      <path d="M5.5 11.5h9V17h-9z" />
    </svg>
  ),
  rotate: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v2.8h-2.8" />
    </svg>
  ),
  chevronL: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <path d="M8.5 3 4.5 7l4 4" />
    </svg>
  ),
  chevronR: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <path d="m5.5 3 4 4-4 4" />
    </svg>
  ),
  plus: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <path d="M7 2.5v9M2.5 7h9" />
    </svg>
  ),
  download: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 16)} viewBox="0 0 16 16">
      <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" />
    </svg>
  ),
  link: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 13)} viewBox="0 0 14 14">
      <path d="M6 8a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M8 6a2.6 2.6 0 0 0-3.7 0l-2 2A2.6 2.6 0 0 0 6 11.7l.6-.6" />
    </svg>
  ),
  external: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <path d="M8.5 2.5h3v3M11.5 2.5 6.5 7.5M10 8.5v2.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V4.8c0-.4.4-.8.8-.8h2.2" />
    </svg>
  ),
  gear: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 18)}>
      <path d="M8.51 3.78 8.9 1.77h2.2l.39 2.01 1.85.76 1.7-1.14 1.56 1.56-1.14 1.7.76 1.85 2.01.39v2.2l-2.01.39-.76 1.85 1.14 1.7-1.56 1.56-1.7-1.14-1.85.76-.39 2.01H8.9l-.39-2.01-1.85-.76-1.7 1.14-1.56-1.56 1.14-1.7-.76-1.85-2.01-.39V8.9l2.01-.39.76-1.85-1.14-1.7L4.96 3.4l1.7 1.14Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  ),
  close: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 14)} viewBox="0 0 14 14">
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
    </svg>
  ),
  queue: (p: SVGProps<SVGSVGElement> = {}) => (
    <svg {...base(p, 18)}>
      <path d="M4 5.5h12M4 10h12M4 14.5h7" />
    </svg>
  ),
};

/** The Labelcraft mark: a die-cut label with two set lines. */
export function Mark() {
  return (
    <svg width="26" height="20" viewBox="0 0 26 20" aria-hidden>
      <rect x="0.75" y="0.75" width="24.5" height="18.5" rx="3.5" fill="#fff" stroke="#15181c" strokeWidth="1.5" />
      <rect x="5" y="6" width="11" height="2.4" fill="#15181c" />
      <rect x="5" y="11" width="7" height="2.4" fill="#1f47d6" />
    </svg>
  );
}
