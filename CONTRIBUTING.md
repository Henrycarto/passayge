# Contributing to Passayge

Thank you for helping. Passayge is a teaching sandbox, so accuracy matters as much as code.

## Run it

You need Docker and Node.js 22.

```bash
docker compose up --build        # the sandbox on http://localhost:8080
```

For development with live reload:

```bash
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d hapi   # HAPI on 127.0.0.1:8091
npm run dev                      # gateway on :8080, web client on http://localhost:5173
```

## Test it

```bash
npm run typecheck
npm run lint
npm run check:personal-data      # no personal data in the repository or in request code
npm test                         # unit tests: rules, gateway with a fake FHIR server, client with axe
npm run test:integration         # gateway against HAPI (needs the dev HAPI above)
npm run validate:fhir            # every resource the sandbox writes, validated by HAPI
npm run test:e2e                 # browser tests with axe (needs docker compose up)
```

CI runs all of these on every push and pull request.

## Propose a change

1. Open an issue first for anything larger than a typo, so we can agree on the approach.
2. Keep pull requests small and focused, with tests for any rule or behaviour you change.
3. Every claim about ELGA, the e-card system, Austrian law or a standard needs a link to an official or primary source (ris.bka.gv.at, elga.gv.at, gesundheit.gv.at, chipkarte.at, sozialversicherung.at, Ärztekammer sites, hl7.at, ihe.net, hl7.org). If no such source exists, the claim is marked unverified and nothing is built on it.
4. Anything simplified is labelled as simplified in the interface and in the README.
5. Synthetic data only. Never add real names, numbers or records, not even in tests.
6. Write in plain English, in sentence case. Official Austrian terms appear once, English first with the German in brackets.

If you think the sandbox does not match how ELGA works, use the "This does not match how ELGA works" issue form and include the official source.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).
