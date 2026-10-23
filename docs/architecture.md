# Passayge MVP architecture

Status: Phase 2 proposal. ELGA-style flows rebuilt on IHE FHIR profiles; the real ELGA transaction is always shown next to each call. Facts about ELGA are sourced in `docs/research/phase-1-research.md`.

## Components

```
 Browser (React client)
   |  HTTP, same origin only
   v
 access-gateway  (Node 22, TypeScript, Fastify)            one container
   - simulated clock
   - contact confirmations and patient settings (in memory, seeded)
   - access rules (pure functions, verified rules only)
   - policy enforcement in front of every FHIR call
   - network log: every call with its IHE transaction and ELGA counterpart
   - writes an AuditEvent for every grant, denial, expiry and access
   |  HTTP on an internal Docker network
   v
 HAPI FHIR R4 JPA server  (hapiproject/hapi:v8.12.0-2)    one container, internal network only
   - HL7 Austria FHIR Core 2.0.0 installed from a local package
   - Patient, Practitioner, Organization, DocumentReference, Binary, AuditEvent
```

The client never talks to HAPI directly. The gateway plays the part of ELGA's access control facade, token service and contact confirmation service together, and says so in the UI.

## IHE transactions implemented

| Sandbox call | IHE transaction | ELGA counterpart shown in the UI |
|---|---|---|
| `GET /fhir/Patient?family=&given=&birthdate=&identifier=` | PDQm Mobile Patient Demographics Query [ITI-78] | PDQv3 [ITI-47] against the central patient index (Z-PI) |
| `GET /fhir/DocumentReference?patient=&status=` | MHD Find Document References [ITI-67] | Registry Stored Query [ITI-18]; Cross Gateway Query [ITI-38] across areas |
| `GET /fhir/Binary/{id}` | MHD Retrieve Document [ITI-68] | Retrieve Document Set [ITI-43]; Cross Gateway Retrieve [ITI-39] |
| `POST /fhir` (transaction Bundle) used by the seeder | MHD Provide Document Bundle [ITI-65] | Provide and Register Document Set-b [ITI-41] |
| `POST /fhir/AuditEvent` | ATNA Record Audit Event [ITI-20], FHIR feed (to be confirmed in Phase 3) | Record Audit Event [ITI-20] to the area's audit record repository |
| `POST /access/contact-confirmations` | none, sandbox endpoint | e-card system signs the contact; practice software forwards it to the KBS over WS-Trust. Labelled simplified. |
| `POST /access/decide` | none, sandbox endpoint | ETS issues a SAML assertion carried with XUA [ITI-40]. Labelled simplified. |

## Access rules (verified only)

| Rule | Source |
|---|---|
| Doctors, dentists, hospitals, care facilities: 90 days from the identity check | GTelG 2012 § 18 Abs. 6 |
| Pharmacies (and ambulance, 1450): 28 days | § 18 Abs. 6 |
| Extension up to 365 days for doctors, dentists, pharmacies, care; never for hospitals | § 18 Abs. 7 |
| Patient can shorten to 0 (block a provider) | § 16 Abs. 1, chipkarte.at FAQ 2.2.10 |
| Pharmacies see medication only; dentists documents and medication; doctors, hospitals, care everything | § 21 Abs. 2 |
| Vaccination record: 28 days for every provider; no opt-out, no blocking | § 24f Abs. 2, § 24e Abs. 5, FAQ 2.2.11.2 |
| General and partial opt-out (documents, medication) | § 15 Abs. 2 to 4 |
| Objection for a single treatment case | § 16 Abs. 2 Z 2, § 18 Abs. 5 |
| No contact confirmation: deny, distinct from expired or blocked | FAQ 2.2.11 |

Boundary: a window of N days ends exactly N x 24 h after the contact timestamp; access at that instant is denied. The "N x 24 h" reading is our assumption (the law says "not longer than N days back") and is labelled in the UI.

Not modelled: hospital access for the whole inpatient stay with the window starting at discharge. The only source is the ELGA architecture document of 2017, written when the window was 28 days. Listed in the README under "Not modelled".

Stretch: contactless e-authorisation (24 h grant via the social insurance app).

## Data

- Seeder posts a transaction Bundle per patient: Patient (AT Core profile), Practitioner, Organization, DocumentReference plus Binary (CDA-like XML, labelled "CDA R2, not ELGA-conformant").
- SVNR: serial 000 to 099 with a correct check digit, identifier system `https://henrycarto.com/passayge/fhir/sid/synthetic-svnr` (never the real SVNR OID), `meta.tag` "synthetic".
- Addresses: real postcodes, fictional street names.

## Spike result: HAPI with AT Core

Run on 23 Oct 2026 with `hapiproject/hapi:v8.12.0-2`:

- `hl7.at.fhir.core.r4` 2.0.0 installed from a local `.tgz` (`installMode: STORE_AND_INSTALL`), with its dependencies `hl7.terminology.r4` 6.2.0 and `hl7.fhir.uv.extensions.r4` 5.1.0 from local files (`STORE_ONLY`). No network at run time. Start-up about 80 s.
- `Patient/$validate?profile=.../at-core-patient`:
  - Passayge patient (synthetic identifier, name, gender, address): **no errors**, 3 warnings.
  - Patient without name and gender: **2 errors**, "Patient.name: minimum required = 1" and "Patient.gender: minimum required = 1", from the AT Core profile.
- Expected warnings: the ELGA value set `https://termgit.elga.gv.at/ValueSet/hl7-at-patientidentifier` is not available offline, and a narrative is recommended (dom-6). Plan: CI fails on errors, reports warnings. Optionally load the termgit value set later if its licence allows.
- Note: hl7-fhir-gateway pins `v7.4.0`; Passayge proposes `v8.12.0-2` for the newer validator. Both images are already on this machine.

## No traffic leaves the sandbox

- HAPI sits on a Docker network with `internal: true`: it cannot reach the internet.
- IG packages are copied into a small HAPI image at build time, so nothing is fetched at start-up.
- Fonts and icons are self-hosted; no CDN.
- Tests: a Playwright test fails on any browser request to a host other than the sandbox, and a gateway test fails if any outbound request goes to a host not on the allowlist (HAPI only).

## Tests and CI (Phase 4)

GitHub Actions: typecheck, lint, unit (Vitest: every rule, at and around each boundary), integration (gateway against HAPI in Docker), browser (Playwright with axe, light and dark, desktop and tablet), FHIR validation of every seed resource through HAPI `$validate`.
