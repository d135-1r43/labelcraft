import type { Organisation } from '../api/types';
import type { DbRecord } from '../db/types';
import type { EntityId } from '../db/entities';
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

export type Rec = DbRecord;

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
  /** The records this label prints. */
  entity: EntityId;
  layout(r: R, o: O, env: LayoutEnv): LabelLayout;
}
