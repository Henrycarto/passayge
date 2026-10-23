/**
 * Small helpers for reading FHIR R4 resources. No terminology server: codes are matched by
 * system and code exactly as they appear in the resource.
 */
import type { CodeableConcept, Coding, Observation, Quantity } from 'fhir/r4';

export const LOINC = 'http://loinc.org';
export const SNOMED = 'http://snomed.info/sct';
export const UCUM = 'http://unitsofmeasure.org';
export const INTERPRETATION = 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';

export function codings(cc: CodeableConcept | undefined): Coding[] {
  return cc?.coding ?? [];
}

export function hasCode(cc: CodeableConcept | undefined, system: string, code: string | readonly string[]): boolean {
  const codes = typeof code === 'string' ? [code] : code;
  return codings(cc).some((c) => c.system === system && c.code !== undefined && codes.includes(c.code));
}

/** The first code from `system` in a CodeableConcept. */
export function codeIn(cc: CodeableConcept | undefined, system: string): string | undefined {
  return codings(cc).find((c) => c.system === system && c.code)?.code;
}

/** Human-readable text of a CodeableConcept: its text, else the first display, else the first code. */
export function conceptText(cc: CodeableConcept | undefined): string | undefined {
  if (!cc) return undefined;
  if (cc.text) return cc.text;
  const withDisplay = codings(cc).find((c) => c.display);
  if (withDisplay?.display) return withDisplay.display;
  return codings(cc).find((c) => c.code)?.code;
}

/** The unit as written for people: `unit`, else the UCUM code. */
export function unitText(q: Quantity | undefined): string {
  return q?.unit ?? q?.code ?? '';
}

/** A Quantity as text, keeping the comparator: "<5 mg/L", never "5 mg/L". */
export function formatQuantity(q: Quantity | undefined): string | undefined {
  if (q?.value === undefined) return undefined;
  const unit = unitText(q);
  return `${q.comparator ?? ''}${q.value}${unit ? ` ${unit}` : ''}`;
}

/**
 * When an Observation applies: effectiveDateTime, effectiveInstant, or the end of an
 * effectivePeriod (falling back to its start). `issued` is when it was reported, not when it was
 * measured, so it is not used.
 */
export function effectiveTime(o: Observation): Date | undefined {
  const s = o.effectiveDateTime ?? o.effectiveInstant ?? o.effectivePeriod?.end ?? o.effectivePeriod?.start;
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

/** "14 Mar 2026, 23:30", in the given time zone (the runtime's zone if none is given). */
export function formatDateTime(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone,
  }).format(d);
}

export function formatTime(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(d);
}

/**
 * Round half away from zero to `places` decimals. Shifts the decimal point in the number's
 * string form instead of multiplying, so the result does not depend on the binary product.
 */
export function roundHalfUp(v: number, places = 0): number {
  const sign = v < 0 ? -1 : 1;
  if (String(Math.abs(v)).includes('e')) return Math.round(v * 10 ** places) / 10 ** places;
  const shifted = Math.round(Number(`${Math.abs(v)}e${places}`));
  return sign * Number(`${shifted}e-${places}`);
}
