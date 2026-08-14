#!/usr/bin/env bash
# Shared advisory AI-review API call for .github/workflows/ai-review.yml.
#
# Reads the prompt from $1 (a file) and prints ONLY a real review to stdout. On
# ANY failure or skip (no key, bad JSON, non-200, empty response) it prints
# NOTHING to stdout and logs the reason to STDERR (the workflow log, where
# GitHub masks registered secrets). The caller posts a comment only when stdout
# is non-empty — so a failed/skipped review is silent, not a noisy comment.
#
# Provider preference:
#   1. OpenRouter  — when OPENROUTER_API_KEY is set. Cheap + fast; the model is
#      OPENROUTER_REVIEW_MODEL (repo variable) or a cheap default. OpenAI-compatible
#      chat/completions API. NOTE: this sends the diff to OpenRouter's chosen upstream.
#   2. Anthropic   — fallback when only ANTHROPIC_API_KEY is set.
#   3. neither     — silent skip (stderr note only).
#
# Always exits 0 (advisory; ci.yml is the hard gate). jq is preinstalled on ubuntu-latest.
set -uo pipefail

PROMPT_FILE="${1:?prompt file required}"
REPO="${REPO:-${GITHUB_REPOSITORY:-Fighter90/career-ops-ui}}"
REQ="$(mktemp)"; RESP="$(mktemp)"
trap 'rm -f "$REQ" "$RESP"' EXIT

if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  MODEL="${OPENROUTER_REVIEW_MODEL:-qwen/qwen3-coder}"
  # jq -Rs slurps the whole prompt file as one JSON string, escaping the diff.
  jq -Rs --arg m "$MODEL" '{model:$m,max_tokens:1500,messages:[{role:"user",content:.}]}' \
    "$PROMPT_FILE" > "$REQ"
  jq -e . "$REQ" >/dev/null 2>&1 || { echo "AI review: could not build request JSON — skipping" >&2; exit 0; }
  HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' --max-time 120 \
    https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    -H "content-type: application/json" \
    -H "HTTP-Referer: https://github.com/${REPO}" \
    -H "X-Title: career-ops-ui AI review" \
    --data-binary @"$REQ" || echo "000")
  if [ "$HTTP" != "200" ]; then
    { echo "AI review: OpenRouter HTTP $HTTP — skipping (no comment):"; head -c 500 "$RESP" 2>/dev/null; echo; } >&2
    exit 0
  fi
  # content, else the model/provider error message, else empty. Never the raw body.
  jq -r '.choices[0].message.content // .error.message // ""' "$RESP" 2>/dev/null
  exit 0
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  jq -Rs '{model:"claude-opus-4-7",max_tokens:1500,messages:[{role:"user",content:.}]}' \
    "$PROMPT_FILE" > "$REQ"
  jq -e . "$REQ" >/dev/null 2>&1 || { echo "AI review: could not build request JSON — skipping" >&2; exit 0; }
  HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' --max-time 120 \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    --data-binary @"$REQ" || echo "000")
  if [ "$HTTP" != "200" ]; then
    { echo "AI review: Anthropic HTTP $HTTP — skipping (no comment):"; head -c 500 "$RESP" 2>/dev/null; echo; } >&2
    exit 0
  fi
  jq -r '([.content[]? | select(.type=="text") | .text] | join("")) // .error.message // ""' "$RESP" 2>/dev/null
  exit 0
fi

echo "AI review: no OPENROUTER_API_KEY or ANTHROPIC_API_KEY set — skipping (advisory; ci.yml still gates)" >&2
exit 0
