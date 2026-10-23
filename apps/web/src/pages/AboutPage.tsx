import { SOURCES } from '@passayge/core';
import { Term } from '@/components/Tooltip';
import { DEMO, DEMO_LABEL } from '@/lib/mode';

export const UNOFFICIAL =
  'Unofficial simulation. Not affiliated with or endorsed by ELGA GmbH, the Dachverband der österreichischen Sozialversicherungsträger or HL7 International.';
export const HL7_TRADEMARK =
  'HL7, FHIR and the FHIR [FLAME DESIGN] are the registered trademarks of Health Level Seven International and their use does not constitute endorsement by HL7.';
export const CDA_TRADEMARK = 'CDA is a registered trademark of Health Level Seven International and its use does not constitute endorsement by HL7.';

export function AboutPage() {
  return (
    <article className="page">
      <h1>About Passayge</h1>
      <p>
        <strong>{UNOFFICIAL}</strong>
      </p>
      <p>
        Passayge (say it like &quot;passage&quot;) shows how patient data moves between providers in an ELGA-style health data exchange: finding a patient, the e-card <Term id="contact-confirmation">contact confirmation</Term> that opens their records for a limited
        time, reading documents, and the audit log that records every access. It is built for learning and as a portfolio piece. It is not connected to ELGA, the e-card system or any real service, and every person, provider and record in it is <Term id="synthetic">synthetic</Term>.
      </p>
      <p>
        The flows are ELGA-style, rebuilt on <Term id="ihe">IHE</Term> <Term id="fhir">FHIR</Term> profiles. ELGA itself uses HL7 <Term id="cda">CDA</Term> documents and SOAP-based IHE transactions; next to every call, Passayge shows the ELGA transaction it stands in for.
      </p>

      {DEMO && (
        <>
          <h2>Demo mode</h2>
          <p>
            <strong>{DEMO_LABEL}</strong> In this demo the sandbox engine (the same access rules, audit records and network log) runs in your browser with an in-memory FHIR store instead of HAPI FHIR, so
            there is no AT Core profile validation, and everything resets when you reload the page. The full stack, with HAPI FHIR and the HL7 Austria profiles, runs with{' '}
            <code>docker compose up</code> or in{' '}
            <a href="https://codespaces.new/Henrycarto/passayge" target="_blank" rel="noreferrer">
              GitHub Codespaces
            </a>
            .
          </p>
        </>
      )}

      <h2>What is real</h2>
      <ul>
        <li>A HAPI FHIR R4 server with the HL7 Austria FHIR Core profiles; every synthetic patient is checked against the <Term id="at-core">AT Core</Term> Patient profile.</li>
        <li>Patient search as IHE PDQm (ITI-78), document search and retrieval as IHE MHD (ITI-67, ITI-68), seeding as MHD Provide Document Bundle (ITI-65).</li>
        <li>An <Term id="audit-log">audit record</Term> for every access, written as a FHIR AuditEvent (ATNA FHIR Feed, ITI-20) and read back with ITI-81, carrying the fields the law lists.</li>
        <li>
          The access rules, each from a primary source: 90 days for doctors and hospitals, 28 days for pharmacies and for the vaccination record, extension to 365 days for trusted providers but not hospitals, blocking, opt-out, and pharmacies seeing medication only.
        </li>
      </ul>

      <h2>What is simplified</h2>
      <ul>
        <li>Inserting the <Term id="ecard">e-card</Term> is a button. There is no card reader, no e-card system and no signature on the contact.</li>
        <li>One sandbox service stands in for ELGA&apos;s contact confirmation service, <Term id="token-service">token service</Term> and policy store. It issues no SAML assertions.</li>
        <li>There is one <Term id="elga-area">ELGA area</Term> (affinity domain), so there are no cross-area queries (ITI-38, ITI-39).</li>
        <li>Patient search runs against the sandbox&apos;s own FHIR server, standing in for the <Term id="patient-index">central patient index</Term>.</li>
        <li>Documents are CDA-like XML, not checked against ELGA&apos;s implementation guides.</li>
        <li>Access is shown before you try. ELGA has no such query; software finds out by trying.</li>
        <li>A window of N days ends exactly N x 24 hours after the contact. The law says the identity check must not lie further back than N days; reading it as hours is the sandbox&apos;s assumption.</li>
        <li><Term id="simulated-time">Time is simulated</Term> and can jump ahead.</li>
      </ul>

      <h2>Not modelled</h2>
      <ul>
        <li>Hospital access for the whole inpatient stay with the window starting at discharge. The only source found is ELGA&apos;s architecture document of 2017, written when the window was 28 days; current law does not describe it.</li>
        <li>Dentists, care facilities, ambulance services and the 1450 health line as acting providers.</li>
        <li>Contactless e-authorisation through the social insurance app (planned as an extension).</li>
      </ul>

      <h2>Sources</h2>
      <ul>
        {Object.values(SOURCES).map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          </li>
        ))}
        <li>
          <a href="https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/" target="_blank" rel="noreferrer">
            ELGA GmbH: technical overview
          </a>
        </li>
        <li>
          <a href="https://profiles.ihe.net/ITI/MHD/" target="_blank" rel="noreferrer">
            IHE MHD
          </a>
          ,{' '}
          <a href="https://profiles.ihe.net/ITI/PDQm/" target="_blank" rel="noreferrer">
            IHE PDQm
          </a>
          ,{' '}
          <a href="https://profiles.ihe.net/ITI/BALP/" target="_blank" rel="noreferrer">
            IHE BALP
          </a>
        </li>
        <li>
          <a href="https://fhir.hl7.at/HL7-AT-FHIR-Core-R4/index.html" target="_blank" rel="noreferrer">
            HL7 Austria FHIR Core 2.0.0
          </a>
        </li>
      </ul>
      <p className="src">The full research, with every source and what was verified, is in the repository under docs/research.</p>

      <h2>Trademarks</h2>
      <p>{HL7_TRADEMARK}</p>
      <p>{CDA_TRADEMARK}</p>
      <p>ELGA and e-card are named only to describe what this sandbox imitates.</p>

      <h2>Licences</h2>
      <p>
        Passayge is MIT licensed. Fonts: Atkinson Hyperlegible Next and Mono (SIL Open Font License 1.1); Passayge Text is a modified version of Atkinson Hyperlegible Next with an unslashed zero, under the same licence. Icons: Lucide (ISC). Lab result
        component: wardkit (MIT).
      </p>
    </article>
  );
}
