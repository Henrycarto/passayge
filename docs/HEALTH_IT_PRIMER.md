# Health IT primer

A plain-language guide to the standards, Austrian institutions, codes, clinical scores, regulations and engineering patterns that come up across my projects. Each entry has: what it is in one sentence, a short explanation with an everyday analogy, who publishes it, where it is used, a small example where it helps, which of my projects use it, and an official source.

How to read the sources: every entry links an official or primary source. All links were checked on 23 October 2026. Some official sites block automated checks (loinc.org, iso.org, kdigo.org returned "forbidden" to a script but are the publishers' own pages); one did not respond at all (imdrf.org), which is said where it is cited. Statements I could not check against a source are marked **not confirmed**.

My projects referred to below: **Passayge** (ELGA-style access sandbox), **hl7-fhir-gateway** (HL7 v2 to FHIR gateway), **wardkit** (React components for FHIR data), **second-read** (medical image annotation with four-eyes review), **Chemsisy** (molecule explorer for students), **pulse-fhir-gateway** (pulse monitor to FHIR) with **medtrace** (traceability checker), **Boensity** (bone density monitoring), **Wardread** (browser extension that makes HL7 v2 and FHIR readable), **medrag-eval** (evaluation of question answering over medical literature).

## Contents

1. [Messaging and data exchange](#1-messaging-and-data-exchange): HL7, HL7 v2, MLLP, FHIR, SMART on FHIR, CDA, IHE profiles, HAPI FHIR
2. [Austria](#2-austria): ELGA, e-card and contact confirmation, GTelG 2012, Z-PI, ELGA areas, e-Befunde, e-Medikation, e-Impfpass, HL7 Austria and AT Core, the Wahlärzte obligation
3. [Codes and vocabularies](#3-codes-and-vocabularies): LOINC, SNOMED CT, ICD-10, UCUM, ATC
4. [Imaging](#4-imaging): DICOM, PACS, de-identification, burned-in annotations
5. [Clinical scores and measures](#5-clinical-scores-and-measures): NEWS2, FRAX, DEXA and T-scores, HbA1c, eGFR
6. [Regulation and quality](#6-regulation-and-quality): EU MDR, SaMD, ISO 13485, IEC 62304, ISO 14971, traceability, GDPR for health data
7. [Engineering patterns](#7-engineering-patterns): idempotency, outbox, dead-letter queue, audit trail and hash chaining, four-eyes review, access windows
8. [How it all fits together](#8-how-it-all-fits-together)

---

## 1. Messaging and data exchange

### HL7 (the organisation)

**In one sentence.** Health Level Seven International is the non-profit standards organisation behind the most widely used health data exchange standards: HL7 v2, CDA and FHIR.

**Explained.** HL7 writes the "grammar" that hospital systems use to talk to each other. Its members are vendors, hospitals, governments and individuals, and its standards are developed in work groups and approved by ballot. The name refers to layer 7, the application layer, of the OSI networking model. Think of it as the body that agrees the format of postal addresses: it does not deliver letters, but without it every post office would write addresses differently. Countries have national affiliates, such as HL7 Austria, that adapt the standards locally.

**Who publishes it.** HL7 International, Ann Arbor, USA, with national affiliates.

**Where it is used.** Worldwide. In Austria, through HL7 Austria (see [section 2](#hl7-austria-and-the-at-core-profiles)), and in ELGA, whose documents are HL7 CDA.

**In my projects.** All projects that use HL7 v2, CDA or FHIR (see the entries below).

**Source.** [HL7 International: about](https://www.hl7.org/about/index.cfm)

### HL7 v2 (segments, fields, ADT, ORU, ACK)

**In one sentence.** HL7 version 2 is the oldest and still the most common message format inside hospitals: short text messages made of lines (segments) whose fields are separated by the `|` character.

**Explained.** Each message is a set of lines. Each line starts with a three-letter segment name: `MSH` (message header: who sent it, what type, which version), `PID` (patient identification), `PV1` (patient visit), `OBR` (order) and `OBX` (one observation, such as a lab value). Fields inside a segment are numbered, so `PID-3` is the patient identifier and `OBX-5` is the value. The message type says what happened: **ADT** messages (admission, discharge, transfer) report patient movements, for example `ADT^A01` for an admission; **ORU** messages (`ORU^R01`) carry observation results such as lab values. The receiver answers with an **ACK** (acknowledgement) whose `MSA-1` code is `AA` (accepted), `AE` (error) or `AR` (rejected). An analogy: a v2 message is like a paper form with numbered boxes, where everyone agrees what goes in box 3, but people still fill in the boxes slightly differently, which is why every interface needs testing.

**Who publishes it.** HL7 International. Versions 2.1 to 2.9 exist; all are backward compatible in spirit.

**Where it is used.** Internationally, it is the workhorse of in-hospital integration between the admission system, the lab, radiology and the electronic record. In Austria it is widely used inside hospitals (**not confirmed** against an official Austrian source).

**Example** (fictional admission, `ADT^A01`):

```
MSH|^~\&|ADMIT|KLINIKUM|GATEWAY|KLINIKUM|20261023140500||ADT^A01|MSG00001|P|2.5
PID|1||12345^^^KLINIKUM^MR||BRANDSTAETTER^THERESIA||19620314|F
PV1|1|I|CHIR^101^1||||||||||||||||V2026-0042
```

**In my projects.**
- hl7-fhir-gateway: parses `MSH`, `PID`, `PV1`, `OBR`, `OBX` (`mapping/PatientMapper.java`, `AdtMapper.java`, `OruMapper.java`), supports ADT A01, A03, A04, A08 and ORU R01, and answers with AA, AE or AR acknowledgements (`ingest/IngestService.java`, `api/Hl7Controller.java`).
- Wardread: parses any HL7 v2 message selected on a web page and explains each field, with definitions for versions 2.1 to 2.9.

**Source.** [HL7 International: HL7 Version 2 product brief](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=185)

### MLLP

**In one sentence.** The Minimal Lower Layer Protocol is the simple way HL7 v2 messages are sent over a network connection: each message is wrapped in a start byte and two end bytes.

**Explained.** A plain network connection (TCP) is just a stream of bytes, so the receiver needs to know where one message ends and the next begins. MLLP solves this by putting the byte `0x0B` before each message and the bytes `0x1C 0x0D` after it. It adds nothing else: no encryption and no login, which is why it is normally used inside a protected hospital network or through a secure tunnel. Think of it as an envelope with a clear "start" and "end" mark, but no lock.

**Who publishes it.** HL7 International, as part of the HL7 v2 transport specifications.

**Where it is used.** Internationally, for almost every HL7 v2 interface between hospital systems.

**Example.** `<0x0B>MSH|^~\&|...<0x0D>PID|...<0x0D><0x1C><0x0D>`

**In my projects.** hl7-fhir-gateway runs an MLLP listener (`mllp/MllpServer.java`, `mllp/Hl7ReceivingApplication.java`) and strips the framing in `hl7/Hl7Parser.java`; `samples/send-mllp.sh` sends test messages.

**Source.** [HL7 International: Transport specification MLLP product brief](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=55)

### FHIR (resources, R4, profiles, implementation guides, Bundle, REST API)

**In one sentence.** FHIR (Fast Healthcare Interoperability Resources, said "fire") is HL7's modern standard for exchanging health data with ordinary web technology.

**Explained.**
- **Resources** are the building blocks: small, well-defined records such as `Patient`, `Observation` (one measurement), `Encounter` (a visit), `DocumentReference` (a document's index card), `AuditEvent` and about 140 others. Each is a JSON or XML document with a fixed structure.
- **R4** is release 4 (version 4.0.1, published 2019). It is the release used by HL7 Austria's AT Core R4 profiles and by all my projects. R5 also exists.
- **Profiles** add rules to a resource for one use, for example "a patient must have a name and a gender". An **implementation guide** (IG) is a published package of profiles, value sets and examples for a country or a use case.
- A **Bundle** is a resource that carries several others: a `searchset` Bundle holds search results, a `transaction` Bundle asks the server to store all its entries at once or none of them.
- The **REST API** means you read and write resources with standard web requests: `GET /Patient/123`, `GET /Observation?patient=123&code=...`, `POST`, `PUT`.

Analogy: FHIR resources are like standard shipping containers. A port does not need to know what is inside to load one, because the size, the corners and the label are agreed in advance.

**Who publishes it.** HL7 International.

**Where it is used.** Internationally, it is required for patient access in the USA and is the basis of the International Patient Summary. In Austria, HL7 Austria publishes AT Core and other FHIR guides; ELGA itself is still mainly CDA (HL7 Austria FHIR Core IG, see [AT Core](#hl7-austria-and-the-at-core-profiles)).

**Example** (a heart-rate Observation, shortened):

```json
{
  "resourceType": "Observation",
  "status": "final",
  "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] },
  "subject": { "reference": "Patient/pas-theresia" },
  "effectiveDateTime": "2026-10-23T14:05:00+02:00",
  "valueQuantity": { "value": 72, "unit": "/min", "system": "http://unitsofmeasure.org", "code": "/min" }
}
```

**In my projects.**
- Passayge: Patient, Practitioner, Organization, DocumentReference, Binary, AuditEvent, CodeSystem; transaction Bundles for seeding (`packages/core/src/fhir.ts`); AT Core Patient profile.
- hl7-fhir-gateway: Patient, Encounter and Observation in transaction Bundles with conditional updates (`mapping/TransactionBuilder.java`).
- wardkit: React components that take Patient, Observation and AllergyIntolerance as props (`registry/wardkit/components/`).
- pulse-fhir-gateway: Device and heart-rate Observations with the FHIR heart-rate profile (`pulse_fhir/fhir.py`).
- Boensity: reads Patient and bone density Observations from an EHR (`packages/fhir-client/src/index.ts`).
- Wardread: detects FHIR resources on a page and resolves references inside Bundles.

**Source.** [HL7 FHIR R4 specification](https://hl7.org/fhir/R4/), [Bundle](https://hl7.org/fhir/R4/bundle.html), [RESTful API](https://hl7.org/fhir/R4/http.html), [Profiling](https://hl7.org/fhir/R4/profiling.html)

### SMART on FHIR

**In one sentence.** SMART on FHIR is the standard way for an app to launch from, or connect to, an electronic health record and get permission to read FHIR data, using OAuth 2.0.

**Explained.** A hospital does not want every app to have a password to its database. SMART defines how an app asks the record system for access: the app reads the server's `.well-known/smart-configuration`, sends the user to log in and approve "scopes" (for example `patient/Observation.read`), and receives a short-lived access token. It can launch "inside" a clinician's record with the current patient already selected. PKCE, a one-time secret the app proves it holds, protects the exchange. Think of a hotel key card: reception checks who you are once and gives you a card that opens only your room, and only until checkout.

**Who publishes it.** HL7 International (SMART App Launch implementation guide), originally from the SMART Health IT project at Boston Children's Hospital and Harvard.

**Where it is used.** Internationally, widely in the USA (major EHR vendors). In Austria: **not confirmed**.

**In my projects.** Boensity implements a SMART standalone launch with PKCE (`packages/fhir-client/src/index.ts`: `discoverSmartConfiguration`, `buildAuthorizeUrl`, `exchangeCodeForToken`, `refreshAccessToken`), against the Epic sandbox and launch.smarthealthit.org (`packages/fhir-client/src/issuers.ts`). hl7-fhir-gateway and pulse-fhir-gateway list SMART Backend Services as a gap for production (README only).

**Source.** [HL7 SMART App Launch implementation guide](https://hl7.org/fhir/smart-app-launch/)

### CDA (Clinical Document Architecture)

**In one sentence.** CDA is HL7's XML standard for clinical documents, such as discharge letters and lab reports, that must stay readable by people and processable by computers.

**Explained.** A CDA document has a header (patient, author, date, type, custodian) and a body of sections. Each section has human-readable text, and can also have coded entries a computer can use, such as a lab value with its LOINC code. The document is a whole: it is signed, stored and shown as it was written. Templates (identified by OIDs) say which sections a given document type must have. Think of an official letter with a standard letterhead and labelled paragraphs, where some paragraphs also contain a machine-readable table.

**Who publishes it.** HL7 International (CDA Release 2).

**Where it is used.** In Austria, ELGA documents (discharge letters, lab and imaging reports, e-Medikation, e-Impfpass) are CDA R2 according to ELGA's implementation guides. Internationally, for example in US C-CDA documents.

**Example** (one lab entry, shortened):

```xml
<observation classCode="OBS" moodCode="EVN">
  <code code="4548-4" codeSystem="2.16.840.1.113883.6.1" displayName="HbA1c"/>
  <value xsi:type="PQ" value="7.8" unit="%"/>
  <interpretationCode code="H"/>
</observation>
```

**In my projects.** Passayge generates CDA-like documents (header, sections, coded lab entries with LOINC) that are deliberately not ELGA-conformant (`packages/core/src/cda.ts`, `buildCda()`), and the web client reads them back into FHIR Observations (`apps/web/src/lib/cda.ts`).

**Source.** [HL7 International: CDA Release 2 product brief](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=7); for Austria, [ELGA implementation guides on gesundheit.gv.at](https://www.gesundheit.gv.at/professional/it-services/implementierungsleitfaeden)

### IHE and its profiles (XDS.b, PIX/PDQ, MHD, PDQm, ATNA audit)

**In one sentence.** IHE (Integrating the Healthcare Enterprise) publishes "profiles": tested recipes that say exactly which standards to combine, and how, for one integration task.

**Explained.** A standard like HL7 offers many options; two vendors can both "follow HL7" and still not work together. An IHE profile removes the options for one job, names the actors (for example "Document Consumer") and numbers each message as a transaction (for example ITI-18). Vendors test against each other at events called Connectathons. Think of a recipe: the standards are the ingredients, the profile says which ones, how much and in what order.

- **XDS.b** (Cross-Enterprise Document Sharing): documents stay in repositories at the source; a central registry holds their index entries. ITI-41 stores and registers a document, ITI-18 searches the registry, ITI-43 retrieves the document. Built on SOAP web services.
- **PIX** (Patient Identifier Cross-referencing) links one person's different numbers across organisations; **PDQ** (Patient Demographics Query) finds a patient by name, birth date or number. The HL7 V3 variants are ITI-45 and ITI-47.
- **MHD** (Mobile access to Health Documents) is the FHIR version of document sharing: ITI-65 provide, ITI-67 find, ITI-68 retrieve.
- **PDQm** is the FHIR version of PDQ: ITI-78.
- **ATNA** (Audit Trail and Node Authentication) requires mutual authentication between systems and an audit record for every access (ITI-20 Record Audit Event). **BALP** (Basic Audit Log Patterns) describes how to fill FHIR AuditEvents.

**Who publishes it.** IHE International, founded by the Radiological Society of North America (RSNA) and HIMSS.

**Where it is used.** In Austria, ELGA is built on IHE profiles: XDS.b registries in each ELGA area, PIX and PDQ (HL7 V3) against the central patient index, XCA between areas, and ATNA audit (ELGA overall architecture 2.30a). Internationally, in many national exchanges.

**Example** (MHD find documents, ITI-67): `GET /fhir/DocumentReference?patient=Patient/pas-theresia&status=current`

**In my projects.** Passayge implements PDQm ITI-78, MHD ITI-65, ITI-67 and ITI-68, and ATNA ITI-20 and ITI-81 with FHIR AuditEvents, each shown next to the ELGA transaction it stands in for (`packages/core/src/ihe.ts`, `engine/engine.ts`).

**Source.** [IHE International](https://www.ihe.net/); [XDS.b](https://profiles.ihe.net/ITI/TF/Volume1/ch-10.html), [PIX](https://profiles.ihe.net/ITI/TF/Volume1/ch-5.html), [PDQ](https://profiles.ihe.net/ITI/TF/Volume1/ch-8.html), [ATNA](https://profiles.ihe.net/ITI/TF/Volume1/ch-9.html), [MHD](https://profiles.ihe.net/ITI/MHD/), [PDQm](https://profiles.ihe.net/ITI/PDQm/), [BALP](https://profiles.ihe.net/ITI/BALP/); for ELGA, [ELGA overall architecture 2.30a](https://www.elga.gv.at/fileadmin/user_upload/Dokumente_PDF_MP4/Technisches/ELGA_Gesamtarchitektur_2.30a.pdf)

### HAPI FHIR

**In one sentence.** HAPI FHIR is a widely used open-source Java library and server for FHIR, which can also validate resources against profiles.

**Explained.** HAPI provides a complete FHIR server (the "JPA server", which stores resources in a database) that you can run as a Docker image, plus Java libraries to build and parse resources. Its `$validate` operation checks a resource against the base specification and any installed implementation guide. There is also a separate HAPI library for HL7 v2. Think of it as a ready-built warehouse that already knows how every FHIR container must look, and rejects the ones that do not.

**Who publishes it.** The HAPI FHIR open-source project, led by Smile Digital Health.

**Where it is used.** Internationally, as a reference and test server and in many products.

**In my projects.**
- Passayge: HAPI FHIR R4, image `hapiproject/hapi:v8.12.0-2`, with AT Core 2.0.0 installed from local packages (`infra/hapi/`).
- hl7-fhir-gateway: image `hapiproject/hapi:v7.4.0` as the FHIR target, and the HAPI HL7v2 2.5.1 and HAPI FHIR 7.4.0 Java libraries.
- pulse-fhir-gateway: image `v8.12.0-2` in its CI integration job.
- wardkit and pulse-fhir-gateway: the HL7 FHIR validator (`validator_cli.jar` 7.0.2) to check fixtures and examples.

**Source.** [HAPI FHIR](https://hapifhir.io/)

---

## 2. Austria

### ELGA

**In one sentence.** ELGA (Elektronische Gesundheitsakte) is Austria's national electronic health record system, which lets authorised providers find and open a patient's documents and medication across organisations.

**Explained.** ELGA does not copy all records into one central database. Documents stay where they were written; ELGA keeps index entries in registries and controls who may open them, while e-Medikation is a central store. Access depends on a contact confirmation from the e-card, on time windows and on the patient's own settings, and every access is logged for the patient to read in the ELGA portal. Think of a library catalogue: it tells you which branch holds a book and whether your card lets you borrow it, but the book stays on the shelf.

**Who runs it.** ELGA GmbH (owned by the federal government, the federal states and the social insurance: **not confirmed** against an official page in this primer), under the law GTelG 2012.

**Where it is used.** In Austria, by hospitals, doctors in practice, pharmacies and care facilities. Patients use the ELGA portal through gesundheit.gv.at.

**In my projects.** Passayge simulates ELGA's access rules, audit log and transactions with synthetic data, and is not connected to ELGA.

**Source.** [ELGA GmbH: technical overview](https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/), [gesundheit.gv.at: ELGA](https://www.gesundheit.gv.at/gesundheitsleistungen/elga.html)

### The e-card and the contact confirmation

**In one sentence.** The e-card is the Austrian social insurance card; reading it in a practice creates a contact confirmation (Kontaktbestätigung), the proof of a treatment relationship that opens the patient's ELGA records for a limited time.

**Explained.** The law requires the patient's identity to be checked electronically, with the patient taking part, for example by reading the e-card (§ 18 Abs. 4 GTelG 2012). The resulting contact confirmation is stored centrally. When the provider later asks for records, the system checks the confirmation against the time window and the patient's current settings. The patient can also grant access contactlessly through the social insurance app, valid for 24 hours. Think of a visitor badge with an expiry time: the badge proves you were let in, and the door checks the time every time you use it.

**Who runs it.** The e-card system is run for the social insurance (Dachverband der österreichischen Sozialversicherungsträger); the operator's FAQ is published on chipkarte.at.

**Where it is used.** Every practice and pharmacy with an e-card connection in Austria.

**In my projects.** Passayge: the "Insert e-card" button records a simulated contact confirmation (`POST /api/contacts`, `insertCard()` in `packages/core/src/engine/engine.ts`).

**Source.** [RIS: GTelG 2012 § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18), [chipkarte.at: e-card system ELGA FAQ 2.9](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)

### GTelG 2012

**In one sentence.** The Gesundheitstelematikgesetz 2012 is the Austrian federal law that governs electronic health data exchange, including ELGA.

**Explained.** It defines who counts as a healthcare provider, what ELGA health data is, the patient's rights (opt-out, blocking, trusted providers), how long access lasts, what each type of provider may see, and what must be logged. The paragraphs most relevant for access are: § 15 (opt-out), § 16 (individual settings and objection for one treatment case), § 18 (identity check and access windows: 90 days for doctors and hospitals, 28 for pharmacies, up to 365 for trusted providers), § 21 (what each provider type may see), § 22 (logging), § 24e and § 24f (the vaccination record). Think of it as the house rules of the national record, written in law.

**Who publishes it.** The Austrian Parliament; the current text is on RIS, the federal legal information system.

**Where it is used.** Austria.

**In my projects.** Passayge: every access rule cites its paragraph (`packages/core/src/sources.ts`, `rules.ts`).

**Source.** [RIS: GTelG 2012, consolidated version](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120)

### Z-PI (the central patient index)

**In one sentence.** The Zentraler Patientenindex is ELGA's central register that links a person's local patient numbers from all ELGA areas to one identity.

**Explained.** Every hospital group has its own patient number for you. The Z-PI keeps the cross-references, so ELGA can find all your records even though each area uses its own number. Areas report their local IDs with an IHE PIX feed (ITI-44), the token service locates a patient's areas with a PIX query (ITI-45), and provider software can search it with PDQ (ITI-47). Think of a phone book that lists all the extension numbers one person has in different offices.

**Who runs it.** The Dachverband der österreichischen Sozialversicherungsträger (§ 18 GTelG 2012).

**Where it is used.** ELGA.

**In my projects.** Passayge: patient search uses PDQm ITI-78 as the FHIR stand-in for PDQ ITI-47 against the Z-PI (`packages/core/src/ihe.ts`).

**Source.** [ELGA overall architecture 2.30a (2017)](https://www.elga.gv.at/fileadmin/user_upload/Dokumente_PDF_MP4/Technisches/ELGA_Gesamtarchitektur_2.30a.pdf), [RIS: GTelG 2012 § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18)

### ELGA areas (ELGA-Bereiche)

**In one sentence.** An ELGA area is one autonomous zone of ELGA, usually a regional hospital group or another large organisation, with its own document registry, repositories, local patient index and audit log.

**Explained.** ELGA is federated: each area is a separate security zone, in IHE terms an "affinity domain". When a provider in one area needs a document from another, the areas talk through gateways using IHE cross-community transactions (XCA: ITI-38 query, ITI-39 retrieve). ELGA's site lists 13 areas, for example Wien, Niederösterreich, Steiermark and AUVA. Think of branches of a library network, each with its own catalogue, linked so you can search them all.

**Who runs it.** Each area's operator; ELGA GmbH coordinates.

**Where it is used.** ELGA.

**In my projects.** Passayge models a single area and names the cross-area transaction in the network log (`packages/core/src/ihe.ts`).

**Source.** [ELGA GmbH: technical overview](https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/)

### e-Befunde

**In one sentence.** e-Befunde are the documents part of ELGA: discharge letters, laboratory reports, imaging reports and other findings.

**Explained.** Hospitals, labs and radiology institutes register their reports in ELGA so that other providers, and the patient, can read them. They are CDA documents that follow ELGA's implementation guides. Under § 21 Abs. 2 GTelG 2012 doctors and hospitals may see them; pharmacies may not. Think of the findings folder a patient used to carry from doctor to doctor, now kept where it was written and found through ELGA.

**Who publishes the format.** ELGA GmbH (implementation guides), published on gesundheit.gv.at.

**Where it is used.** Austria.

**In my projects.** Passayge: the "documents" record type, with five synthetic document types (`packages/core/src/seed.ts`, `LOINC_TYPE` in `cda.ts`).

**Source.** [gesundheit.gv.at: e-Befund](https://www.gesundheit.gv.at/gesundheitsleistungen/elga/e-befund.html), [RIS: GTelG 2012 § 2](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=2)

### e-Medikation

**In one sentence.** e-Medikation is the ELGA function that records prescribed and dispensed medicines, so doctors and pharmacists can see a patient's current medication and check for interactions.

**Explained.** When a doctor prescribes or a pharmacy dispenses, the entry goes to a central, encrypted medication store. Doctors, hospitals and pharmacies may read it within their access window; pharmacies see only medication (§ 21 Abs. 2). The Passayge glossary, citing § 20, says entries are kept for 18 months after dispensing. Think of a shared medicine cabinet list that every prescriber and pharmacist can see.

**Who runs it.** ELGA GmbH with the social insurance.

**Where it is used.** Austria.

**In my projects.** Passayge: the "medication" record type, the only one a pharmacy may open (`ROLE_SCOPE` in `packages/core/src/rules.ts`).

**Source.** [gesundheit.gv.at: e-Medikation](https://www.gesundheit.gv.at/gesundheitsleistungen/elga/e-medikation.html), [RIS: GTelG 2012 § 21](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=21)

### e-Impfpass

**In one sentence.** The e-Impfpass is Austria's electronic vaccination record.

**Explained.** It replaces the paper vaccination booklet. It has its own legal rules: the access window is 28 days for every provider (§ 24f Abs. 2 GTelG 2012), individual blocking does not apply, and there is no opt-out, because § 24e Abs. 5 excludes the GDPR right to object. Its documents are CDA, according to the current implementation guide (version 2.0.2). Think of the yellow vaccination booklet, but one that cannot be left at home and cannot be torn up.

**Who runs it.** ELGA GmbH, on behalf of the health ministry (**not confirmed** in this primer).

**Where it is used.** Austria.

**In my projects.** Passayge: the "vaccinations" record type, 28 days for everyone and unaffected by opt-out (`VACCINATION_DAYS` and `windowDays()` in `packages/core/src/rules.ts`).

**Source.** [RIS: GTelG 2012 § 24f](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=24f), [§ 24e](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=24e), [ILF e-Impfpass 2.0.2 (PDF)](https://www.gesundheit.gv.at/dam/gesundheitgvat/professional/it-services/implementierungsleitfaeden/ILF_e-Impfpass_2.0.2-20260204.pdf)

### HL7 Austria and the AT Core profiles

**In one sentence.** HL7 Austria is the Austrian affiliate of HL7 International, and AT Core is its set of base FHIR profiles for Austria.

**Explained.** International FHIR leaves many things open, such as how an Austrian address or social security number is represented. AT Core fixes these for Austria, so every Austrian FHIR project starts from the same base. The R4 package is `hl7.at.fhir.core.r4`, version 2.0.0 (STU2), on FHIR 4.0.1, with profiles such as AT Core Patient, Practitioner, Organization and Address. HL7 Austria also publishes other guides, such as the Austrian Patient Summary. Think of a national version of an international form, with extra required boxes.

**Who publishes it.** HL7 Austria, Technical Committee FHIR.

**Where it is used.** Austrian FHIR projects. HL7 Austria itself notes that ELGA is still mainly based on CDA.

**Example.** `"meta": { "profile": ["http://hl7.at/fhir/HL7ATCoreProfiles/4.0.1/StructureDefinition/at-core-patient"] }`

**In my projects.** Passayge: every synthetic patient claims and is validated against AT Core Patient 2.0.0 in HAPI (`AT_CORE_PATIENT` in `packages/core/src/fhir.ts`, `apps/gateway/scripts/validate-fhir.ts`).

**Source.** [HL7 Austria](https://www.hl7.at/), [HL7 Austria FHIR Core R4](https://fhir.hl7.at/HL7-AT-FHIR-Core-R4/index.html)

### The Wahlärzte obligation from 2026

**In one sentence.** Since 1 January 2026, private doctors without a social insurance contract (Wahlärztinnen and Wahlärzte) must also use the e-card system and ELGA, under § 49 Abs. 7 of the Ärztegesetz 1998.

**Explained.** Before, mainly contract doctors were connected. The law now requires self-employed doctors to use the e-card, the e-card infrastructure and ELGA "by 1 January 2026 at the latest", provided the technical requirements can be met with proportionate effort, and unless the patient has objected. According to Ärztekammer Wien, this covers reading e-Befunde, reading and writing e-Medikation and the e-Impfpass, and diagnosis coding. Ärztekammer Kärnten states that an exemption threshold of 300 different patients a year applies and that full ICD-10 coding is required from the third quarter of 2026. For software vendors this means many practice systems must now handle ELGA access, including its refusals and expiries. Think of a new building code that suddenly applies to every house, not just the large ones.

**Who publishes it.** The Austrian Parliament (law); medical chambers publish guidance.

**Where it is used.** Austria.

**In my projects.** Context for Passayge: it is a way to understand and test ELGA access behaviour without real data. Passayge does not test anyone's compliance.

**Source.** [RIS: Ärztegesetz 1998 § 49](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011138&Paragraf=49), [Ärztekammer Wien, 17 April 2025 (PDF)](https://www.aekwien.at/documents/d/wien/250417_e-card-system-elga-funktionalitaten-und-ediagnose-ab-1-janner-2026-statusinformation-fur-wahlarztinnen-1), [Ärztekammer Kärnten, 2026 eHealth overview (PDF)](https://www.aekktn.at/documents/d2b3fe3d-6637-11f1-8810-bc2411ec0614/2026_%C3%9Cberblick_eHealth.pdf)

---

## 3. Codes and vocabularies

### LOINC

**In one sentence.** LOINC (Logical Observation Identifiers Names and Codes) is the international catalogue of codes for lab tests, clinical measurements and document types.

**Explained.** Every lab calls its tests slightly differently ("HbA1c", "Glycated haemoglobin", "A1C"). LOINC gives each test one code, so `4548-4` means haemoglobin A1c everywhere, and `8867-4` means heart rate. It also has codes for document types, such as `18842-5` for a discharge summary. Think of barcodes in a supermarket: every shop names the product differently on the shelf, but the barcode is the same.

**Who publishes it.** Regenstrief Institute, USA. Free to use under its licence.

**Where it is used.** Internationally, in HL7 v2, CDA and FHIR. In Austria, ELGA's lab report guide uses LOINC (**not confirmed** in this primer; see the guide on gesundheit.gv.at).

**Example.** `{ "system": "http://loinc.org", "code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood" }`

**In my projects.**
- Passayge: document types and lab values (`LOINC_TYPE` in `packages/core/src/cda.ts`; HbA1c `4548-4` and eGFR `98979-8` in `seed.ts`).
- hl7-fhir-gateway: OBX codes mapped to LOINC (`mapping/OruMapper.java`).
- pulse-fhir-gateway: heart rate `8867-4` (`pulse_fhir/fhir.py`).
- Boensity: bone mineral density and T-score codes (`packages/fhir-client/src/index.ts`).
- wardkit and Wardread: LOINC constants for display (`registry/wardkit/lib/fhir.ts`).

**Source.** [LOINC, Regenstrief Institute](https://loinc.org/)

### SNOMED CT

**In one sentence.** SNOMED CT is the largest clinical terminology in the world, with codes for diagnoses, findings, procedures, body sites, substances and more.

**Explained.** Where LOINC names the question ("what is the HbA1c?"), SNOMED CT often names the answer or the clinical idea ("type 2 diabetes", "left femoral neck", "no known allergy"). Its concepts are linked in a hierarchy, so a computer knows that "femoral neck" is part of the "femur". Think of a giant, carefully organised dictionary of medicine, where every word also says what kind of thing it is and what it belongs to.

**Who publishes it.** SNOMED International. Use requires a licence through a member country or an affiliate licence. Whether Austria is a member: **not confirmed**.

**Where it is used.** Internationally, in electronic records and in FHIR (the International Patient Summary uses it).

**Example.** `716186003` "No known allergy".

**In my projects.**
- wardkit (and Wardread, which reuses it): `AllergyBanner` recognises the SNOMED "no known allergy" codes (`registry/wardkit/components/allergy-banner.tsx`).
- Boensity: body site codes for femoral neck, total hip, lumbar spine and forearm (`SITE_BY_SNOMED` in `apps/web/lib/fhir.ts`).

**Source.** [SNOMED International](https://www.snomed.org/)

### ICD-10

**In one sentence.** ICD-10 is the WHO's International Classification of Diseases, 10th revision: a list of diagnosis codes used for statistics, reporting and billing.

**Explained.** ICD groups diseases into chapters and codes, for example `E11` for type 2 diabetes. It is coarser than SNOMED CT: it is built for counting and paying, not for detailed clinical records. ICD-11 has been in effect at WHO since 2022, but many countries still use ICD-10 or a national edition of it. Think of the categories in a library's subject index, rather than the full text of each book.

**Who publishes it.** World Health Organization; countries publish national editions.

**Where it is used.** Internationally. In Austria, Ärztekammer Kärnten states that private doctors must code diagnoses fully in ICD-10 from the third quarter of 2026; hospital use in Austria is **not confirmed** in this primer.

**In my projects.** None in code.

**Source.** [WHO: International Classification of Diseases](https://www.who.int/standards/classifications/classification-of-diseases), [ICD-10 browser](https://icd.who.int/browse10/2019/en)

### UCUM

**In one sentence.** UCUM (Unified Code for Units of Measure) is a standard way of writing units, such as `mg/dL`, `mmol/L` or `/min`, so computers can read and convert them.

**Explained.** "mcg", "µg" and "ug" all mean microgram; a computer cannot be sure. UCUM defines one machine-readable spelling for each unit and how units combine, so `mL/min/{1.73_m2}` (used for kidney function) is unambiguous. FHIR uses UCUM for quantities. Think of the metric system, but also agreeing on exactly how to type each unit.

**Who publishes it.** Regenstrief Institute (UCUM Organization).

**Where it is used.** Internationally, in FHIR, CDA and HL7 v2.

**Example.** `{ "value": 54, "unit": "mL/min/1.73 m2", "system": "http://unitsofmeasure.org", "code": "mL/min/{1.73_m2}" }`

**In my projects.** pulse-fhir-gateway (`/min` in `pulse_fhir/fhir.py`), hl7-fhir-gateway (`mapping/OruMapper.java`), wardkit and Wardread (`registry/wardkit/lib/fhir.ts`), Passayge (`mL/min/{1.73_m2}` in `packages/core/src/seed.ts`, shown as readable text by `UNIT_TEXT` in `apps/web/src/lib/cda.ts`).

**Source.** [UCUM](https://ucum.org/)

### ATC

**In one sentence.** The Anatomical Therapeutic Chemical classification sorts medicines into groups by the organ they act on, what they do and their chemical substance.

**Explained.** Each active substance gets a code with five levels. For example `A10BA02` is metformin: A (alimentary tract and metabolism), A10 (drugs used in diabetes), A10B (blood glucose lowering drugs, excluding insulins), A10BA (biguanides), A10BA02 (metformin). It is used for drug statistics and to group similar medicines. Think of a library's shelf numbering, from the floor down to the exact book.

**Who publishes it.** WHO Collaborating Centre for Drug Statistics Methodology, Oslo.

**Where it is used.** Internationally, for drug utilisation statistics and in medication records.

**In my projects.** Chemsisy: each drug carries its ATC code, shown in search and comparisons (`content/drugs.yaml`, `scripts/build-data.ts`, `src/pages/ComparePage.tsx`).

**Source.** [WHO: ATC classification](https://www.who.int/tools/atc-ddd-toolkit/atc-classification), [WHOCC ATC/DDD index](https://atcddd.fhi.no/atc_ddd_index/)

---

## 4. Imaging

### DICOM

**In one sentence.** DICOM (Digital Imaging and Communications in Medicine) is the standard file format and network protocol for medical images such as X-rays, CT, MRI and ultrasound.

**Explained.** A DICOM file holds the image pixels plus a header of tagged attributes: patient name, study date, device, how to display the pixels (window centre and width) and much more. Each attribute has a numbered tag, such as `(0010,0010)` for the patient's name. DICOM also defines how imaging devices send images to archives and how viewers query them. Think of a photograph with a very detailed label stuck to the back, in a format every hospital camera and viewer understands.

**Who publishes it.** NEMA / MITA (Medical Imaging and Technology Alliance), through the DICOM Standards Committee.

**Where it is used.** Every radiology department, internationally and in Austria.

**In my projects.** second-read reads DICOM uploads with pydicom, applies window centre and width, handles `MONOCHROME1` inversion, and keeps only whitelisted attributes (`review/services/ingest.py`: `_read_dicom`, `_window_to_uint8`, `KEEP_DICOM`).

**Source.** [DICOM Standard](https://www.dicomstandard.org/)

### PACS

**In one sentence.** A PACS (Picture Archiving and Communication System) is the hospital system that stores medical images and delivers them to viewers.

**Explained.** Imaging devices send their DICOM images to the PACS; radiologists and clinicians open them from there. It is the image archive and distribution system of a hospital. Think of a hospital's photo library with a search desk.

**Who publishes it.** Not a standard; a product category built on DICOM.

**Where it is used.** Every hospital with radiology.

**In my projects.** None. second-read takes uploaded files and does not connect to a PACS.

**Source.** [DICOM Standard](https://www.dicomstandard.org/) (PACS is the archive role DICOM's storage and query services are designed for; there is no separate standard)

### De-identification

**In one sentence.** De-identification is removing or replacing information that could identify a person, such as names, birth dates or ID numbers, before data is shared or reused.

**Explained.** A DICOM header can contain the patient's name, birth date, hospital number and the doctor's name. Before images are used for research or teaching, these must be removed or replaced. DICOM's Part 15, Annex E, defines confidentiality profiles that list which attributes to remove or change. Removing data from the header is not enough if information is written into the image itself (see burned-in annotations). Think of blacking out names on a photocopy before you hand it round.

**Who publishes it.** NEMA / MITA (DICOM PS3.15 Annex E). GDPR sets the legal frame in the EU.

**Where it is used.** Research, teaching and machine-learning training sets, internationally and in Austria.

**In my projects.** second-read keeps only a whitelist of attributes (`_whitelisted_metadata` in `review/services/ingest.py`) and stores a PNG rather than the original file.

**Source.** [DICOM PS3.15 Annex E: attribute confidentiality profiles](https://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_E.html)

### Burned-in annotations

**In one sentence.** A burned-in annotation is text, such as a patient's name or a measurement, that is drawn into the image pixels themselves rather than stored in the header.

**Explained.** Some devices, especially ultrasound machines and older systems, write patient details directly into the picture. Header cleaning cannot remove them, because they are part of the image. DICOM has an attribute, Burned In Annotation `(0028,0301)`, that says whether the image contains such text. Safe pipelines check it and reject or mask those images. Think of a name written in ink on the photo itself rather than on the back.

**Who publishes it.** NEMA / MITA (DICOM PS3.3, General Image module).

**Where it is used.** De-identification pipelines everywhere.

**In my projects.** second-read rejects any upload with Burned In Annotation set to `YES` (`_read_dicom` in `review/services/ingest.py`, tested in `review/tests/test_ingest.py`).

**Source.** [DICOM PS3.3 C.7.6, General Image module](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.html)

---

## 5. Clinical scores and measures

### NEWS2

**In one sentence.** NEWS2 (National Early Warning Score 2) is a bedside score that turns six vital signs into points to spot patients who are getting worse.

**Explained.** Nurses measure respiration rate, oxygen saturation (with a separate scale for patients with chronic lung disease), whether the patient is on oxygen, systolic blood pressure, pulse, level of consciousness and temperature. Each gets 0 to 3 points; the total, plus any single parameter scoring 3, decides how urgently a doctor must respond. A total of 5 or more calls for an urgent review, 7 or more for an emergency response. Think of a smoke detector with stages: a small reading means look again soon, a high reading means act now.

**Who publishes it.** Royal College of Physicians, London (2017).

**Where it is used.** Across the NHS in England and in other countries. In Austria: **not confirmed**.

**In my projects.** wardkit scores NEWS2 from FHIR vital-sign Observations and shows the response band (`registry/wardkit/lib/news2.ts`: `news2FromObservations`, `spo2Scale2Points`; `News2Panel`). Wardread includes NEWS2 fixtures only.

**Source.** [Royal College of Physicians: NEWS2](https://www.rcp.ac.uk/improving-care/resources/national-early-warning-score-news-2/)

### FRAX

**In one sentence.** FRAX is a tool that estimates a person's 10-year probability of a major osteoporotic fracture and of a hip fracture.

**Explained.** It combines age, sex, weight, height, previous fracture, parental hip fracture, smoking, steroid use, rheumatoid arthritis, secondary osteoporosis, alcohol and, optionally, the bone density of the femoral neck. Each country has its own model, calibrated to local fracture and death rates. Doctors use the result to decide whether to treat. Think of a weather forecast for bones: not certain, but a probability you can act on.

**Who publishes it.** University of Sheffield (Centre for Metabolic Bone Diseases). Whether an Austrian model exists: **not confirmed** in this primer.

**Where it is used.** Internationally, in osteoporosis guidelines.

**In my projects.** Boensity has an independent FRAX-style calculation, stated in its own code as not the certified FRAX tool (`services/timeline/app/engine/frax_calculator.py`: `calculate_frax`, `meets_intervention_threshold`; `docs/frax-methodology.md`).

**Source.** [FRAX, University of Sheffield](https://frax.shef.ac.uk/FRAX/)

### DEXA and T-scores

**In one sentence.** DEXA (dual-energy X-ray absorptiometry) measures bone mineral density, and the T-score compares that density with a healthy young adult's.

**Explained.** A DEXA scan uses two low-dose X-ray beams to measure bone mineral density (BMD) at the hip, the spine or the forearm. The T-score says how many standard deviations the result is from the young adult average. Under the WHO definition, a T-score of minus 2.5 or lower means osteoporosis, between minus 1 and minus 2.5 means low bone mass (osteopenia). Different scanner makers (GE Lunar, Hologic) report slightly different numbers, so values must be standardised before comparing over time. Think of a growth chart for adults, measured in "how far below normal".

**Who publishes it.** The T-score thresholds come from a WHO study group report (1994).

**Where it is used.** Internationally, for diagnosing osteoporosis.

**In my projects.** Boensity reads DEXA PDF reports from GE Lunar and Hologic, standardises BMD across manufacturers, derives T-scores, classifies bands and detects threshold crossings over time (`services/ingest/app/engine/schema_mapper.py`: `standardize_bmd`, `t_score_from_sbmd`; `services/timeline/app/engine/trajectory_model.py`, `threshold_engine.py`).

**Source.** [WHO Technical Report Series 843 (1994)](https://iris.who.int/handle/10665/39142)

### HbA1c

**In one sentence.** HbA1c (glycated haemoglobin) is a blood test that shows a person's average blood sugar over the previous two to three months.

**Explained.** Sugar in the blood sticks to haemoglobin in red blood cells, which live for about three months. The share of haemoglobin with sugar attached therefore reflects the long-term average. WHO recommends an HbA1c of 48 mmol/mol (6.5 %) as the cut-off for diagnosing diabetes. It is reported in mmol/mol (IFCC) or in % (NGSP). Think of a rain gauge that shows how much fell over months, not today's weather.

**Who publishes it.** The diagnostic cut-off: World Health Organization (2011).

**Where it is used.** Internationally, for diagnosing and monitoring diabetes.

**Example.** LOINC `4548-4`, value `7.8 %`, above the reference range.

**In my projects.** Passayge: Theresia's synthetic lab report includes HbA1c 7.8 % flagged high (`packages/core/src/seed.ts`).

**Source.** [WHO: Use of glycated haemoglobin (HbA1c) in the diagnosis of diabetes mellitus (2011)](https://iris.who.int/handle/10665/70523)

### eGFR

**In one sentence.** eGFR (estimated glomerular filtration rate) is an estimate of how well the kidneys filter blood, calculated from a creatinine blood test, age and sex.

**Explained.** Measuring kidney filtration directly is complicated, so labs estimate it from creatinine, a waste product, with a formula such as CKD-EPI. The result is in mL/min per 1.73 m² of body surface. Under the KDIGO guideline, an eGFR below 60 for more than three months indicates chronic kidney disease. It matters for medication doses, since many drugs leave the body through the kidneys. Think of estimating how fast a sink drains by how much water is left after a minute.

**Who publishes it.** KDIGO (Kidney Disease: Improving Global Outcomes) guidelines.

**Where it is used.** Internationally, on almost every lab panel.

**Example.** LOINC `98979-8` (CKD-EPI 2021), value `54 mL/min/{1.73_m2}`, below 60.

**In my projects.** Passayge: Theresia's lab report includes eGFR 54 flagged low (`packages/core/src/seed.ts`).

**Source.** [KDIGO: CKD evaluation and management guideline](https://kdigo.org/guidelines/ckd-evaluation-and-management/)

---

## 6. Regulation and quality

### EU MDR

**In one sentence.** The EU Medical Device Regulation (Regulation (EU) 2017/745) sets the rules a medical device, including software, must meet before it can be sold in the EU.

**Explained.** It defines what a medical device is, sorts devices into risk classes (I, IIa, IIb, III), and requires a quality system, clinical evaluation, technical documentation and, above class I, a review by a notified body. It has applied since 26 May 2021. Software that informs diagnosis or treatment is usually class IIa or higher under its Rule 11. Think of the safety inspection a car must pass before it may be sold.

**Who publishes it.** The European Parliament and Council.

**Where it is used.** EU, including Austria (where the BASG is the competent authority: **not confirmed** in this primer).

**In my projects.** None are medical devices or claim conformity. pulse-fhir-gateway and medtrace show practices the regulation expects (requirements, risks, traceability).

**Source.** [EUR-Lex: Regulation (EU) 2017/745](https://eur-lex.europa.eu/eli/reg/2017/745/oj)

### SaMD (software as a medical device)

**In one sentence.** SaMD is software that is itself a medical device: it has a medical purpose and works without being part of a hardware device.

**Explained.** An app that calculates a medication dose or flags a suspicious image is SaMD; a hospital's billing system is not. The concept comes from the International Medical Device Regulators Forum (IMDRF). In the EU, guidance MDCG 2019-11 explains when software qualifies as a device and how it is classified. Think of the difference between a calculator and a calculator that tells you how much insulin to inject.

**Who publishes it.** IMDRF (definition); in the EU, the Medical Device Coordination Group (guidance).

**Where it is used.** Internationally.

**In my projects.** None are SaMD. NEWS2 scoring in wardkit and the FRAX-style calculation in Boensity are the kind of feature that could be, if used for real clinical decisions.

**Source.** [IMDRF: SaMD key definitions](https://www.imdrf.org/documents/software-medical-device-samd-key-definitions) (the site did not respond to my check on 23 October 2026), [European Commission: MDCG guidance documents](https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en)

### ISO 13485

**In one sentence.** ISO 13485 is the international standard for quality management systems of medical device manufacturers.

**Explained.** It requires a manufacturer to have documented, controlled processes for design, production, suppliers, complaints and corrective action, with records that prove they were followed. The current edition is ISO 13485:2016. Under the EU MDR it is the usual way to show the quality system the regulation requires. Think of a restaurant's kitchen rules and logbooks that an inspector can check.

**Who publishes it.** ISO (International Organization for Standardization).

**Where it is used.** Internationally, by device manufacturers.

**In my projects.** medtrace cites clause 4.1.6 in its README only.

**Source.** [ISO 13485:2016](https://www.iso.org/standard/59752.html)

### IEC 62304

**In one sentence.** IEC 62304 is the international standard for the software development life cycle of medical device software.

**Explained.** It says which activities a manufacturer must do, and document, when developing device software: planning, requirements, architecture, detailed design, unit verification, integration, system testing, release, maintenance, risk management and problem resolution. How much is required depends on the software safety class: A (no injury possible), B (non-serious injury) or C (death or serious injury). The current edition is IEC 62304:2006 with Amendment 1 (2015). Think of building regulations for software: the more dangerous the building, the more inspections.

**Who publishes it.** IEC (International Electrotechnical Commission), also listed by ISO.

**Where it is used.** Internationally; harmonised under the EU device regulations (**not confirmed** for the MDR in this primer).

**In my projects.** medtrace's README relates its checks to IEC 62304 traceability (README only). pulse-fhir-gateway's requirements and tests follow the same pattern but do not name the standard.

**Source.** [IEC 62304:2006 (ISO listing)](https://www.iso.org/standard/38421.html)

### ISO 14971

**In one sentence.** ISO 14971 is the international standard for risk management of medical devices.

**Explained.** For each hazard (a possible source of harm) you describe how it could lead to a hazardous situation and then to harm, estimate severity and probability, add controls to reduce the risk, verify that the controls work, and judge whether the remaining (residual) risk is acceptable. The current edition is ISO 14971:2019. Think of a structured "what could go wrong, how bad, how likely, what do we do about it, and did it work" list that must be kept up to date.

**Who publishes it.** ISO.

**Where it is used.** Internationally, required in practice by the EU MDR.

**In my projects.**
- pulse-fhir-gateway: `docs/risks.yml` lists hazards with situation, harm, severity, probability, controls and residual risk.
- medtrace: checks that every risk has a verified control and acceptable residual risk (`medtrace/model.py` `Risk`, rules TR007 to TR010 in `medtrace/check.py`), though it does not name the standard.

**Source.** [ISO 14971:2019](https://www.iso.org/standard/72704.html)

### Traceability

**In one sentence.** Traceability is being able to follow each requirement to the code that implements it and the test that verifies it, and each risk to its control.

**Explained.** In regulated software, an auditor asks "show me where requirement 12 is built and how you know it works". A traceability matrix answers that, in both directions. Missing links mean either untested features or unexplained code. Think of a parcel tracking number that lets you follow every step from order to delivery.

**Who publishes it.** Required by IEC 62304 and ISO 13485; not a standard of its own.

**Where it is used.** Medical devices, aviation, automotive.

**In my projects.**
- medtrace: scans `@implements` and `@verifies` tags, reads test results from JUnit XML, fails the build on gaps and writes a Markdown matrix (`medtrace/scan.py`, `check.py`, `report.py`, `action.yml`).
- pulse-fhir-gateway: requirements in `docs/requirements.yml`, tags in code and tests, and a CI job that runs medtrace.

**Source.** [IEC 62304:2006 (ISO listing)](https://www.iso.org/standard/38421.html), [ISO 13485:2016](https://www.iso.org/standard/59752.html)

### GDPR for health data

**In one sentence.** Under the EU General Data Protection Regulation, health data is a "special category" of personal data that may only be processed under strict conditions.

**Explained.** Article 9 forbids processing health data unless one of its exceptions applies, for example explicit consent, provision of health care, public health or scientific research with safeguards. Principles such as data minimisation, purpose limitation and security apply to all personal data. Member states can add rules; in Austria, GTelG 2012 is one example, and its § 24e Abs. 5 excludes the right to object for the e-Impfpass. Think of a locked filing cabinet with a short list of reasons for which it may be opened.

**Who publishes it.** The European Parliament and Council (Regulation (EU) 2016/679).

**Where it is used.** EU, including Austria.

**In my projects.** None name GDPR in code. Practices that follow its principles: synthetic data only in Passayge, de-identification in second-read, no data collection and no network in Wardread, and personal-data checks in Passayge and Chemsisy CI.

**Source.** [EUR-Lex: Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [RIS: GTelG 2012 § 24e](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=24e)

---

## 7. Engineering patterns

These are general software practices rather than standards. Where no standards body defines one, the source is the closest authoritative description.

### Idempotency

**In one sentence.** An operation is idempotent if doing it twice has the same effect as doing it once.

**Explained.** Networks fail: a sender often cannot tell whether its message arrived, so it sends it again. If the receiver treats the second copy as new, a lab result is stored twice or a patient is admitted twice. Idempotent design makes repeats harmless, for example by remembering each message's unique ID, or by using "create if it does not exist" and "update by identifier" instead of plain "create". Think of a lift button: pressing it five times still calls one lift.

**Who publishes it.** HTTP defines which methods are idempotent (RFC 9110).

**In my projects.**
- hl7-fhir-gateway: a unique constraint on sender plus `MSH-10` (the message control ID) makes a repeated message a duplicate, not a new record (`ingest/InboundMessage.java`, `IngestService.java`); FHIR writes use conditional PUT and `ifNoneExist` (`mapping/TransactionBuilder.java`).
- pulse-fhir-gateway: a deterministic UUIDv5 identifier per Observation plus conditional create (`observation_uri` in `pulse_fhir/fhir.py`), tested by replaying twice.
- Passayge: seeding uses PUT with fixed IDs, so seeding twice changes nothing (`seed-fhir.ts`).
- second-read: a unique study plus file hash blocks duplicate uploads (`review/models.py`).

**Source.** [RFC 9110, section 9.2.2: idempotent methods](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2)

### The outbox pattern

**In one sentence.** The outbox pattern stores an outgoing message in the same database transaction as the change that caused it, and a separate worker sends it later.

**Explained.** If a service saves a record and then calls another system, a crash between the two leaves them inconsistent. With an outbox, the record and an "outbox" row describing the message to send are saved together, so either both exist or neither does. A background worker reads the outbox and delivers each message, retrying on failure. Think of a post tray on your desk: you put the letter in the tray when you finish the work, and the post round collects it, even if you go home.

**Who publishes it.** No standards body; a widely documented pattern.

**In my projects.**
- hl7-fhir-gateway: `outbox/OutboxEntry.java`, `OutboxRepository.java`, `DeliveryWorker.java` (strict first-in first-out, stops at the head on a retryable error), `BackoffPolicy.java` (exponential back-off).
- pulse-fhir-gateway: a SQLite outbox (`Outbox` in `pulse_fhir/delivery.py`).

**Source.** [microservices.io: transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)

### Dead-letter queue

**In one sentence.** A dead-letter queue is where messages go that cannot be delivered even after retrying, so they can be inspected and fixed instead of blocking everything or being lost.

**Explained.** Some failures are temporary (the server is down) and retrying helps; others are permanent (the message is invalid) and retrying forever would block the queue. Permanent failures are moved aside to the dead-letter queue, with the error, for a person to look at and resend. Think of the post office's undeliverable mail department.

**Who publishes it.** No standards body; a common messaging pattern.

**In my projects.**
- hl7-fhir-gateway: status `DEAD` in `outbox/OutboxStatus.java`, set by `DeliveryWorker.java` for non-retryable failures, with list and retry endpoints in `api/OutboxController.java`.
- pulse-fhir-gateway: a `dead_letter` table in `pulse_fhir/delivery.py`.

**Source.** No official standard; the hl7-fhir-gateway README and code describe the implementation.

### Audit trail and hash chaining

**In one sentence.** An audit trail is a record of who did what and when; hash chaining links each entry to the previous one with a cryptographic hash, so any later change is detectable.

**Explained.** Each entry stores a hash (a short fingerprint computed with an algorithm such as SHA-256) of its own content together with the previous entry's hash. If anyone edits or deletes an old entry, all the following hashes stop matching, and a verification run finds the break. Healthcare needs audit trails by law, for example § 22 GTelG 2012 for ELGA. Think of a bound notebook with numbered pages, where each page also repeats a fingerprint of the page before.

**Who publishes it.** Audit content: IHE ATNA and BALP for health IT, national law for ELGA. Hash chaining itself is a general technique without one owning standard.

**In my projects.**
- second-read: an append-only `AuditEvent` model with `prev_hash` and `hash` (SHA-256), where save, delete and bulk update raise errors, and `verify_chain()` checks the chain (`review/models.py`, `review/services/audit.py`). This is a Django model, not the FHIR resource.
- Passayge: one FHIR AuditEvent per access with the § 22 fields, no hash chain (`packages/core/src/audit.ts`).

**Source.** [IHE ATNA](https://profiles.ihe.net/ITI/TF/Volume1/ch-9.html), [RIS: GTelG 2012 § 22](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=22)

### Four-eyes review

**In one sentence.** The four-eyes principle means that an important result needs a second, independent person to check it, and nobody may approve their own work.

**Explained.** In medical image annotation, one person marks findings and another reviews them. Independence matters: if the reviewer sees the first person's marks before forming a view, the second reading is no longer independent. Systems enforce this by blocking self-review and by controlling who sees what, and when. Think of a bank transfer that needs two signatures.

**Who publishes it.** No single standard; a common control in regulated work.

**In my projects.** second-read: nobody reviews their own reading (`decide` in `review/services/workflow.py`), and annotators only see their own tasks so readings stay independent (`visible_tasks` in `review/api.py`), tested in `test_workflow.py`.

**Source.** No official standard; second-read's code and tests are the reference.

### Access windows

**In one sentence.** An access window is a time-limited permission: access is granted from a starting event for a fixed period, then ends automatically.

**Explained.** Instead of permanent rights, the system grants access for a period after something happens, such as a patient's visit. When the period ends, access stops without anyone having to revoke it. The hard part is the boundary: what exactly happens at the last instant, and which clock counts. In ELGA the window starts with the contact confirmation and lasts 90, 28 or up to 365 days depending on provider and record type (§ 18 GTelG 2012). Think of a parking ticket valid for two hours from the moment you buy it.

**Who publishes it.** For ELGA, the law (GTelG 2012).

**In my projects.** Passayge: `decide()` and `windowDays()` in `packages/core/src/rules.ts`; access ends exactly N x 24 hours after the contact and is refused at that instant, tested one millisecond before and at the end.

**Source.** [RIS: GTelG 2012 § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18)

---

## 8. How it all fits together

One fictional patient's journey, from a hospital admission to a clinician's screen, with each standard named where it is used and the project that covers each step.

**Theresia Brandstätter is admitted for gallbladder surgery.**

1. **Admission (HL7 v2 over MLLP).** The hospital's admission system sends an `ADT^A01` message: `MSH` header, `PID` with her hospital number, `PV1` with the ward and visit number, framed by MLLP over TCP. The receiver replies with an `ACK` (`MSA|AA`).
   *Covered by:* **hl7-fhir-gateway** (receives MLLP and HTTP, stores each message once by `MSH-10`, replies AA, AE or AR). **Wardread** makes the raw message readable for an integration engineer.

2. **Lab results (HL7 v2 ORU with LOINC and UCUM).** The lab sends `ORU^R01` messages, one `OBX` per value, coded with LOINC and units in UCUM.
   *Covered by:* **hl7-fhir-gateway** (`OruMapper`, one Observation per OBX; corrections replace the original).

3. **Into FHIR (FHIR R4 resources, transaction Bundle, REST, idempotency, outbox).** The gateway maps `PID` to `Patient`, `PV1` to `Encounter` and each `OBX` to `Observation`, and sends them as a FHIR transaction Bundle with conditional updates, so a repeated message changes nothing. If the FHIR server is down, the Bundle waits in an outbox and is retried; permanent failures go to a dead-letter queue.
   *Covered by:* **hl7-fhir-gateway** (into HAPI FHIR). The same pattern from a bedside device: **pulse-fhir-gateway** turns a pulse monitor's stream into heart-rate Observations, with **medtrace** checking requirement and risk traceability in CI.

4. **Austrian profile (HL7 Austria AT Core).** Before exchanging records nationally, resources must meet Austrian rules, for example AT Core Patient.
   *Covered by:* **Passayge** (validates every patient against AT Core 2.0.0 in HAPI).

5. **The discharge letter goes into ELGA (CDA, IHE XDS.b; FHIR equivalent MHD).** At discharge the hospital writes a CDA discharge letter and registers it in its ELGA area's registry (in ELGA, ITI-41; in IHE's FHIR version, MHD ITI-65).
   *Covered by:* **Passayge** (CDA-like documents, registered with MHD ITI-65 when the sandbox is seeded).

6. **Two weeks later, her GP inserts the e-card (e-card, contact confirmation, GTelG 2012).** The contact confirmation opens a 90-day access window for documents and medication and 28 days for the vaccination record.
   *Covered by:* **Passayge** (contact confirmation, windows, opt-out, blocking, trusted providers, each citing its paragraph).

7. **The GP finds and opens the letter (PDQ via the Z-PI and MHD; ATNA audit).** The practice software finds Theresia (in ELGA, PDQ ITI-47 against the Z-PI; in FHIR, PDQm ITI-78), lists her documents (ITI-18; FHIR ITI-67) and opens one (ITI-43; FHIR ITI-68). Each access writes an audit record (ATNA ITI-20) with the fields § 22 requires, which Theresia can read later.
   *Covered by:* **Passayge** (all of these, as FHIR, each shown next to its ELGA transaction).

8. **On the clinician's screen (FHIR, LOINC, SNOMED CT, NEWS2).** The results appear in clinical components: a patient banner, an allergy banner that recognises the SNOMED CT "no known allergy" code, lab values with reference ranges and flags, and vital-sign trends with a NEWS2 score if she is back on a ward.
   *Covered by:* **wardkit** (React components taking FHIR resources); **Passayge** uses wardkit's lab result component in its document reader. A smart app that pulls bone density Observations from an EHR with **SMART on FHIR** is shown by **Boensity**.

Around the journey:

- **Images (DICOM, de-identification, burned-in annotations, four-eyes, hash-chained audit).** If her surgery involved imaging used later for teaching or research, it would be de-identified and reviewed by two independent readers: **second-read**.
- **Medicines (ATC).** Her metformin is ATC `A10BA02`; **Chemsisy** teaches what that molecule is and how it compares to others.
- **Evidence (question answering over PubMed).** Whether a system can answer clinical questions from the literature reliably, and when it should say "insufficient evidence": **medrag-eval**.
- **Regulation (EU MDR, IEC 62304, ISO 14971, ISO 13485, GDPR).** If any of this informed clinical decisions directly, it would be regulated software; **pulse-fhir-gateway** and **medtrace** show the requirements, risk and traceability practices that would be expected.

| Step | Standards | Project |
|---|---|---|
| Admission, results | HL7 v2 (ADT, ORU, ACK), MLLP, LOINC, UCUM | hl7-fhir-gateway, Wardread |
| Into FHIR | FHIR R4, Bundle, REST, idempotency, outbox, dead letter | hl7-fhir-gateway, pulse-fhir-gateway, medtrace |
| National profile | HL7 Austria AT Core | Passayge |
| Document sharing | CDA, IHE XDS.b / MHD | Passayge |
| Access | e-card, contact confirmation, GTelG 2012, access windows | Passayge |
| Find, open, log | PDQ / PDQm, Z-PI, ATNA / AuditEvent | Passayge |
| Screen | FHIR, LOINC, SNOMED CT, NEWS2, SMART on FHIR | wardkit, Boensity |
| Images | DICOM, de-identification, four-eyes, hash chain | second-read |
| Medicines, evidence | ATC; retrieval evaluation | Chemsisy, medrag-eval |
| Regulation | EU MDR, IEC 62304, ISO 14971, traceability | pulse-fhir-gateway, medtrace |
