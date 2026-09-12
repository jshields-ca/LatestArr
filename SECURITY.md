# Security Policy

LatestArr is designed to be safely exposable to the public internet, so we take
security reports seriously.

## Supported Versions

LatestArr is currently in pre-release, active development. Until a `1.0`
release is tagged, security fixes will only target the `main` branch — there
is no separate maintenance/patch track yet.

| Version | Supported |
| --- | --- |
| `main` (pre-1.0) | ✅ |

This table will be updated once tagged releases exist.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately using one of these methods:

1. **Preferred:** [GitHub Security Advisories](../../security/advisories/new) for
   this repository — this lets us discuss and fix the issue privately before
   public disclosure.
2. **Alternative:** email **jeremy.shields@gmail.com** with details.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce (a minimal reproduction is very helpful).
- Any relevant logs, configuration, or version information.

## What to expect

- We aim to acknowledge reports within a few days.
- We'll work with you to understand and validate the issue, and to agree on a
  disclosure timeline once a fix is available.
- Credit will be given in the fix's release notes unless you prefer to remain
  anonymous.

## Scope

Given the project's design goals, we're especially interested in reports
involving:

- Authentication/authorization bypass (local auth or OIDC/SSO flows)
- Credential handling (source connection tokens, SMTP credentials, encryption
  at rest)
- Injection vulnerabilities (SQL, template/HTML injection in the newsletter
  builder or rendered emails, SSRF via source connection URLs)
- Cross-site scripting (XSS) or cross-site request forgery (CSRF) in the admin
  WebUI
- Privilege escalation between user roles
