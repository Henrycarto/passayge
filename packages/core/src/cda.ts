// CDA-like XML for the sandbox documents. The structure follows HL7 CDA R2 (header, structured body,
// sections, lab observations) but it is NOT an ELGA document: no ELGA template IDs, not checked
// against ELGA Schematron. The interface labels it "CDA R2, not ELGA-conformant".

import type { SeedDocument, SeedPatient } from './seed';

/** OID arc for sandbox identifiers, derived from a fixed UUID (2.25 = UUID-based OIDs, ISO/IEC 9834-8). */
export const SANDBOX_OID = '2.25.211498157316409883021395548305094117467';

export const LOINC_TYPE: Record<SeedDocument['kind'], { code: string; display: string }> = {
  discharge: { code: '18842-5', display: 'Discharge summary' },
  lab: { code: '11502-2', display: 'Laboratory report' },
  imaging: { code: '18748-4', display: 'Diagnostic imaging study' },
  outpatient: { code: '11488-4', display: 'Consult note' },
  medication: { code: '10160-0', display: 'History of Medication use Narrative' },
  vaccinations: { code: '11369-6', display: 'History of Immunization Narrative' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "2026-10-09T16:20:44+02:00" to the CDA TS form "20261009162044+0200". */
export function cdaTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  const [, y, mo, d, h, mi, s, tz] = m;
  if (!h) return `${y}${mo}${d}`;
  const zone = !tz ? '' : tz === 'Z' ? '+0000' : tz.replace(':', '');
  return `${y}${mo}${d}${h}${mi}${s ?? '00'}${zone}`;
}

function section(title: string, body: string, entries = ''): string {
  return `
    <component>
      <section>
        <title>${esc(title)}</title>
        <text>${body}</text>${entries}
      </section>
    </component>`;
}

function narrative(doc: SeedDocument): string {
  return (doc.sections ?? [])
    .map((s) => {
      const paras = (s.paragraphs ?? []).map((p) => `<paragraph>${esc(p)}</paragraph>`).join('');
      const list = s.items?.length ? `<list>${s.items.map((i) => `<item>${esc(i)}</item>`).join('')}</list>` : '';
      return section(s.title, paras + list);
    })
    .join('');
}

function labSection(doc: SeedDocument): string {
  const rows = (doc.lab ?? [])
    .map((v) => `<tr><td>${esc(v.name)}</td><td>${v.value} ${esc(v.unit)}</td><td>${v.low ?? ''} to ${v.high ?? ''}</td><td>${v.flag}</td></tr>`)
    .join('');
  const entries = (doc.lab ?? [])
    .map(
      (v) => `
        <entry>
          <observation classCode="OBS" moodCode="EVN">
            <code code="${v.loinc}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${esc(v.name)}"/>
            <statusCode code="completed"/>
            <effectiveTime value="${cdaTime(doc.date)}"/>
            <value xsi:type="PQ" value="${v.value}" unit="${esc(v.unit)}"/>
            <interpretationCode code="${v.flag}" codeSystem="2.16.840.1.113883.5.83"/>
            <referenceRange>
              <observationRange>
                <value xsi:type="IVL_PQ">${v.low !== undefined ? `<low value="${v.low}" unit="${esc(v.unit)}"/>` : ''}${v.high !== undefined ? `<high value="${v.high}" unit="${esc(v.unit)}"/>` : ''}</value>
              </observationRange>
            </referenceRange>
          </observation>
        </entry>`,
    )
    .join('');
  return section('Results', `<table><thead><tr><th>Test</th><th>Result</th><th>Reference range</th><th>Flag</th></tr></thead><tbody>${rows}</tbody></table>`, entries);
}

function medicationSection(doc: SeedDocument): string {
  const rows = (doc.medications ?? [])
    .map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.strength)}</td><td>${esc(m.dose)}</td><td>${esc(m.indication)}</td><td>${m.prescribed}</td><td>${esc(m.prescriber)}</td><td>${m.dispensed ?? ''}</td></tr>`)
    .join('');
  return section('Medication', `<table><thead><tr><th>Medicine</th><th>Strength</th><th>Dose</th><th>For</th><th>Prescribed</th><th>Prescriber</th><th>Dispensed</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function vaccinationSection(doc: SeedDocument): string {
  const rows = (doc.vaccinations ?? [])
    .map((v) => `<tr><td>${v.date}</td><td>${esc(v.vaccine)}</td><td>${esc(v.against)}</td><td>${esc(v.dose)}</td><td>${esc(v.by)}</td></tr>`)
    .join('');
  return section('Vaccinations', `<table><thead><tr><th>Date</th><th>Vaccine</th><th>Against</th><th>Dose</th><th>Given by</th></tr></thead><tbody>${rows}</tbody></table>`);
}

export function buildCda(doc: SeedDocument, patient: SeedPatient): string {
  const type = LOINC_TYPE[doc.kind];
  const body =
    doc.kind === 'lab' ? labSection(doc) : doc.kind === 'medication' ? medicationSection(doc) : doc.kind === 'vaccinations' ? vaccinationSection(doc) : narrative(doc);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Passayge sandbox document. Synthetic data. CDA R2 structure, not an ELGA-conformant document. -->
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="AT"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <id root="${SANDBOX_OID}.1" extension="${esc(doc.id)}"/>
  <code code="${type.code}" codeSystem="2.16.840.1.113883.6.1" codeSystemName="LOINC" displayName="${esc(type.display)}"/>
  <title>${esc(doc.title)}</title>
  <effectiveTime value="${cdaTime(doc.date)}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <languageCode code="en"/>
  <recordTarget>
    <patientRole>
      <id root="${SANDBOX_OID}.2" extension="${esc(patient.svnr.replace(' ', ''))}" assigningAuthorityName="Passayge synthetic SVNR"/>
      <patient>
        <name><given>${esc(patient.given)}</given><family>${esc(patient.family)}</family></name>
        <administrativeGenderCode code="${patient.gender === 'female' ? 'F' : 'M'}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${cdaTime(patient.birthDate)}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="${cdaTime(doc.date)}"/>
    <assignedAuthor>
      <id root="${SANDBOX_OID}.3" extension="${esc(doc.author.id)}"/>
      ${doc.person ? `<assignedPerson><name>${esc(doc.person)}</name></assignedPerson>` : ''}
      <representedOrganization><name>${esc(doc.author.name)}</name><addr><city>${esc(doc.author.town)}</city></addr></representedOrganization>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian><representedCustodianOrganization><id root="${SANDBOX_OID}.3" extension="${esc(doc.author.id)}"/><name>${esc(doc.author.name)}</name></representedCustodianOrganization></assignedCustodian>
  </custodian>
  <component>
    <structuredBody>${body}
    </structuredBody>
  </component>
</ClinicalDocument>
`;
}
