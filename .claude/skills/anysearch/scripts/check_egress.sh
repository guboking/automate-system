#!/usr/bin/env bash
# AnySearch egress self-check.
#
# Probes whether this environment can reach the AnySearch backend
# (api.anysearch.com). On Claude Code cloud environments the default
# "Trusted" network policy blocks this host, so the skill cannot run.
#
# Behavior:
#   - Endpoint reachable  -> exit 0 silently (no noise on every session).
#   - Endpoint blocked    -> print short setup guidance, still exit 0
#                            (never fail the session over an optional skill).
set -u

HOST="api.anysearch.com"
URL="https://${HOST}"

# Probe through whatever proxy the environment configured (curl honors
# HTTPS_PROXY automatically). A blocked CONNECT yields http_code 000 and a
# non-zero exit; any HTTP response (even 4xx) means the host is reachable.
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$URL" 2>/dev/null)"
rc=$?

if [ "$rc" -eq 0 ] || { [ -n "$code" ] && [ "$code" != "000" ]; }; then
  # Reachable — nothing to report.
  exit 0
fi

cat <<'EOF'
[anysearch] Backend api.anysearch.com is NOT reachable from this environment
(egress policy is blocking it), so the `anysearch` skill cannot run here.

To enable it, edit this cloud environment's Network access:
  1. Open the environment for editing (cloud icon at claude.ai/code).
  2. Set Network access to "Custom".
  3. Add to Allowed domains:   api.anysearch.com
  4. Keep "Also include default list of common package managers" checked.
  5. Save and start a NEW session.

Details: .claude/skills/anysearch/SETUP.md
EOF
exit 0
