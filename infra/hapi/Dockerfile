# HAPI FHIR with the HL7 Austria FHIR Core profiles installed from local packages.
# The packages are downloaded and checked at build time, so the running server never needs
# the internet (it sits on an internal Docker network).

FROM alpine:3.22 AS packages
WORKDIR /packages
RUN wget -q -O hl7.at.fhir.core.r4-2.0.0.tgz https://packages.fhir.org/hl7.at.fhir.core.r4/2.0.0 \
 && wget -q -O hl7.terminology.r4-6.2.0.tgz https://packages.fhir.org/hl7.terminology.r4/6.2.0 \
 && wget -q -O hl7.fhir.uv.extensions.r4-5.1.0.tgz https://packages.fhir.org/hl7.fhir.uv.extensions.r4/5.1.0 \
 && printf '%s\n' \
    '847d6f859615eeacef19a42d24c61696f62d3363ac02865f55521687fbc2b8b4  hl7.at.fhir.core.r4-2.0.0.tgz' \
    '79404c9cc95491fc0155627cd039c401a6eb4748175328131e91b709a41300e2  hl7.terminology.r4-6.2.0.tgz' \
    'f96eec24d8ad2c043cf295acdfab46b01e0e1fcc568740aab3fd1acee4cb0456  hl7.fhir.uv.extensions.r4-5.1.0.tgz' \
    | sha256sum -c -

FROM hapiproject/hapi:v8.12.0-2
COPY --from=packages /packages /packages
COPY application.yaml /app/config/application.yaml
