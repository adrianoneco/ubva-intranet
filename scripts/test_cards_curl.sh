#!/usr/bin/env bash
# Test script for cards endpoints. Usage:
#   SERVER_URL=http://localhost:3000 USERNAME=admin PASSWORD=secret ./scripts/test_cards_curl.sh

set -euo pipefail

SERVER_URL=${SERVER_URL:-http://localhost:3000}
USERNAME=${USERNAME:-admin}
PASSWORD=${PASSWORD:-admin}
COOKIEJAR=$(mktemp)

echo "Logging in as ${USERNAME}..."
LOGIN_RESP=$(curl -s -c ${COOKIEJAR} -H "Content-Type: application/json" -d "{\"username\": \"${USERNAME}\", \"password\": \"${PASSWORD}\"}" ${SERVER_URL}/api/login)
echo "Login response: ${LOGIN_RESP}"

echo "Creating a card (requires cards:create)..."
CREATE_PAYLOAD='{"title":"Test Card from curl","subtitle":"curl test","image":null}'
HTTP_CREATE=$(curl -s -w "HTTPSTATUS:%{http_code}" -b ${COOKIEJAR} -H "Content-Type: application/json" -d "${CREATE_PAYLOAD}" ${SERVER_URL}/api/cards)
HTTP_CODE=$(echo "$HTTP_CREATE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo "$HTTP_CREATE" | sed -e 's/HTTPSTATUS:.*//')
echo "Create status: ${HTTP_CODE}"
echo "Body: ${BODY}"

if [ "$HTTP_CODE" != "201" ]; then
  echo "Create failed or permission denied (expected 201 for allowed user, 401/403 otherwise). Exiting."
  exit 0
fi

CARD_ID=$(echo "$BODY" | sed -n 's/.*"id":\s*\([0-9]*\).*$/\1/p')
if [ -z "$CARD_ID" ]; then
  echo "Could not parse created card id from response. Exiting."
  exit 1
fi

echo "Created card id: $CARD_ID"

echo "Updating card (requires cards:edit)..."
PATCH_PAYLOAD='{"subtitle":"Updated via curl"}'
HTTP_PATCH=$(curl -s -w "HTTPSTATUS:%{http_code}" -b ${COOKIEJAR} -X PATCH -H "Content-Type: application/json" -d "${PATCH_PAYLOAD}" ${SERVER_URL}/api/cards/${CARD_ID})
HTTP_CODE=$(echo "$HTTP_PATCH" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo "$HTTP_PATCH" | sed -e 's/HTTPSTATUS:.*//')
echo "Patch status: ${HTTP_CODE}"
echo "Body: ${BODY}"

echo "Deleting card (requires cards:delete)..."
HTTP_DELETE=$(curl -s -w "HTTPSTATUS:%{http_code}" -b ${COOKIEJAR} -X DELETE ${SERVER_URL}/api/cards/${CARD_ID})
HTTP_CODE_DEL=$(echo "$HTTP_DELETE" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY_DEL=$(echo "$HTTP_DELETE" | sed -e 's/HTTPSTATUS:.*//')
echo "Delete status: ${HTTP_CODE_DEL}"
echo "Body: ${BODY_DEL}"

rm -f ${COOKIEJAR}

echo "Done."
