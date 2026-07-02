# Security Policy

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability.

Report security concerns privately to Peculiar Cloud through
<https://peculiar.cloud>. Include the affected version or commit, a description
of the issue, and enough detail to reproduce or assess the impact.

## Supported Versions

Security fixes are applied to the current `main` branch. This repository is a
small CLI rather than a long-lived service, so operators should update to the
latest release or commit after fixes are published.

## Secret Handling

This repository should not contain real tenant IDs, client IDs, client secrets,
Resend API keys, recipient lists, Healthchecks URLs, or secret-manager
references. Use `.env.example` only as a template and keep real values in your
scheduler or secret manager.
