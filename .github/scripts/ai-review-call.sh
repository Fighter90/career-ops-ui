#!/usr/bin/env bash
# Shared advisory AI-review API call for .github/workflows/ai-review.yml.
#
# Reads the prompt from $1 (a file) and prints ONLY the review text to stdout
# (the caller posts stdout verbatim as a public commit/PR comment). All failure
# diagnostics — HTTP codes, raw error bodies — go to STDERR (the workflow log,
# where GitHub masks registered secrets), never to stdout.
#
# Provider preference:
#   1. OpenRouter  — when OPENROUTER_API_KEY is set. Cheap + fast; the model is
#      OPENROUTER_REVIEW_MODEL (repo variable) or a cheap default. OpenAI-compatible
#      chat/completions API. NOTE: this sends the diff to OpenRouter's chosen upstream.
#   2. Anthropic   — fallback when only ANTHROPIC_API_KEY is set.
#   3. neither     — prints a skip notice.
#
# Fail-SOFT throughout: on any error it prints a short generic notice to stdout
# and exits 0, so the caller posts that and the workflow stays green (ci.yml is
# the hard gate, never this advisory review). jq is preinstalled on ubuntu-latest.
set -uo pipefail

PROMPT_FILE="${1:?prompt file required}"
REPO="${REPO:-${GITHUB_REPOSITORY:-Fighter90/career-ops-ui}}"
REQ="$(mktemp)"; RESP="$(mktemp)"
trap 'rm -f "$REQ" "$RESP"' EXIT

if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  MODEL="${OPENROUTER_REVIEW_MODEL:-google/gemini-2.0-flash-001}"
  # jq -Rs slurps the whole prompt file as one JSON string, escaping the diff.
  jq -Rs --arg m "$MODEL" '{model:$m,max_tokens:1500,messages:[{role:"user",content:.}]}' \
    "$PROMPT_FILE" > "$REQ"
  jq -e . "$REQ" >/dev/null 2>&1 || { echo "(could not build request JSON — fail-soft)"; exit 0; }
  HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' --max-time 120 \
    https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "content-type: application/json" \
    -H "HTTP-Referer: https://github.com/${REPO}" \
    -H "X-Title: career-ops-ui AI review" \
    --data-binary @"$REQ" || echo "000")
  if [ "$HTTP" != "200" ]; then
    { echo "OpenRouter AI review failed — HTTP $HTTP:"; head -c 500 "$RESP" 2>/dev/null; echo; } >&2
    echo "(OpenRouter AI review unavailable — HTTP $HTTP; see the workflow log)"
    exit 0
  fi
  # content, else the model/provider error message, else empty. Never the raw body.
  jq -r '.choices[0].message.content // .error.message // ""' "$RESP" 2>/dev/null
  exit 0
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  jq -Rs '{model:"claude-opus-4-7",max_tokens:1500,messages:[{role:"user",content:.}]}' \
    "$PROMPT_FILE" > "$REQ"
  jq -e . "$REQ" >/dev/null 2>&1 || { echo "(could not build request JSON — fail-soft)"; exit 0; }
  HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' --max-time 120 \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    --data-binary @"$REQ" || echo "000")
  if [ "$HTTP" != "200" ]; then
    { echo "Anthropic AI review failed — HTTP $HTTP:"; head -c 500 "$RESP" 2>/dev/null; echo; } >&2
    echo "(Anthropic AI review unavailable — HTTP $HTTP; see the workflow log)"
    exit 0
  fi
  jq -r '([.content[]? | select(.type=="text") | .text] | join("")) // .error.message // ""' "$RESP" 2>/dev/null
  exit 0
fi

echo "(no OPENROUTER_API_KEY or ANTHROPIC_API_KEY set — AI review skipped; advisory only, ci.yml still gates)"
exit 0
