#!/usr/bin/env bash
# Mechanical checks for the Afenda Talents invariants.
# Covers 2, 3, 5, 6, 7 and 9. Invariants 1, 4 and 8 need human review.
# Exits non-zero on any violation.

set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 1

fail=0
report() { printf '\033[31mFAIL\033[0m  %s\n' "$1"; shift; [ -n "${1:-}" ] && printf '      %s\n' "$1"; fail=1; }
pass()   { printf '\033[32mok\033[0m    %s\n' "$1"; }

# Greps only the paths that exist and returns matches on stdout.
# Never signals through the exit code: a missing path makes grep exit 2 even when
# it found matches, which silently turned a violation into a pass in an earlier version.
scan() {
  local pattern="$1"; shift
  local paths=()
  for p in "$@"; do [ -e "$p" ] && paths+=("$p"); done
  [ ${#paths[@]} -eq 0 ] && return 0
  grep -rnE "$pattern" "${paths[@]}" --include=*.ts --include=*.tsx 2>/dev/null || true
}

check() { # check <label> <matches>
  if [ -n "$2" ]; then report "$1" "$(echo "$2" | head -3 | tr '\n' ' ')"; else pass "$1"; fi
}

# --- Invariant 5: scoring stays pure -----------------------------------------
check "5: lib/scoring.ts is pure" \
  "$(scan 'from "[^"]*(lib/db|@prisma/client)"|PrismaClient|\bprisma\.' src/lib/scoring.ts)"

# --- Invariant 7: the two auth systems never meet -----------------------------
auth_mix="$(scan 'auth-admin' src/app/api/candidate src/app/a)
$(scan 'auth-candidate' src/app/api/admin src/app/admin)
$(scan 'afenda_candidate|candidateId' src/lib/auth-admin.ts)
$(scan 'afenda_admin|role.*admin' src/lib/auth-candidate.ts)"
check "7: admin and candidate auth stay separate" "$(echo "$auth_mix" | grep -v '^$' || true)"

# --- Invariant 3: status is written in exactly one place ----------------------
status_writes=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  [ "$file" = "src/lib/status.ts" ] && continue
  hit="$(grep -nE '^\s*status:\s*"?(DRAFT|SENT|STARTED|SUBMITTED|SCORED|EXPIRED|REVOKED)' "$file" || true)"
  [ -n "$hit" ] && status_writes+="$file:$hit"$'\n'
done < <(scan 'candidate\.update' src | cut -d: -f1 | sort -u)
check "3: status is written only via lib/status.ts (use applyStatus)" "$status_writes"

# --- Invariant 2: raw tokens are never logged or returned ---------------------
# `hashToken(token)` and `tokenHash` are the safe forms, so they are scrubbed from a copy
# of the line before deciding. A noisy check gets ignored, which is worse than no check.
# Note: awk uses POSIX ERE, where \b is a backspace escape and NOT a word boundary.
# The character-class form below is the portable way to say "the bare word token".
raw_token_only() {
  awk '{
    s = $0
    gsub(/hashToken\([^)]*\)/, "", s)   # the whole safe call, argument included
    gsub(/tokenHash/, "", s)
    if (s ~ /(^|[^A-Za-z0-9_])token([^A-Za-z0-9_]|$)/) print
  }'
}
token_leak="$(scan 'console\.(log|error|warn)\([^)]*token' src | raw_token_only)
$(scan 'json\(\{[^}]*token' src/app/api | raw_token_only)"
check "2: no raw token is logged or returned" "$(echo "$token_leak" | grep -v '^$' || true)"

# --- Invariant 6: audit rows carry no identities ------------------------------
check "6: no audit call passes a name or an email" \
  "$(scan 'audit\([^)]*\b(email|fullName)\b' src)"

# --- Invariant 9: no single summarising number --------------------------------
# Identifier forms only: the spec REQUIRES prose that negates ranking ("is not a test
# score, a ranking, or a recommendation"), so bare words in copy must not trip this.
# What must never exist is a computed rank/overall value: a variable, key, or call.
check "9: no overall score, rank, or percentile is computed" \
  "$(scan '\b(overallScore|totalScore|compositeScore|averageScore|percentile)\b|\brank(ing|ed)?\s*[:=(]' src)"

echo
if [ "$fail" -ne 0 ]; then
  echo "Invariant check failed. Fix before committing."
  exit 1
fi
echo "Mechanical invariants pass. Invariants 1 (route reachability), 4 (Zod on every body)"
echo "and 8 (handler re-reads the candidate row) still need review by eye."
