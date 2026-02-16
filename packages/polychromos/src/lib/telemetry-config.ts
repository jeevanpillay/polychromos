import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".polychromos");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface GlobalConfig {
  telemetryEnabled?: boolean;
  telemetryConsentAsked?: boolean;
}

export function loadTelemetryConfig(): GlobalConfig {
  try {
    if (!existsSync(CONFIG_FILE)) {
      return {};
    }
    const content = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content) as GlobalConfig;
  } catch {
    return {};
  }
}

export function saveTelemetryConfig(config: GlobalConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const existing = loadTelemetryConfig();
    const merged = { ...existing, ...config };
    writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch {
    // Silent failure - telemetry config is non-critical
  }
}

export function isTelemetryEnabled(): boolean {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1") {
    return false;
  }
  const config = loadTelemetryConfig();
  // Enabled by default - users must explicitly opt out
  return config.telemetryEnabled ?? true;
}

export function hasAskedForConsent(): boolean {
  const config = loadTelemetryConfig();
  return config.telemetryConsentAsked ?? false;
}

export function setTelemetryEnabled(enabled: boolean): void {
  saveTelemetryConfig({
    telemetryEnabled: enabled,
    telemetryConsentAsked: true,
  });
}
