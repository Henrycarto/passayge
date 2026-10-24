# Passayge: Phase 1 research

Status: research only, no code. Compiled 23 October 2026.
Every claim links to a primary or official source. Claims without one are marked **unverified** and are not built on.

Legend: **verified** (primary source read), **dated** (primary source, but older than the current law and possibly superseded), **unverified** (no primary source found).

---

## 1. How ELGA works today

### 1.1 Document format

- ELGA documents are HL7 CDA R2. HL7 Austria states: "Currently, the Austrian EHR system (ELGA) is mainly based on HL7 CDA." **Verified.** [HL7 Austria FHIR Core IG](https://fhir.hl7.at/HL7-AT-FHIR-Core-R4/index.html)
- The implementation guides (Implementierungsleitfäden) are published on gesundheit.gv.at. Their use is binding under § 16 of the ELGA regulation 2015 (ELGA-VO 2015); main versions are mandatory. **Verified.** [gesundheit.gv.at: Implementierungsleitfäden](https://www.gesundheit.gv.at/professional/it-services/implementierungsleitfaeden)

| Guide | Current version listed | Mandatory main version |
|---|---|---|
| General CDA guide (Allgemeiner Implementierungsleitfaden) | 3.3.0+20260122 | 3 |
| Discharge letter, physician (Entlassungsbrief Ärztlich) | 2.06.5 | 2.06 |
| Discharge letter, nursing (Entlassungsbrief Pflege) | 2.06.3 | 2.06 |
| Laboratory and microbiology report (Laborbefund) | 3.0.0+20211214 | 3.0.0 |
| Diagnostic imaging report (Befund bildgebende Diagnostik) | 3.0.3+20260929 | |
| e-Medication (e-Medikation) | 2.06.6 | 2.06 |
| e-Vaccination record (e-Impfpass) | 2.0.2+20260204 | 2.0.0 |
| Outpatient report (Ambulanzbefund) | 1.3.1+20220603 | optional |
| Telemonitoring episode report | 1.2.1+20211001 | optional |
| XDS metadata (XDS-Metadaten) | 3.0.2+20240715 | |

- The categories of ELGA health data are defined in § 2 Z 9 GTelG 2012: lit. a medical documents (discharge letters, lab reports, imaging reports, other reports), lit. b medication data, lit. c advance directives, lit. d powers of attorney, lit. e register data, lit. g reports of the 1450 health line. **Verified.** [RIS: GTelG 2012 § 2](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=2)

### 1.2 Where FHIR is used or planned

- **The e-vaccination record is CDA, not FHIR.** The current guide is titled "HL7 Implementation Guide for CDA R2: e-Impfpass", version 2.0.2+20260204, status normative; the text contains no mention of FHIR. **Verified.** [ILF e-Impfpass 2.0.2 (PDF)](https://www.gesundheit.gv.at/dam/gesundheitgvat/professional/it-services/implementierungsleitfaeden/ILF_e-Impfpass_2.0.2-20260204.pdf). The brief's example ("FHIR, for example eImpfpass") is therefore not supported by the sources.
- FHIR work published on the HL7 Austria FHIR site [fhir.hl7.at](https://fhir.hl7.at/) and [other IGs](https://fhir.hl7.at/index_other.html):
  - HL7 Austria FHIR Core (R4 and R5), published, see section 4.
  - Austrian Patient Summary (ELGA-AustrianPatientSummary-R4), 1.1.0-STU2, published as an HL7 Austria member IG.
  - ELGA e-Medikation R4 (0.1.0) and a draft "future e-Medication guide v3" on R5 (0.0.0); ELGA e-Diagnose R4 (0.1.0, ballot 2026-03); integrated-care IGs for heart failure and diabetes. These are drafts.
- **Unverified:** any official ELGA GmbH roadmap stating that MHD, PDQm or PIXm will be offered on the national infrastructure. I found none. Passayge must present its FHIR layer as "how this could look with IHE FHIR profiles", not as what ELGA runs.

### 1.3 Exchange architecture

Primary source: [ELGA-Gesamtarchitektur 2.30a (PDF, ELGA GmbH, approved 9 March 2017)](https://www.elga.gv.at/fileadmin/user_upload/Dokumente_PDF_MP4/Technisches/ELGA_Gesamtarchitektur_2.30a.pdf). It is the most recent public architecture document I found. **Dated**: the component model is still described the same way on [elga.gv.at: Technischer Aufbau](https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/), but details may have changed.

- **ELGA areas (ELGA-Bereiche) = affinity domains.** Each area is an "autonomous security zone" with its own XDS.b registry (Verweisregister), repositories, local patient index (L-PI) and local audit record repository (L-ARR). elga.gv.at lists 13 areas (e.g. Wien, Niederösterreich, Steiermark, AUVA, A1 Telekom). Areas talk to each other through XCA gateways. [elga.gv.at](https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/)
- **Central patient index (Zentraler Patientenindex, Z-PI)**, run by the Dachverband (§ 18 GTelG 2012). Each area reports its local patient ID (L-PID) to the Z-PI with Patient Identity Feed HL7v3 [ITI-44]. The token service locates the areas holding a patient's records with PIXv3 Query [ITI-45]. Provider software can search the Z-PI with PDQv3 [ITI-47]. (Gesamtarchitektur, lines 408 to 410, 836 to 837, 2474 to 2482)
- **Healthcare provider index (GDA-Index, GDA-I)**: directory of ELGA providers and their roles.
- **ELGA token service (ELGA-Token-Service, ETS)**: issues SAML 2 assertions over WS-Trust. A provider logs in and gets an ELGA HCP assertion; for a patient it gets a treatment assertion that carries the applicable policies, sent in the SOAP header with Provide X-User Assertion [ITI-40]. (p. 20 and section 3)
- **Policy Administration Point (PAP)**: stores the general XACML policies and each patient's individual policies (opt-out, blocked providers, extended access).
- **Access control facade (Zugriffssteuerungsfassade, ZGF)**: part of each area's connection gateway; authorises every request against the assertion.
- **Contact confirmation service (Kontaktbestätigungsservice, KBS)**: central store of treatment contacts, see section 2.
- **Logging**: every gateway writes Record Audit Event [ITI-20] (ATNA) to its L-ARR, extended with ELGA fields such as the name of the person accessing. An aggregated audit record repository (A-ARR) collects them for the patient portal. (p. 20, lines 493 to 501)
- **e-Medication** is the one central store (encrypted), not decentral. [elga.gv.at](https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/)

Transactions in the standard query and retrieve flow (Gesamtarchitektur, Abbildung 9, p. 20):

| Step | IHE transaction |
|---|---|
| Find the patient | PDQv3 [ITI-47] (or local PDQ [ITI-21] in an area) |
| Locate areas with records | PIXv3 Query [ITI-45] (done by the ETS) |
| Get authorisation | WS-Trust RST to ETS, assertion carried by XUA [ITI-40] |
| Query documents | Registry Stored Query [ITI-18], across areas Cross Gateway Query [ITI-38] |
| Retrieve a document | Retrieve Document Set [ITI-43], across areas Cross Gateway Retrieve [ITI-39] |
| Store a document | Provide and Register Document Set-b [ITI-41], Register [ITI-42] |
| Log | Record Audit Event [ITI-20] |

### 1.4 Mapping IHE FHIR profiles to ELGA transactions

The mappings below are IHE's own correspondences, not something ELGA operates. **Verified** against the IHE profiles.

| ELGA transaction (SOAP/HL7v3) | IHE FHIR equivalent | Source |
|---|---|---|
| PDQ [ITI-21] / PDQv3 [ITI-47] | PDQm Mobile Patient Demographics Query [ITI-78] (and $match [ITI-119]) | [PDQm 3.2.0](https://profiles.ihe.net/ITI/PDQm/volume-1.html) |
| PIX Query [ITI-9] / PIXv3 Query [ITI-45] | PIXm Mobile Patient Identifier Cross-reference Query [ITI-83] | [PIXm 3.1.0](https://profiles.ihe.net/ITI/PIXm/volume-1.html) |
| Patient Identity Feed [ITI-8] / [ITI-44] | PIXm Patient Identity Feed FHIR [ITI-104] | [PIXm 3.1.0](https://profiles.ihe.net/ITI/PIXm/volume-1.html) |
| Registry Stored Query [ITI-18] | MHD Find Document References [ITI-67], Find Document Lists [ITI-66] | [MHD 4.2.5, cross-profile](https://profiles.ihe.net/ITI/MHD/1336_cross_profile_considerations.html) |
| Retrieve Document Set [ITI-43] | MHD Retrieve Document [ITI-68] | same |
| Provide and Register [ITI-41] | MHD Provide Document Bundle [ITI-65] | same |
| Record Audit Event [ITI-20] (syslog) | ATNA Record Audit Event [ITI-20] with FHIR AuditEvent | **unverified in this pass**, to confirm in Phase 2 against [IHE ATNA](https://profiles.ihe.net/ITI/ATNA/) and BALP |
| XUA [ITI-40] (SAML) | IUA (OAuth 2) | **unverified in this pass**, to confirm in Phase 2 against [IHE IUA](https://profiles.ihe.net/ITI/IUA/) |

IHE states that the PIXm and PDQm transactions "correspond to the transactions used in the PIX and PIXV3 Profiles" and the PDQ/PDQv3 profiles respectively, and that an MHD Document Responder acting as a proxy "can be grouped with an XDS Document Consumer".

---

## 2. The e-card contact confirmation

### 2.1 What creates the treatment relationship

- **Law:** the patient's identity must be checked electronically "with the participation of the patient" ("unter Mitwirkung des ELGA-Teilnehmers"), e.g. by reading the e-card through the e-card system, by ID Austria (E-ID), or from an electronic prescription or referral. § 18 Abs. 4 GTelG 2012. **Verified.** [RIS: GTelG 2012 § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18)
- Access is limited to people involved in the concrete treatment or care process (§ 14 Abs. 3a Z 2). **Verified.** [RIS: GTelG 2012](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120)
- **Mechanism (dated, 2017):** in a practice, inserting the e-card makes the e-card system issue a contact signed by its security token service; the practice software receives it through the GINA box and forwards it to the central KBS with a WS-Trust request carrying the ELGA HCP assertion. Doctors and pharmacists may report contacts only this way. Hospitals and care homes without e-card connection issue contacts themselves from their admission system. (Gesamtarchitektur, pp. 83 to 84)
- In practices, a contact confirmation can be issued from the currently inserted e-card without a consultation booking; this is how private doctors (Wahlärzte) and pharmacies prove contact. **Verified.** [chipkarte.at: ELGA FAQ 2.9, section 2.2.8 (PDF)](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)
- **Contactless e-authorisation (e-Berechtigung):** the patient can grant access from the social insurance apps by reading the e-card over NFC. It is valid for 24 hours from being granted; if the doctor opens the patient's ELGA within that window it has the same effect as inserting the e-card. **Verified.** [Ärztekammer Wien, 30 Oct 2025 (PDF)](https://www.aekwien.at/documents/d/wien/251030_arztinnen-news_elga-zugriff-verlangern-bzw-kontaktlos-freischalten)

### 2.2 How long access lasts

**The law (in force since 15 February 2026, BGBl. I Nr. 71/2025)**, § 18 Abs. 6 GTelG 2012: the identity check must "not lie further back than" ("nicht länger als ... zurückliegen"):

| Provider type (§ 2 Z 10) | Default window | Extendable (§ 18 Abs. 7) |
|---|---|---|
| a doctors, b dentists, d hospitals, e care facilities, ELGA ombudsman | **90 days** | up to 365 days for a, b, e (provider "of special trust"). **Not for hospitals (d).** |
| c pharmacies, f ambulance services, g 1450 health line | **28 days** | up to 365 days for c (pharmacy of trust) |

Source: [RIS: GTelG 2012 § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18). **Verified.**

**What each provider type may see by default**, § 21 Abs. 2 GTelG 2012: doctors, hospitals and care facilities all ELGA health data; dentists lit. a and b (documents and medication); pharmacies and ambulance services medication data only. **Verified.** [RIS: GTelG 2012 § 21](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=21)

**e-Vaccination record:** where the patient index is used for the identity check, it must not lie further back than **28 days** for vaccinating providers and pharmacies. § 24f Abs. 2 GTelG 2012. **Verified.** [RIS: GTelG 2012 § 24f](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=24f). The e-card FAQ confirms "the access period for the e-Impfpass is 28 days for all providers" and that individual blocking does not apply to it. [chipkarte.at FAQ, section 2.2.11.2](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)

**Verdict on the common summary:** "90 days for eBefunde and eMedikation, 28 days for eImpfpass" is **confirmed for doctors in practice**, by the law and by [Ärztekammer Wien](https://www.aekwien.at/documents/d/wien/251030_arztinnen-news_elga-zugriff-verlangern-bzw-kontaktlos-freischalten) ("90 Tage auf eMedikation und eBefund, 28 Tage auf den eImpfpass"). It is **incomplete** as a general rule: pharmacies get 28 days and medication only; the patient can shorten any window to 0 (block) or extend it to 365 days, but not for hospitals.

Further rules from the e-card FAQ ([chipkarte.at FAQ 2.9, sections 2.2.10 to 2.2.11](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)), **verified**:
- A contact confirmation has no fixed lifetime; validity is evaluated at access time against the patient's current policies, so it can change after the confirmation was created.
- Contact confirmations are deleted after 365 days.
- Denial reasons the system distinguishes: no confirmation at all (e.g. error ZS-2200038 for e-Befunde, ZS-2200039 medication list, ZS-2200169 vaccination record); confirmation stored but expired, provider blocked, or patient opted out (ZS-2200150).

**Dated or unverified, not built on:**
- Hospital inpatient stays: the 2017 architecture says an inpatient contact gives access for the whole stay and the window starts at discharge (Gesamtarchitektur pp. 80 to 85, written when the window was 28 days). Current law does not mention admission or discharge. **Dated.** Passayge will model hospitals with outpatient-style contacts only, labelled as simplified.
- Backdating: contacts may be reported up to 28 days in the past and 24 hours in the future; delegation of contacts to e.g. a lab. **Dated** (2017).
- Whether "90 days" means 90 x 24 hours from the contact timestamp or calendar days. **Unverified.** Passayge will use 90 x 24 h from the timestamp and say so in the UI.

### 2.3 Opt-out and objection rights

- **General or partial opt-out (Widerspruch, opt-out)** at any time, against all ELGA health data or against individual types; declared in writing to the ELGA and eHealth support body or electronically via the access portal; must be confirmed; can be revoked. Existing references covered by it are deleted or made inaccessible. § 15 Abs. 2 to 4 GTelG 2012. **Verified.** [RIS: GTelG 2012 § 15](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=15). In practice the partial opt-outs are for e-Befunde and for e-Medikation ("aus ELGA oder e-Medikation austragen", [chipkarte.at FAQ 2.2.11.2](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)).
- **Objection for a single treatment case** (§ 16 Abs. 2 Z 2), documented at the same step as the e-card read but technically separate from the e-card data flow (§ 18 Abs. 5). **Verified.** [RIS § 18](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=18)
- **Individual access rights** (§ 16 Abs. 1): hide or delete entries, shorten access periods, name providers of special trust. **Verified.**
- **e-Vaccination record: no opt-out.** § 24e Abs. 5 excludes the GDPR right to object ("kein Widerspruchsrecht gemäß Art. 21 DSGVO") and restricts erasure and restriction. **Verified.** [RIS: GTelG 2012 § 24e](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120&Paragraf=24e)

### 2.4 What is logged

- **Every processing of ELGA health data is logged**, with: date and time, transaction number, type of processing, the acting provider, the natural person who accessed, the identifier of the data, query criteria, and error messages. § 22 Abs. 2 GTelG 2012. **Verified.** [RIS: GTelG 2012](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120)
- Logs are kept for **three years** after access (§ 22 Abs. 3); the patient can see their own logs (§ 22 Abs. 4). **Verified.**
- Reading access must always carry the name of a natural person, even for automated prefetch. **Verified.** [chipkarte.at FAQ 2.2.1](https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349)

---

## 3. The 2026 obligation for private doctors (Wahlärzte)

Context only. Passayge never claims to test anyone's compliance.

- **Legal basis:** § 49 Abs. 7 Ärztegesetz 1998: self-employed doctors and doctors employed by them must use the e-card, the e-card infrastructure and ELGA "spätestens mit 1. Jänner 2026" (by 1 January 2026 at the latest), subject to the technical prerequisites being achievable with proportionate effort, and unless the patient has objected under § 15 Abs. 2 or § 16 Abs. 2 Z 2 GTelG. Patients must be told before treatment if the rules are not applied. Experts, occupational physicians and Wohnsitzärzte are exempt from Z 1 to 3 but not from the vaccination record duty (Z 4). Current version in force since 30 July 2026 (BGBl. I Nr. 65/2026). **Verified.** [RIS: ÄrzteG 1998 § 49](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011138&Paragraf=49)
- **Scope per Ärztekammer Wien (17 April 2025):** e-card system; ELGA e-Befund (read) and e-Medikation (read and write); e-Impfpass (read and write); diagnosis coding via eDiagnose. Which private doctors are exempt was "not defined at this point and subject to negotiation". **Verified.** [Ärztekammer Wien (PDF)](https://www.aekwien.at/documents/d/wien/250417_e-card-system-elga-funktionalitaten-und-ediagnose-ab-1-janner-2026-statusinformation-fur-wahlarztinnen-1)
- **Exemption threshold and diagnosis coding (Ärztekammer Kärnten, June 2026):** the exemption of 300 different patients per year applies analogously to e-card/ELGA; full ICD-10 coding obligation from the third quarter of 2026. **Verified** as the chamber's statement. [Ärztekammer Kärnten: 2026 Überblick eHealth (PDF)](https://www.aekktn.at/documents/d2b3fe3d-6637-11f1-8810-bc2411ec0614/2026_%C3%9Cberblick_eHealth.pdf)
- § 31a Abs. 7a ASVG (checking the patient's identity and e-card validity) was cited by search results but **not read by me**; **unverified** until I read it on RIS.

---

## 4. HL7 Austria FHIR profiles

- **HL7 Austria FHIR Core R4**, package `hl7.at.fhir.core.r4` **2.0.0 (STU2)**, FHIR 4.0.1, built 27 January 2025, canonical `http://hl7.at/fhir/HL7ATCoreProfiles/4.0.1`, licence field in package.json **CC0-1.0**. Dependencies: `hl7.terminology.r4` 6.2.0, `hl7.fhir.uv.extensions.r4` 5.1.0. Profiles include AT Core Patient, Address, Practitioner, PractitionerRole, Organization, plus extensions (e.g. religion). **Verified** (package downloaded from [packages.fhir.org](https://packages.fhir.org/hl7.at.fhir.core.r4); [IG](https://fhir.hl7.at/HL7-AT-FHIR-Core-R4/index.html)).
- R5 version `hl7.at.fhir.core.r5` 2.0.0 also published; 2.1.0 (STU3) and a 2026-03 ballot exist as builds, not releases. [fhir.hl7.at](https://fhir.hl7.at/index_other.html)
- The IG pages carry "IG © 2020+ HL7 Austria, TC FHIR" and the HL7 trademark notice; the IG also flags third-party IP (e.g. SNOMED CT, LOINC). The package licence is CC0, but terminology inside it carries its own terms.
- Other: Austrian Patient Summary R4 1.1.0-STU2; drafts for e-Medikation (R4, R5), e-Diagnose, scheduling, integrated care.
- **HAPI FHIR validation:** the HAPI JPA starter supports installing NPM IG packages at start-up (`hapi.fhir.implementationguides` with `packageUrl` or `name`/`version`, `installMode: STORE_AND_INSTALL`, `install_transitive_ig_dependencies`) and request validation (`hapi.fhir.validation.requests_enabled`). [hapi-fhir-jpaserver-starter application.yaml](https://github.com/hapifhir/hapi-fhir-jpaserver-starter/blob/master/src/main/resources/application.yaml). Your hl7-fhir-gateway uses `hapiproject/hapi:v7.4.0` (R4). **Feasible, not yet tested.** I will prove it in Phase 2 by loading the package and validating one AT Core Patient. Risk: terminology bindings to Austrian code systems (termgit.elga.gv.at) that HAPI cannot resolve offline may produce warnings; the plan is to treat those as warnings, not failures, and say so.

---

## 5. Synthetic Austrian patients

### 5.1 SVNR format

Primary source: answer of the Federal Ministry to a parliamentary question, [4690/AB XXIII. GP (parlament.gv.at)](https://www.parlament.gv.at/dokument/XXIII/AB/4690/fnameorig_136871.html). **Verified.**

- 10 digits: `LLL P TT MM JJ` (serial number, check digit, day, month, two-digit year of birth). No sex or century encoded.
- Serial number assigned "from 100 upwards" ("von 100 aufwärts").
- Check digit P = (3·L1 + 7·L2 + 9·L3 + 5·T1 + 8·T2 + 4·M1 + 2·M2 + 1·J1 + 6·J2) mod 11. If the remainder is 10, the next serial number is used instead (so P is never 10).
- If the day and month are unknown, or all serials for a date are used up, a fictitious month 13, 14 or 15 is used.
- Worked example: serial 123, birth 01.01.70: 3+14+27+0+8+0+2+7+0 = 61, 61 mod 11 = 6, SVNR 1236 010170.

### 5.2 Guaranteeing a number cannot belong to a real person

No checksum-valid number in the real range can be guaranteed unissued. Proposal:

1. **Serial numbers 000 to 099 only.** The ministry says serials start at 100, so these are outside the issued range, while still passing the check-digit algorithm (useful to show validation). Labelled as an assumption based on a 2008 source.
2. **Every patient shown with a "Synthetic" tag** in the patient banner, and the identifier system in FHIR is a Passayge URI, not the real SVNR OID, so a record can never be mistaken for or imported as real.
3. Names drawn from common Austrian first and last names combined at random, checked so no combination matches a known public figure.
4. Addresses: real postcodes and towns, **fictional street names** (open question below).
5. Providers: fictional practices and hospitals with plausible names, never real ones.

---

## 6. Name check (report only)

Checked 23 October 2026:

| Where | Result |
|---|---|
| GitHub repositories named "passayge" | 0 results (`gh api search/repositories?q=passayge`) |
| GitHub user or org "passayge" | does not exist (404) |
| npm package "passayge" | not taken (registry 404, search 0 results) |
| passayge.com, passayge.at | DNS: non-existent domain (NXDOMAIN). Strong sign both are unregistered; not a registrar check. |
| Web search for the exact spelling | no product or company found; results are for the word "passage" |

Similar names: "Passage" is a common English and French word used by many unrelated businesses; I found no health-IT product called Passage in a quick search. No conflict seen, but this is not a trademark search (Austrian Patent Office or EUIPO), which I recommend before any public launch beyond a portfolio.

---

## 7. MVP plan (about two weeks)

### Real (implemented as the standard describes)

- HAPI FHIR R4 in Docker with AT Core 2.0.0 loaded and request validation on (if Phase 2 spike succeeds).
- PDQm [ITI-78] patient search (family, given, birthdate, identifier).
- MHD [ITI-67] Find Document References, [ITI-68] Retrieve Document, and [ITI-65] Provide Document Bundle for seeding.
- Access rules exactly as verified: 90 days (doctor, dentist, hospital, care), 28 days (pharmacy), 28 days for the vaccination record for everyone, 365-day extension except hospitals, block to 0, default data scopes per § 21 Abs. 2 (pharmacy sees medication only), general and partial opt-out, single-case objection, no opt-out from the vaccination record.
- Audit log of every grant, denial, expiry and document access with the § 22 Abs. 2 fields, stored as FHIR AuditEvent.
- Synthetic data generator with valid-checksum, out-of-range SVNRs.

### Simplified (labelled as simplified in UI and README)

- **e-card insertion** is a button. No card reader, no GINA box, no e-card security token service.
- **One service stands in for KBS, ETS and PAP.** No SAML, no WS-Trust; a short-lived signed token labelled "Simplified token, not an ELGA assertion".
- **One affinity domain.** No XCA [ITI-38]/[ITI-39]; the network log notes which cross-area transaction it would be in ELGA.
- **FHIR instead of SOAP.** The network log shows each FHIR call and, next to it, the ELGA transaction it stands in for (e.g. "ITI-67, in ELGA: ITI-18 Registry Stored Query").
- **Documents** are CDA-like XML with an ELGA-style header, not validated against ELGA Schematron. Labelled "CDA R2, not ELGA-conformant".
- **Hospitals** use outpatient-style contacts only (inpatient/discharge rule is dated).
- **Simulated clock** to jump days ahead and show expiry at the exact boundary.

### Two-week outline

| Days | Work |
|---|---|
| 1 to 2 | Phase 2: architecture, AT Core loading spike in HAPI, palettes, two high-fidelity screens. Checkpoint. |
| 3 to 4 | Docker Compose (HAPI, access service, client), seed data, PDQm and MHD endpoints. |
| 5 to 6 | Access service: rules, simulated clock, audit writing. |
| 7 to 9 | Client: patient search, banner, e-card confirmation, documents, audit and network log, help, tooltips, tour. |
| 10 to 11 | Tests: rules at boundaries, transactions, audit entries, tooltip and tour, axe, no-egress test, CI. |
| 12 | Icon options. Checkpoint. |
| 13 to 14 | README, GIF, screenshots, OSS files. Checkpoint, then push. |

---

## 8. Open questions for Henry

1. **The FHIR premise.** Sources show ELGA is CDA plus SOAP IHE profiles, and the vaccination record is CDA, not FHIR. OK to frame Passayge as "ELGA-style flows rebuilt on the IHE FHIR profiles", with the real ELGA transaction always shown next to the FHIR one?
2. **HL7 statement.** HL7 publishes two versions. The one in the trademark guidelines says the marks "are used with the permission of HL7", which would be untrue for us. I propose the descriptive-use wording from the FHIR licence page: "HL7®, HEALTH LEVEL SEVEN®, FHIR® and the FHIR [FLAME DESIGN]® are the registered trademarks of Health Level Seven International, and their use does not constitute endorsement by HL7." Agree? ([FHIR licence](https://hl7.org/fhir/R4/license.html), [HL7 trademark guidelines](https://info.hl7.org/hl7-trademark-guidelines))
3. **® for ELGA and e-card.** I found no source requiring ® for "ELGA" or "e-card" and could not confirm registrations. Plain text unless you know otherwise?
4. **Addresses.** Real postcodes with fictional street names, or real streets with impossible house numbers? I recommend fictional streets.
5. **Hospital rule.** Leave the inpatient-until-discharge rule out (dated source), or include it labelled "based on the 2017 ELGA architecture"?
6. **e-Berechtigung (24 h contactless grant).** In scope for the MVP or stretch?

---

## Sources

- RIS, GTelG 2012 consolidated: https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20008120 (§ 2, § 15, § 18, § 21, § 24e, § 24f linked inline)
- RIS, ÄrzteG 1998 § 49: https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10011138&Paragraf=49
- ELGA GmbH, Gesamtarchitektur 2.30a: https://www.elga.gv.at/fileadmin/user_upload/Dokumente_PDF_MP4/Technisches/ELGA_Gesamtarchitektur_2.30a.pdf
- ELGA GmbH, Technischer Aufbau: https://www.elga.gv.at/technischer-hintergrund/technischer-aufbau-im-ueberblick/
- gesundheit.gv.at, Implementierungsleitfäden: https://www.gesundheit.gv.at/professional/it-services/implementierungsleitfaeden
- gesundheit.gv.at, ILF e-Impfpass 2.0.2: https://www.gesundheit.gv.at/dam/gesundheitgvat/professional/it-services/implementierungsleitfaeden/ILF_e-Impfpass_2.0.2-20260204.pdf
- chipkarte.at, ELGA FAQ 2.9: https://www.chipkarte.at/cdscontent/load?contentid=10008.781679&version=1698063349
- Ärztekammer Wien, 30 Oct 2025: https://www.aekwien.at/documents/d/wien/251030_arztinnen-news_elga-zugriff-verlangern-bzw-kontaktlos-freischalten
- Ärztekammer Wien, 17 Apr 2025: https://www.aekwien.at/documents/d/wien/250417_e-card-system-elga-funktionalitaten-und-ediagnose-ab-1-janner-2026-statusinformation-fur-wahlarztinnen-1
- Ärztekammer Kärnten, June 2026: https://www.aekktn.at/documents/d2b3fe3d-6637-11f1-8810-bc2411ec0614/2026_%C3%9Cberblick_eHealth.pdf
- HL7 Austria FHIR: https://fhir.hl7.at/ and https://fhir.hl7.at/index_other.html
- IHE MHD 4.2.5: https://profiles.ihe.net/ITI/MHD/ ; PDQm 3.2.0: https://profiles.ihe.net/ITI/PDQm/volume-1.html ; PIXm 3.1.0: https://profiles.ihe.net/ITI/PIXm/volume-1.html
- Parliament, SVNR structure: https://www.parlament.gv.at/dokument/XXIII/AB/4690/fnameorig_136871.html
- HL7 FHIR licence and trademarks: https://hl7.org/fhir/R4/license.html ; https://info.hl7.org/hl7-trademark-guidelines
