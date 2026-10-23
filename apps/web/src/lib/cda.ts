// Reads the sandbox's CDA-like documents for display. Lab entries become FHIR Observations so they
// render with wardkit's LabResult. Unknown or malformed parts are skipped, never guessed.

import type { Observation } from 'fhir/r4';
import { INTERPRETATION, LOINC, UCUM } from '@/lib/wardkit/fhir';

const V3 = 'urn:hl7-org:v3';

export interface CdaSection {
  title: string;
  paragraphs: string[];
  items: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface CdaDocument {
  title: string;
  effectiveTime?: string;
  author?: string;
  organisation?: string;
  sections: CdaSection[];
  observations: Observation[];
}

/** Display text for UCUM units that read badly as written. */
const UNIT_TEXT: Record<string, string> = { 'mL/min/{1.73_m2}': 'mL/min/1.73 m²' };

const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name && c.namespaceURI === V3);
const first = (el: Element | Document, name: string) => el.getElementsByTagNameNS(V3, name)[0];
const text = (el: Element | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** CDA TS "20261009162044+0200" to ISO "2026-10-09T16:20:44+02:00". */
export function cdaToIso(ts: string | null | undefined): string | undefined {
  const m = ts ? /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?([+-]\d{4})?)?$/.exec(ts) : null;
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return `${y}-${mo}-${d}`;
  const zone = z ? `${z.slice(0, 3)}:${z.slice(3)}` : '';
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${zone}`;
}

function observation(obs: Element, fallbackTime?: string): Observation | undefined {
  const code = first(obs, 'code');
  const value = kids(obs, 'value')[0];
  if (!code || !value) return undefined;
  const num = Number(value.getAttribute('value'));
  if (!Number.isFinite(num)) return undefined;
  const unit = value.getAttribute('unit') ?? '';
  const q = (v: string | null) => (v === null ? undefined : { value: Number(v), unit: UNIT_TEXT[unit] ?? unit, system: UCUM, code: unit });
  const range = first(obs, 'observationRange');
  const low = range ? kids(first(range, 'value') ?? range, 'low')[0] : undefined;
  const high = range ? kids(first(range, 'value') ?? range, 'high')[0] : undefined;
  const interp = kids(obs, 'interpretationCode')[0]?.getAttribute('code');
  return {
    resourceType: 'Observation',
    status: 'final',
    code: { coding: [{ system: LOINC, code: code.getAttribute('code') ?? '', display: code.getAttribute('displayName') ?? undefined }], text: code.getAttribute('displayName') ?? undefined },
    effectiveDateTime: cdaToIso(kids(obs, 'effectiveTime')[0]?.getAttribute('value')) ?? fallbackTime,
    valueQuantity: q(String(num)),
    ...(interp ? { interpretation: [{ coding: [{ system: INTERPRETATION, code: interp }] }] } : {}),
    ...(low || high ? { referenceRange: [{ ...(low ? { low: q(low.getAttribute('value')) } : {}), ...(high ? { high: q(high.getAttribute('value')) } : {}) }] } : {}),
  };
}

export function parseCda(xml: string): CdaDocument {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The document could not be read.');
  const root = doc.documentElement;
  const effectiveTime = cdaToIso(kids(root, 'effectiveTime')[0]?.getAttribute('value'));
  const author = first(root, 'author');
  const sections: CdaSection[] = [];
  const observations: Observation[] = [];
  for (const s of Array.from(doc.getElementsByTagNameNS(V3, 'section'))) {
    const t = kids(s, 'text')[0];
    const table = t ? first(t, 'table') : undefined;
    sections.push({
      title: text(kids(s, 'title')[0]),
      paragraphs: t ? Array.from(t.getElementsByTagNameNS(V3, 'paragraph')).map((p) => text(p)) : [],
      items: t ? Array.from(t.getElementsByTagNameNS(V3, 'item')).map((p) => text(p)) : [],
      table: table
        ? {
            head: Array.from(table.getElementsByTagNameNS(V3, 'th')).map((c) => text(c)),
            rows: Array.from(first(table, 'tbody')?.getElementsByTagNameNS(V3, 'tr') ?? []).map((r) => Array.from(r.getElementsByTagNameNS(V3, 'td')).map((c) => text(c))),
          }
        : undefined,
    });
    for (const e of kids(s, 'entry')) {
      const o = first(e, 'observation');
      const parsed = o ? observation(o, effectiveTime) : undefined;
      if (parsed) observations.push(parsed);
    }
  }
  return {
    title: text(kids(root, 'title')[0]),
    effectiveTime,
    author: author ? text(first(author, 'assignedPerson')) || undefined : undefined,
    organisation: author ? text(first(author, 'representedOrganization')?.getElementsByTagNameNS(V3, 'name')[0]) || undefined : undefined,
    sections,
    observations,
  };
}
