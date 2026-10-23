// Name and identifier rules from wardkit's PatientBanner, reused so the banner follows the same
// conventions. Passayge keeps its own banner layout because the access block sits inside it;
// a later wardkit change could add an access slot (docs/design/design-direction.md).
// Copied from wardkit registry/wardkit/components/patient-banner.tsx at commit 6fd9ce2 (MIT).

import type { HumanName, Identifier } from 'fhir/r4';
import { codings } from '@/lib/wardkit/fhir';

/** `official`, then `usual`, then the first name that is not marked old. */
export function pickName(names: HumanName[] | undefined): HumanName | undefined {
  if (!names?.length) return undefined;
  return names.find((n) => n.use === 'official') ?? names.find((n) => n.use === 'usual') ?? names.find((n) => n.use !== 'old') ?? names[0];
}

/** "HUBER, Margarete": family name in capitals first, as on most hospital banners. */
export function formatName(n: HumanName | undefined): string {
  if (!n) return 'Name not recorded';
  const given = (n.given ?? []).join(' ');
  if (n.family) return [n.family.toUpperCase(), [given, ...(n.suffix ?? [])].filter(Boolean).join(' ')].filter(Boolean).join(', ') + (n.prefix?.length ? ` (${n.prefix.join(' ')})` : '');
  return n.text ?? (given || 'Name not recorded');
}

/** `official`, then type MR (medical record number), then `usual`, then the first not marked old. */
export function pickIdentifier(ids: Identifier[] | undefined): Identifier | undefined {
  if (!ids?.length) return undefined;
  const mr = ids.find((i) => codings(i.type).some((c) => c.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' && c.code === 'MR'));
  return ids.find((i) => i.use === 'official') ?? mr ?? ids.find((i) => i.use === 'usual') ?? ids.find((i) => i.use !== 'old') ?? ids[0];
}
