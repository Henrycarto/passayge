// The sandbox's synthetic world. Every person, practice, hospital, pharmacy and record here is made up.
// Street names were checked against OpenStreetMap (23 Oct 2026) and do not exist in their towns;
// postcodes and towns are real. SVNRs use serials below 100, which are never issued.

import type { Contact, PatientSettings, Role } from './rules';
import { syntheticSvnr } from './svnr';

/** The simulated clock starts here: Friday 23 Oct 2026, 14:05 in Vienna. */
export const SIM_START = '2026-10-23T12:05:00.000Z';
export const TIME_ZONE = 'Europe/Vienna';

export interface Provider {
  id: string;
  role: Role;
  /** Organisation name as the health record would show it. */
  organisation: string;
  /** The natural person acting; every read is logged with a person (e-card ELGA FAQ 2.2.1). */
  person: string;
  personTitle: string;
  town: string;
  /** Short description for the "acting as" switcher. */
  label: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'prov-aigner', role: 'doctor', organisation: 'Ordination Dr. Lena Aigner', person: 'Dr. Lena Aigner', personTitle: 'General practitioner', town: 'Graz', label: 'GP, Graz' },
  { id: 'prov-wimmer', role: 'doctor', organisation: 'Ordination Dr. Johannes Wimmer', person: 'Dr. Johannes Wimmer', personTitle: 'Internal medicine', town: 'Leibnitz', label: 'Internist, Leibnitz' },
  { id: 'prov-kgf', role: 'hospital', organisation: 'Klinikum Grazer Feld', person: 'OA Dr. Martin Pichler', personTitle: 'Department of Surgery', town: 'Graz', label: 'Hospital, Graz' },
  { id: 'prov-hirsch', role: 'pharmacy', organisation: 'Apotheke zum Silbernen Hirschen', person: 'Mag. pharm. Florian Gruber', personTitle: 'Pharmacist', town: 'Graz', label: 'Pharmacy, Graz' },
];

/** Organisations that only appear as document authors. */
export const AUTHORS = {
  lab: { id: 'org-lab', name: 'Medizinisches Labor Grazer Feld', town: 'Graz' },
  radiology: { id: 'org-rad', name: 'Radiologie Zentrum Grazer Feld', town: 'Graz' },
  kgfSurgery: { id: 'prov-kgf', name: 'Klinikum Grazer Feld, Department of Surgery', town: 'Graz' },
  kgfMedicine: { id: 'prov-kgf', name: 'Klinikum Grazer Feld, Internal Medicine', town: 'Graz' },
  aigner: { id: 'prov-aigner', name: 'Ordination Dr. Lena Aigner', town: 'Graz' },
  hirsch: { id: 'prov-hirsch', name: 'Apotheke zum Silbernen Hirschen', town: 'Graz' },
} as const;

export interface SeedPatient {
  id: string;
  family: string;
  given: string;
  gender: 'female' | 'male';
  birthDate: string;
  svnr: string;
  line: string;
  postalCode: string;
  city: string;
  state: string;
  /** What this patient demonstrates in the sandbox. */
  scenario: string;
}

const patient = (p: Omit<SeedPatient, 'svnr'>, serial: number): SeedPatient => ({ ...p, svnr: syntheticSvnr(p.birthDate, serial) });

export const PATIENTS: SeedPatient[] = [
  patient({ id: 'pas-theresia', family: 'Brandstätter', given: 'Theresia', gender: 'female', birthDate: '1962-03-14', line: 'Kastanienzeile 12', postalCode: '8010', city: 'Graz', state: 'Steiermark', scenario: 'Doctor within 90 days, vaccination window just ended; pharmacy limited to medication.' }, 49),
  patient({ id: 'pas-ferdinand', family: 'Brandstätter', given: 'Ferdinand', gender: 'male', birthDate: '1988-07-02', line: 'Weinlaubengasse 4', postalCode: '8430', city: 'Leibnitz', state: 'Steiermark', scenario: 'Partial opt-out: medication.' }, 17),
  patient({ id: 'pas-herta', family: 'Unterberger', given: 'Herta', gender: 'female', birthDate: '1941-11-30', line: 'Föhrenhain 3', postalCode: '8600', city: 'Bruck an der Mur', state: 'Steiermark', scenario: 'Family doctor extended to 365 days; hospital contact expired.' }, 83),
  patient({ id: 'pas-lukas', family: 'Pirker', given: 'Lukas', gender: 'male', birthDate: '2003-05-11', line: 'Hollerstaudengasse 9', postalCode: '1100', city: 'Wien', state: 'Wien', scenario: 'Doctor blocked by the patient (0 days).' }, 26),
  patient({ id: 'pas-maria', family: 'Haslinger', given: 'Maria', gender: 'female', birthDate: '1979-09-22', line: 'Mostbirnweg 21', postalCode: '4020', city: 'Linz', state: 'Oberösterreich', scenario: 'General opt-out; the vaccination record stays.' }, 61),
];

export const CONTACTS: Contact[] = [
  { id: 'kb-1', patientId: 'pas-theresia', providerId: 'prov-aigner', at: '2026-09-25T08:40:03.000Z' },
  { id: 'kb-2', patientId: 'pas-theresia', providerId: 'prov-kgf', at: '2026-10-05T05:55:00.000Z' },
  { id: 'kb-3', patientId: 'pas-theresia', providerId: 'prov-hirsch', at: '2026-10-23T09:14:32.000Z' },
  { id: 'kb-4', patientId: 'pas-ferdinand', providerId: 'prov-aigner', at: '2026-10-20T07:15:10.000Z' },
  { id: 'kb-5', patientId: 'pas-herta', providerId: 'prov-aigner', at: '2026-04-06T07:50:44.000Z' },
  { id: 'kb-6', patientId: 'pas-herta', providerId: 'prov-kgf', at: '2026-07-10T13:20:00.000Z' },
  { id: 'kb-7', patientId: 'pas-lukas', providerId: 'prov-aigner', at: '2026-10-12T14:02:00.000Z' },
  { id: 'kb-8', patientId: 'pas-lukas', providerId: 'prov-hirsch', at: '2026-10-01T15:31:27.000Z' },
  { id: 'kb-9', patientId: 'pas-maria', providerId: 'prov-aigner', at: '2026-10-22T06:48:00.000Z' },
];

export const SETTINGS: Record<string, PatientSettings> = {
  'pas-theresia': { optOut: { documents: false, medication: false }, providerDays: {} },
  'pas-ferdinand': { optOut: { documents: false, medication: true }, providerDays: {} },
  'pas-herta': { optOut: { documents: false, medication: false }, providerDays: { 'prov-aigner': 365 } },
  'pas-lukas': { optOut: { documents: false, medication: false }, providerDays: { 'prov-aigner': 0 } },
  'pas-maria': { optOut: { documents: true, medication: true }, providerDays: {} },
};

// ---------------------------------------------------------------------------------------------
// Documents

export type DocKind = 'discharge' | 'lab' | 'imaging' | 'outpatient' | 'medication' | 'vaccinations';

export interface LabValue {
  loinc: string;
  name: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
  /** HL7 v3 ObservationInterpretation: H, L, N. */
  flag: 'H' | 'L' | 'N';
}

export interface MedicationEntry {
  name: string;
  strength: string;
  dose: string;
  indication: string;
  prescribed: string;
  prescriber: string;
  dispensed?: string;
}

export interface VaccinationEntry {
  vaccine: string;
  against: string;
  date: string;
  dose: string;
  by: string;
}

export interface Section {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface SeedDocument {
  id: string;
  patientId: string;
  kind: DocKind;
  title: string;
  summary: string;
  /** Local date-time in Vienna, ISO with offset. */
  date: string;
  author: { id: string; name: string; town: string };
  person?: string;
  status: 'current' | 'entered-in-error';
  replaces?: string;
  sections?: Section[];
  lab?: LabValue[];
  medications?: MedicationEntry[];
  vaccinations?: VaccinationEntry[];
}

export const DOCUMENTS: SeedDocument[] = [
  // Theresia Brandstätter
  {
    id: 'doc-the-discharge-20261009', patientId: 'pas-theresia', kind: 'discharge', title: 'Discharge letter, physician', summary: 'Laparoscopic cholecystectomy',
    date: '2026-10-09T16:20:44+02:00', author: AUTHORS.kgfSurgery, person: 'OA Dr. Martin Pichler', status: 'current',
    sections: [
      { title: 'Reason for admission', paragraphs: ['Recurrent right upper quadrant pain after meals since July 2026. Gallstones on ultrasound of 18 Aug 2026.'] },
      { title: 'Diagnoses', items: ['Symptomatic cholecystolithiasis (K80.20)', 'Type 2 diabetes mellitus (E11.9)', 'Essential hypertension (I10)'] },
      { title: 'Procedure', paragraphs: ['Laparoscopic cholecystectomy on 6 Oct 2026, without complications.'] },
      { title: 'Course', paragraphs: ['Uneventful recovery. Tolerating a normal diet from day 1. Wounds dry. Blood glucose 128 to 176 mg/dL during the stay.'] },
      { title: 'Recommendations', items: ['Wound check by the family doctor on day 10.', 'Restart metformin when eating normally.', 'No heavy lifting for 4 weeks.'] },
    ],
  },
  {
    id: 'doc-the-lab-20260930-v2', patientId: 'pas-theresia', kind: 'lab', title: 'Laboratory report', summary: 'Diabetes follow-up panel',
    date: '2026-09-30T08:05:12+02:00', author: AUTHORS.lab, status: 'current', replaces: 'doc-the-lab-20260930-v1',
    lab: [
      { loinc: '4548-4', name: 'HbA1c', value: 7.8, unit: '%', low: 4.0, high: 5.6, flag: 'H' },
      { loinc: '1558-6', name: 'Glucose, fasting', value: 142, unit: 'mg/dL', low: 70, high: 99, flag: 'H' },
      { loinc: '2160-0', name: 'Creatinine', value: 1.12, unit: 'mg/dL', low: 0.5, high: 0.9, flag: 'H' },
      { loinc: '98979-8', name: 'eGFR (CKD-EPI 2021)', value: 54, unit: 'mL/min/{1.73_m2}', low: 60, flag: 'L' },
      { loinc: '2823-3', name: 'Potassium', value: 4.6, unit: 'mmol/L', low: 3.5, high: 5.1, flag: 'N' },
      { loinc: '2951-2', name: 'Sodium', value: 139, unit: 'mmol/L', low: 136, high: 145, flag: 'N' },
    ],
  },
  {
    id: 'doc-the-lab-20260930-v1', patientId: 'pas-theresia', kind: 'lab', title: 'Laboratory report', summary: 'Withdrawn: creatinine transcribed as 11.2 mg/dL',
    date: '2026-09-30T07:41:02+02:00', author: AUTHORS.lab, status: 'entered-in-error',
    lab: [
      { loinc: '4548-4', name: 'HbA1c', value: 7.8, unit: '%', low: 4.0, high: 5.6, flag: 'H' },
      { loinc: '2160-0', name: 'Creatinine', value: 11.2, unit: 'mg/dL', low: 0.5, high: 0.9, flag: 'H' },
    ],
  },
  {
    id: 'doc-the-imaging-20260818', patientId: 'pas-theresia', kind: 'imaging', title: 'Imaging report, abdominal ultrasound', summary: 'Gallstones, no duct dilatation',
    date: '2026-08-18T10:12:00+02:00', author: AUTHORS.radiology, person: 'Dr. Sabine Lechner', status: 'current',
    sections: [
      { title: 'Question', paragraphs: ['Right upper quadrant pain after meals. Gallstones?'] },
      { title: 'Findings', paragraphs: ['Gallbladder with several mobile stones up to 14 mm and a wall of 3 mm. Common bile duct 5 mm. Liver of normal size with mildly increased echogenicity. Kidneys and spleen unremarkable.'] },
      { title: 'Impression', items: ['Cholecystolithiasis without signs of acute cholecystitis.', 'No bile duct dilatation.', 'Mild hepatic steatosis.'] },
    ],
  },
  {
    id: 'doc-the-outpatient-20260703', patientId: 'pas-theresia', kind: 'outpatient', title: 'Outpatient report', summary: 'Diabetes clinic',
    date: '2026-07-03T11:30:00+02:00', author: AUTHORS.kgfMedicine, person: 'Dr. Anna Moser', status: 'current',
    sections: [
      { title: 'Assessment', paragraphs: ['Type 2 diabetes since 2018, HbA1c rising from 7.1 % to 7.6 % over the last year. No hypoglycaemia. Feet: sensation intact.'] },
      { title: 'Plan', items: ['Continue metformin 1000 mg twice daily.', 'Dietary advice given.', 'Review with laboratory results in 3 months.'] },
    ],
  },
  {
    id: 'doc-the-medication', patientId: 'pas-theresia', kind: 'medication', title: 'Medication list', summary: '3 active medicines',
    date: '2026-10-23T11:14:50+02:00', author: AUTHORS.hirsch, status: 'current',
    medications: [
      { name: 'Metformin', strength: '1000 mg tablet', dose: '1-0-1', indication: 'Type 2 diabetes', prescribed: '2026-09-25', prescriber: 'Dr. Lena Aigner', dispensed: '2026-10-23' },
      { name: 'Ramipril', strength: '5 mg tablet', dose: '1-0-0', indication: 'Hypertension', prescribed: '2026-09-25', prescriber: 'Dr. Lena Aigner', dispensed: '2026-10-23' },
      { name: 'Atorvastatin', strength: '20 mg tablet', dose: '0-0-1', indication: 'Cardiovascular risk', prescribed: '2026-09-25', prescriber: 'Dr. Lena Aigner' },
    ],
  },
  {
    id: 'doc-the-vaccinations', patientId: 'pas-theresia', kind: 'vaccinations', title: 'Vaccination record', summary: '3 vaccinations',
    date: '2025-10-14T09:20:00+02:00', author: AUTHORS.aigner, status: 'current',
    vaccinations: [
      { vaccine: 'Influenza, quadrivalent', against: 'Influenza', date: '2025-10-14', dose: 'Season 2025/26', by: 'Dr. Lena Aigner' },
      { vaccine: 'COVID-19, mRNA', against: 'COVID-19', date: '2025-09-30', dose: 'Booster', by: 'Dr. Lena Aigner' },
      { vaccine: 'Tetanus, diphtheria, pertussis, polio', against: 'Tetanus, diphtheria, pertussis, polio', date: '2019-05-08', dose: 'Booster', by: 'Dr. Lena Aigner' },
    ],
  },
  // Ferdinand Brandstätter: medication opted out, so no medication list is stored.
  {
    id: 'doc-fer-lab-20261020', patientId: 'pas-ferdinand', kind: 'lab', title: 'Laboratory report', summary: 'Routine check-up',
    date: '2026-10-20T09:40:00+02:00', author: AUTHORS.lab, status: 'current',
    lab: [
      { loinc: '2093-3', name: 'Cholesterol, total', value: 186, unit: 'mg/dL', high: 200, flag: 'N' },
      { loinc: '1558-6', name: 'Glucose, fasting', value: 88, unit: 'mg/dL', low: 70, high: 99, flag: 'N' },
      { loinc: '2160-0', name: 'Creatinine', value: 0.94, unit: 'mg/dL', low: 0.7, high: 1.2, flag: 'N' },
    ],
  },
  {
    id: 'doc-fer-vaccinations', patientId: 'pas-ferdinand', kind: 'vaccinations', title: 'Vaccination record', summary: '1 vaccination',
    date: '2024-04-02T15:00:00+02:00', author: AUTHORS.aigner, status: 'current',
    vaccinations: [{ vaccine: 'Tick-borne encephalitis', against: 'Tick-borne encephalitis', date: '2024-04-02', dose: 'Booster', by: 'Dr. Lena Aigner' }],
  },
  // Herta Unterberger
  {
    id: 'doc-her-discharge-20260714', patientId: 'pas-herta', kind: 'discharge', title: 'Discharge letter, physician', summary: 'Decompensated heart failure',
    date: '2026-07-14T14:45:00+02:00', author: AUTHORS.kgfMedicine, person: 'Dr. Anna Moser', status: 'current',
    sections: [
      { title: 'Diagnoses', items: ['Decompensated heart failure with reduced ejection fraction (I50.13)', 'Atrial fibrillation, permanent (I48.2)', 'Chronic kidney disease, stage 3a (N18.31)'] },
      { title: 'Course', paragraphs: ['Admitted with breathlessness and leg oedema. Weight down by 4.2 kg with intravenous diuretics. Discharged in a stable state.'] },
      { title: 'Recommendations', items: ['Daily weight; call the practice if it rises by more than 2 kg in 3 days.', 'Potassium and creatinine in 1 week.'] },
    ],
  },
  {
    id: 'doc-her-medication', patientId: 'pas-herta', kind: 'medication', title: 'Medication list', summary: '3 active medicines',
    date: '2026-07-20T10:02:00+02:00', author: AUTHORS.aigner, status: 'current',
    medications: [
      { name: 'Torasemide', strength: '10 mg tablet', dose: '1-0-0', indication: 'Heart failure', prescribed: '2026-07-20', prescriber: 'Dr. Lena Aigner', dispensed: '2026-07-20' },
      { name: 'Bisoprolol', strength: '2.5 mg tablet', dose: '1-0-0', indication: 'Heart failure, rate control', prescribed: '2026-07-20', prescriber: 'Dr. Lena Aigner', dispensed: '2026-07-20' },
      { name: 'Apixaban', strength: '2.5 mg tablet', dose: '1-0-1', indication: 'Atrial fibrillation', prescribed: '2026-07-20', prescriber: 'Dr. Lena Aigner', dispensed: '2026-07-20' },
    ],
  },
  {
    id: 'doc-her-vaccinations', patientId: 'pas-herta', kind: 'vaccinations', title: 'Vaccination record', summary: '2 vaccinations',
    date: '2025-11-03T10:00:00+01:00', author: AUTHORS.aigner, status: 'current',
    vaccinations: [
      { vaccine: 'Influenza, high dose', against: 'Influenza', date: '2025-11-03', dose: 'Season 2025/26', by: 'Dr. Lena Aigner' },
      { vaccine: 'Pneumococcal conjugate, 20-valent', against: 'Pneumococcal disease', date: '2023-10-17', dose: 'Single dose', by: 'Dr. Lena Aigner' },
    ],
  },
  // Lukas Pirker
  {
    id: 'doc-luk-imaging-20261012', patientId: 'pas-lukas', kind: 'imaging', title: 'Imaging report, chest X-ray', summary: 'No pneumonia',
    date: '2026-10-12T16:10:00+02:00', author: AUTHORS.radiology, person: 'Dr. Sabine Lechner', status: 'current',
    sections: [
      { title: 'Question', paragraphs: ['Cough for 3 weeks, known asthma. Pneumonia?'] },
      { title: 'Findings', paragraphs: ['Lungs clear, no infiltrate, no effusion. Heart size normal.'] },
    ],
  },
  {
    id: 'doc-luk-medication', patientId: 'pas-lukas', kind: 'medication', title: 'Medication list', summary: '2 active medicines',
    date: '2026-10-01T15:31:27+02:00', author: AUTHORS.hirsch, status: 'current',
    medications: [
      { name: 'Salbutamol', strength: '100 micrograms per puff, inhaler', dose: 'As needed, up to 4 times a day', indication: 'Asthma', prescribed: '2026-09-29', prescriber: 'Dr. Lena Aigner', dispensed: '2026-10-01' },
      { name: 'Budesonide and formoterol', strength: '160/4.5 micrograms per puff, inhaler', dose: '1-0-1', indication: 'Asthma', prescribed: '2026-09-29', prescriber: 'Dr. Lena Aigner', dispensed: '2026-10-01' },
    ],
  },
  {
    id: 'doc-luk-vaccinations', patientId: 'pas-lukas', kind: 'vaccinations', title: 'Vaccination record', summary: '2 vaccinations',
    date: '2025-10-20T17:00:00+02:00', author: AUTHORS.aigner, status: 'current',
    vaccinations: [
      { vaccine: 'Influenza, quadrivalent', against: 'Influenza', date: '2025-10-20', dose: 'Season 2025/26', by: 'Dr. Lena Aigner' },
      { vaccine: 'Human papillomavirus, 9-valent', against: 'Human papillomavirus', date: '2017-03-14', dose: 'Dose 2 of 2', by: 'School vaccination programme' },
    ],
  },
  // Maria Haslinger: general opt-out, so only the vaccination record exists.
  {
    id: 'doc-mar-vaccinations', patientId: 'pas-maria', kind: 'vaccinations', title: 'Vaccination record', summary: '1 vaccination',
    date: '2025-11-02T09:10:00+01:00', author: AUTHORS.aigner, status: 'current',
    vaccinations: [{ vaccine: 'Influenza, quadrivalent', against: 'Influenza', date: '2025-11-02', dose: 'Season 2025/26', by: 'Dr. Lena Aigner' }],
  },
];

/** The record type a document belongs to, for the access rules. */
export function recordKindOf(kind: DocKind): 'documents' | 'medication' | 'vaccinations' {
  return kind === 'medication' ? 'medication' : kind === 'vaccinations' ? 'vaccinations' : 'documents';
}
