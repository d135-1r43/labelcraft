import { addressKind } from './address/kind';
import { assetKind } from './asset/kind';
import { foodKind } from './food/kind';
import { locationKind } from './location/kind';
import { textKind } from './text/kind';
import type { KindDef, KindId, Rec } from './types';

export const KINDS = [addressKind, assetKind, locationKind, foodKind, textKind] as unknown as KindDef<Rec, Record<string, unknown>>[];

export const kindById = (id: KindId) => KINDS.find((k) => k.id === id)!;
