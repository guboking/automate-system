# AnySearch — Setup & Network Allowlist

The `anysearch` skill calls a single external backend:

```
https://api.anysearch.com/mcp
```

The endpoint is hard-coded in the CLI scripts (`scripts/anysearch_cli.*`); there
is **no** option to point it at a different host or route it through a custom
proxy. So if that host is not reachable, the skill cannot work — every call
returns `Connection Error: Unable to reach the API endpoint.`

## Why it may fail on Claude Code (web/cloud)

Cloud environments run behind a security proxy with an egress allowlist. The
default **Trusted** policy allows package registries, GitHub, and cloud SDKs —
but **not** `api.anysearch.com`. A blocked request shows up as a proxy
`403 (CONNECT tunnel failed)`. This is a policy denial, not a network outage;
it must **not** be worked around by tunneling or rewriting hosts.

## Fix: allow the domain (one-time, per environment)

1. At [claude.ai/code](https://claude.ai/code), open the cloud environment for
   editing (the cloud icon where you start a session or configure a routine).
2. In the **Network access** selector, choose **Custom**.
3. In the **Allowed domains** field, add (one per line):
   ```
   api.anysearch.com
   ```
4. Leave **Also include default list of common package managers** checked so
   npm / PyPI / GitHub etc. keep working.
5. Save, then start a **new** session — network policy is applied at
   environment create/edit time, not mid-session.

> Alternatively, set the access level to **Full** (allows any domain). That
> works but is broader than needed; **Custom** with just this host is tighter.

Running outside the cloud (e.g. your local machine) usually needs none of this,
since local egress is unrestricted.

## Verify

After re-opening a session:

```bash
python3 .claude/skills/anysearch/scripts/anysearch_cli.py search "bitcoin price"
```

Success = real JSON results instead of `Connection Error`. A `SessionStart`
hook (`scripts/check_egress.sh`, wired in `.claude/settings.json`) also probes
this automatically and prints a reminder only when the host is still blocked.

## Optional: API key

Anonymous access works but is rate-limited. For higher limits, create
`.claude/skills/anysearch/.env` (gitignored) with:

```
ANYSEARCH_API_KEY=<your_key>
```

Get a key at <https://anysearch.com/settings/api-keys>.
