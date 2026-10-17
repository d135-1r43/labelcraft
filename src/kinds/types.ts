import type { LabelcraftApi, Organisation } from '../api/types';
import type { LabelLayout } from '../engine/display';
import type { Measurer, TypeSystem } from '../engine/fonts';
import type { Frame } from '../engine/frame';
import type { TypeLocale } from '../engine/typeset';

export type KindId = 'address' | 'asset' | 'location' | 'food' | 'text';

export interface LayoutEnv {
  m: Measurer;
  frame: Frame;
  ts: TypeSystem;
  locale: TypeLocale;
  org: Organisation;
  now: Date;
}

export interface Rec {
  id: string;
}

export interface KindDef<R extends Rec = Rec, O = Record<string, unknown>> {
  id: KindId;
  name: string;
  /** What the label knows, in one line. */
  tagline: string;
  defaultMedia: string;
  /** Media that suit this kind, best first. */
  media: string[];
  defaultTypeSystem: string;
  defaultOptions: O;
  source: {
    /** Where records come from, as the person knows it. */
    name: string;
    noun: string;
    load(api: LabelcraftApi): Promise<R[]>;
    title(r: R): string;
    subtitle(r: R): string;
    group?(r: R): string;
    /** Records are edited inside Labelcraft (true) or mirrored read-only from a system of record. */
    editable: boolean;
    create?(): R;
  };
  layout(r: R, o: O, env: LayoutEnv): LabelLayout;
}
