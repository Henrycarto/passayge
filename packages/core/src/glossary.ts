// Every term the interface uses, in English with the official German term where one exists.
// Each explanation is one or two plain sentences; the help panel and the tooltips share them.

export interface Term {
  id: string;
  term: string;
  /** Official German term, shown once in brackets. */
  de?: string;
  explain: string;
  source?: string;
}

const RIS = 'https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=';

export const GLOSSARY: Term[] = [
  { id: 'elga', term: 'ELGA', de: 'Elektronische Gesundheitsakte', explain: "Austria's national electronic health record. Documents stay with the hospital or lab that wrote them; ELGA finds them and controls who may open them.", source: 'https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/' },
  { id: 'ecard', term: 'e-card', explain: "The patient's social insurance card. Inserting it in a practice proves the patient was there and opens their records for a limited time. In Passayge the card is simulated." },
  { id: 'contact-confirmation', term: 'Contact confirmation', de: 'Kontaktbestätigung', explain: 'Proof that the patient was with you, created when their e-card is inserted. It decides for how long you can open their records.', source: 'https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349' },
  { id: 'access-window', term: 'Access window', explain: 'How long after the contact you may open the records: 90 days for doctors and hospitals, 28 days for pharmacies, 28 days for the vaccination record.', source: `${RIS}18` },
  { id: 'documents', term: 'Documents', de: 'e-Befunde', explain: 'Discharge letters, laboratory and imaging reports and other findings stored in the health record.', source: `${RIS}2` },
  { id: 'medication', term: 'Medication', de: 'e-Medikation', explain: 'Medicines prescribed and dispensed, kept for 18 months after dispensing. Used to check for interactions.', source: `${RIS}20` },
  { id: 'vaccinations', term: 'Vaccinations', de: 'e-Impfpass', explain: 'The electronic vaccination record. It has its own rules: 28 days for every provider and no opt-out.', source: `${RIS}24f` },
  { id: 'discharge-letter', term: 'Discharge letter', de: 'Entlassungsbrief', explain: 'The summary a hospital writes when a patient goes home: diagnoses, treatment and what happens next.' },
  { id: 'lab-report', term: 'Laboratory report', de: 'Laborbefund', explain: 'Results of blood or other tests, each with its reference range.' },
  { id: 'imaging-report', term: 'Imaging report', de: 'Befund bildgebende Diagnostik', explain: "A radiologist's written findings for an X-ray, ultrasound, CT or MRI." },
  { id: 'outpatient-report', term: 'Outpatient report', de: 'Ambulanzbefund', explain: 'Findings from a hospital outpatient visit.' },
  { id: 'provider', term: 'Healthcare provider', de: 'Gesundheitsdiensteanbieter, GDA', explain: 'A doctor, hospital, pharmacy or care facility that takes part in the health record.', source: `${RIS}2` },
  { id: 'trusted-provider', term: 'Provider of special trust', de: 'Gesundheitsdiensteanbieter des besonderen Vertrauens', explain: 'A doctor or pharmacy the patient lets see their records for up to 365 days, for example their family doctor. Not possible for hospitals.', source: `${RIS}18` },
  { id: 'opt-out', term: 'Opt-out', de: 'Widerspruch', explain: 'The patient has left the health record, fully or for documents or medication only. Their records cannot be opened.', source: `${RIS}15` },
  { id: 'blocked', term: 'Blocked provider', explain: "The patient set this provider's access period to 0 days. The contact confirmation exists but gives no access.", source: `${RIS}16` },
  { id: 'objection', term: 'Objection for one treatment case', de: 'Widerspruch für einen Behandlungsfall', explain: 'The patient asked that nothing from this visit is stored in the health record. It is noted when the e-card is read.', source: `${RIS}18` },
  { id: 'audit-log', term: 'Audit log', de: 'Protokollierung', explain: 'Every access is recorded with time, person, provider, data and outcome. Patients can read their own log; it is kept for three years.', source: `${RIS}22` },
  { id: 'granted', term: 'Granted', explain: 'The access rule allowed the request.' },
  { id: 'denied', term: 'Denied', explain: 'The access rule refused the request. The reason is shown next to it.' },
  { id: 'expired', term: 'Expired', explain: 'There is a contact confirmation, but its time window has ended. Insert the e-card again.' },
  { id: 'entered-in-error', term: 'Entered in error', explain: 'The author withdrew this document because it was wrong. It is kept for the record but must not be used.' },
  { id: 'recorded', term: 'Recorded', explain: 'Something was written, for example a new contact confirmation.' },
  { id: 'svnr', term: 'Social security number', de: 'Sozialversicherungsnummer, SVNR', explain: 'A 10-digit number: serial, check digit, date of birth. Passayge only uses serials below 100, which are never issued, so no number belongs to a real person.', source: 'https://www.parlament.gv.at/dokument/XXIII/AB/4690/fnameorig_136871.html' },
  { id: 'synthetic', term: 'Synthetic', explain: 'Made up for the sandbox. No person, practice or record in Passayge is real.' },
  { id: 'simulated-time', term: 'Simulated time', explain: 'The sandbox has its own clock so you can jump ahead and see access windows end. It does not change your computer clock.' },
  { id: 'patient-index', term: 'Central patient index', de: 'Zentraler Patientenindex, Z-PI', explain: 'The national list of people in the health record, used to find a patient and the areas that hold their documents.', source: `${RIS}18` },
  { id: 'elga-area', term: 'ELGA area', de: 'ELGA-Bereich', explain: 'A group of hospitals or providers that stores its own documents and registry. Passayge simulates one area. In IHE terms: an affinity domain.', source: 'https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/' },
  { id: 'token-service', term: 'Token service', de: 'ELGA-Token-Service, ETS', explain: 'The ELGA component that checks the rules and issues a signed permission for each request. Passayge uses a simplified access check instead.' },
  { id: 'ihe', term: 'IHE', explain: 'Integrating the Healthcare Enterprise: an organisation that defines how systems exchange health data, as numbered transactions such as ITI-67.', source: 'https://profiles.ihe.net/ITI/' },
  { id: 'iti', term: 'ITI transaction', explain: 'A numbered step from the IHE IT Infrastructure framework. ITI-67, for example, means "find the documents of a patient".', source: 'https://profiles.ihe.net/ITI/' },
  { id: 'fhir', term: 'FHIR', explain: 'An HL7 standard for health data on the web: records are resources such as Patient or DocumentReference, read and written over HTTP.', source: 'https://hl7.org/fhir/R4/' },
  { id: 'cda', term: 'CDA', explain: 'HL7 Clinical Document Architecture, the XML document format ELGA uses today. Passayge documents are CDA-like and not checked against ELGA rules.', source: 'https://www.gesundheit.gv.at/professional/it-services/implementierungsleitfaeden' },
  { id: 'at-core', term: 'AT Core', explain: "HL7 Austria's base FHIR profiles for Austria. Passayge checks its patients against the AT Core Patient profile.", source: 'https://fhir.hl7.at/HL7-AT-FHIR-Core-R4/index.html' },
  { id: 'simplified', term: 'Simplified', explain: 'This step is shorter than in ELGA. The note next to it says what the real system does.' },
];

export const GLOSSARY_BY_ID: Record<string, Term> = Object.fromEntries(GLOSSARY.map((t) => [t.id, t]));
