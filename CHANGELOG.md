# Changelog

All notable changes to Entra Credential Monitor are documented here.

## 2.0.0 - 2026-07-02

- Prepared the project as a public, reusable CLI with sanitized examples and no
  required dependency on 1Password or any specific secret manager.
- Added GitHub Actions deployment documentation, Mermaid diagrams, security
  policy, Renovate configuration, and a generated example report screenshot.
- Added configurable report presentation with `REPORT_TIMEZONE`,
  `REPORT_BRAND_NAME`, and `REPORT_BRAND_URL`.
- Replaced hand-rolled logging with Pino structured logging and configurable
  `LOG_LEVEL`.
- Kept default Peculiar Cloud HTML email links attributable without exposing UTM
  parameters in visible README or plain-text report URLs.
- Tightened tenant configuration validation so malformed single-tenant settings
  fail loudly.
