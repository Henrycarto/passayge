import type { Observation, ObservationComponent, ObservationReferenceRange } from 'fhir/r4';
import { AlertTriangle, ArrowDown, ArrowUp, Ban, Check, ChevronsDown, ChevronsUp, Clock, Flag, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { INTERPRETATION, codings, conceptText, effectiveTime, formatDateTime, formatQuantity, unitText } from '@/lib/wardkit/fhir';
import { cn } from '@/lib/utils';

export interface LabResultProps {
  /** A FHIR R4 Observation with a single result. */
  observation: Observation;
  /** IANA time zone for the result time, e.g. "Europe/Vienna". Defaults to the runtime's zone. */
  timeZone?: string;
  className?: string;
}

type Tone = 'critical' | 'abnormal' | 'normal' | 'neutral';

/** v3-ObservationInterpretation codes the component knows. Any other code is shown as its own text. */
export const INTERPRETATIONS: Record<string, { label: string; tone: Tone; icon: typeof ArrowUp }> = {
  HH: { label: 'Critically high', tone: 'critical', icon: ChevronsUp },
  LL: { label: 'Critically low', tone: 'critical', icon: ChevronsDown },
  H: { label: 'High', tone: 'abnormal', icon: ArrowUp },
  L: { label: 'Low', tone: 'abnormal', icon: ArrowDown },
  A: { label: 'Abnormal', tone: 'abnormal', icon: AlertTriangle },
  N: { label: 'Normal', tone: 'normal', icon: Check },
};

const TONE: Record<Tone, string> = {
  critical: 'border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100',
  abnormal: 'border-amber-700 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100',
  normal: 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100',
  neutral: 'border-border bg-muted text-foreground',
};

export interface LabFlag { code?: string; label: string; tone: Tone; icon: typeof ArrowUp }

/** Flags come only from `interpretation`. The component never derives one from the reference range. */
export function interpretationFlags(o: Pick<Observation, 'interpretation'>): LabFlag[] {
  return (o.interpretation ?? []).map((cc) => {
    const coding = codings(cc).find((c) => c.system === INTERPRETATION && c.code);
    const known = coding?.code ? INTERPRETATIONS[coding.code] : undefined;
    if (known) return { code: coding!.code, ...known };
    return { code: coding?.code, label: conceptText(cc) ?? 'Flag', tone: 'neutral', icon: Flag };
  });
}

export function formatRange(r: ObservationReferenceRange): string {
  const low = r.low?.value;
  const high = r.high?.value;
  const unit = unitText(r.high ?? r.low);
  const u = unit ? ` ${unit}` : '';
  let s: string;
  if (low !== undefined && high !== undefined) s = `${low} to ${high}${u}`;
  else if (low !== undefined) s = `${low}${u} or more`;
  else if (high !== undefined) s = `${high}${u} or less`;
  else s = r.text ?? 'Range not stated';
  const qualifiers = [conceptText(r.type), ...(r.appliesTo ?? []).map(conceptText), r.age ? ageText(r.age) : undefined].filter(Boolean);
  if (r.text && (low !== undefined || high !== undefined)) qualifiers.push(r.text);
  return qualifiers.length ? `${s} (${qualifiers.join(', ')})` : s;
}

function ageText(age: NonNullable<ObservationReferenceRange['age']>): string {
  const lo = age.low?.value;
  const hi = age.high?.value;
  const unit = unitText(age.high ?? age.low) || 'years';
  if (lo !== undefined && hi !== undefined) return `age ${lo} to ${hi} ${unit}`;
  if (lo !== undefined) return `age ${lo} ${unit} or more`;
  return `age up to ${hi} ${unit}`;
}

/** An Observation or one of its components: both carry value[x], dataAbsentReason, interpretation and referenceRange. */
type Valued = Observation | ObservationComponent;

function valueText(o: Valued): string | undefined {
  if (o.valueQuantity) return formatQuantity(o.valueQuantity);
  if (o.valueString !== undefined) return o.valueString;
  if (o.valueInteger !== undefined) return String(o.valueInteger);
  if (o.valueCodeableConcept) return conceptText(o.valueCodeableConcept);
  if (o.valueBoolean !== undefined) return o.valueBoolean ? 'Yes' : 'No';
  return undefined;
}

function hasUnsupportedValue(o: Valued): boolean {
  return [o.valueRange, o.valueRatio, o.valueSampledData, o.valueTime, o.valueDateTime, o.valuePeriod].some((v) => v !== undefined);
}

const hasAnyValue = (o: Valued) => valueText(o) !== undefined || hasUnsupportedValue(o);

function absentText(absent: NonNullable<Valued['dataAbsentReason']>): string {
  return [codings(absent).find((c) => c.display)?.display ?? codings(absent)[0]?.code, absent.text].filter(Boolean).join('. ') || 'reason not stated';
}

/** Value (or the reason there is none) and reference range: the same rules for the main value and for each component. */
function ValueAndRange({ item, size }: { item: Valued; size: 'main' | 'component' }) {
  const value = valueText(item);
  const ranges = item.referenceRange ?? [];
  return (
    <>
      {item.dataAbsentReason ? (
        <p className="text-base">
          <span className="font-medium">No value: </span>
          {absentText(item.dataAbsentReason)}
        </p>
      ) : value !== undefined ? (
        <p className={cn('font-semibold tabular-nums', size === 'main' ? 'text-2xl' : 'text-lg')}>{value}</p>
      ) : (
        <p className="text-base">{hasUnsupportedValue(item) ? 'This value type is not displayed by this component.' : 'No value recorded.'}</p>
      )}
      {ranges.length > 0 ? <Ranges ranges={ranges} /> : <p className="text-sm text-muted-foreground">No reference range given.</p>}
    </>
  );
}

function Ranges({ ranges, label = 'Reference range' }: { ranges: ObservationReferenceRange[]; label?: string }) {
  return (
    <dl className="text-sm">
      <dt className="inline text-muted-foreground">{label}: </dt>
      {ranges.map((r, i) => (
        <dd key={i} className="inline">{i > 0 ? '; ' : ''}{formatRange(r)}</dd>
      ))}
    </dl>
  );
}

function Badge({ tone, icon: Icon, children }: { tone: Tone; icon: typeof ArrowUp; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm font-medium', TONE[tone])}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </span>
  );
}

function Shell({ title, time, children, className, muted }: { title: string; time?: string; children: ReactNode; className?: string; muted?: boolean }) {
  return (
    <section aria-label={`Lab result: ${title}`} className={cn('rounded-lg border bg-card p-4 text-card-foreground', muted && 'border-dashed', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {time && <p className="text-sm text-muted-foreground">{time}</p>}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export function LabResult({ observation: o, timeZone, className }: LabResultProps) {
  const title = conceptText(o.code) ?? 'Unnamed test';
  const when = effectiveTime(o);
  const time = when ? formatDateTime(when, timeZone) : 'Time not recorded';

  if (o.status === 'entered-in-error') {
    return (
      <Shell title={title} time={time} className={className} muted>
        <Badge tone="neutral" icon={Ban}>Entered in error</Badge>
        <p className="text-sm">This record was entered in error. It is not a valid result and no value is shown.</p>
      </Shell>
    );
  }
  if (o.status === 'cancelled') {
    return (
      <Shell title={title} time={time} className={className} muted>
        <Badge tone="neutral" icon={Ban}>Cancelled</Badge>
        <p className="text-sm">The test was cancelled. There is no result.</p>
      </Shell>
    );
  }
  if (o.status === 'registered') {
    return (
      <Shell title={title} time={time} className={className} muted>
        <Badge tone="neutral" icon={Clock}>Pending</Badge>
        <p className="text-sm">Registered, no result yet.</p>
      </Shell>
    );
  }

  const flags = interpretationFlags(o);
  // Panels such as blood pressure (85354-9) carry their values in components, not in value[x].
  const components = !hasAnyValue(o) && o.component?.length ? o.component : undefined;

  return (
    <Shell title={title} time={time} className={className}>
      {(o.status !== 'final' || flags.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {o.status === 'preliminary' && <Badge tone="neutral" icon={Clock}>Preliminary, may change</Badge>}
          {(o.status === 'amended' || o.status === 'corrected') && (
            <Badge tone="neutral" icon={PencilLine}>{o.status === 'amended' ? 'Amended' : 'Corrected'}: changed after first report</Badge>
          )}
          {o.status === 'unknown' && <Badge tone="neutral" icon={AlertTriangle}>Status unknown</Badge>}
          {flags.map((f, i) => (
            <Badge key={i} tone={f.tone} icon={f.icon}>{f.label}</Badge>
          ))}
        </div>
      )}
      {components ? (
        <>
          {o.dataAbsentReason && <p className="text-base"><span className="font-medium">No value: </span>{absentText(o.dataAbsentReason)}</p>}
          <ul aria-label="Components" className="space-y-2">
            {components.map((c, i) => {
              const cFlags = interpretationFlags(c);
              return (
                <li key={i} className="border-t pt-2 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{conceptText(c.code) ?? 'Unnamed component'}</span>
                    {cFlags.map((f, j) => (
                      <Badge key={j} tone={f.tone} icon={f.icon}>{f.label}</Badge>
                    ))}
                  </div>
                  <ValueAndRange item={c} size="component" />
                </li>
              );
            })}
          </ul>
          {o.referenceRange?.length ? <Ranges ranges={o.referenceRange} label="Reference range for the panel" /> : null}
        </>
      ) : (
        <ValueAndRange item={o} size="main" />
      )}
    </Shell>
  );
}
