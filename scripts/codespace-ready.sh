#!/usr/bin/env bash
# Waits until the sandbox answers, then opens it in the browser (GitHub Codespaces).
# Docker publishes port 8080 at once, while the gateway only listens after HAPI FHIR has
# started and the synthetic data is loaded; until then the forwarded port answers 502.
# The gateway's health endpoint answering is the signal that the app is ready.

set -u
HEALTH="http://localhost:8080/api/health"
LIMIT_SECONDS="${LIMIT_SECONDS:-600}"

echo "Waiting for Passayge: HAPI FHIR starts first, then the gateway loads the data (about 3 minutes on a first start)."
start=$(date +%s)
until curl -sf -o /dev/null "$HEALTH"; do
  if [ $(( $(date +%s) - start )) -ge "$LIMIT_SECONDS" ]; then
    echo "Passayge did not answer within ${LIMIT_SECONDS} s. See: docker compose logs gateway hapi"
    exit 1
  fi
  sleep 5
done

if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  url="https://${CODESPACE_NAME}-8080.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
  url="http://localhost:8080"
fi
echo "Passayge is ready: ${url}"
if [ -n "${BROWSER:-}" ]; then
  "$BROWSER" "$url" >/dev/null 2>&1 || true
fi
