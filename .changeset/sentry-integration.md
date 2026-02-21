---
"polychromos": minor
---

Add Sentry error tracking with opt-out telemetry

**CLI Changes:**
- Added anonymous error reporting to help improve the CLI
- New `polychromos telemetry` command to manage preferences (enable/disable/status)
- Telemetry is **enabled by default** with easy opt-out
- Run `polychromos telemetry disable` or set `POLYCHROMOS_TELEMETRY_DISABLED=1` to opt out
- PII scrubbing: file paths with usernames are anonymized
- Preferences stored in `~/.polychromos/config.json`

**What's Collected:**
- Error messages and stack traces (PII scrubbed)
- CLI version and command that failed
- Operating system type

**What's NOT Collected:**
- File contents or project details
- Personal information or credentials
- Complete file paths (usernames anonymized)

Learn more: https://polychromos.dev/telemetry
