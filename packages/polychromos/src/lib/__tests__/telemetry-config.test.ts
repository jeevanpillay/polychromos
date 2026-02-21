import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

vi.mock("fs", async () => {
  const memfs = await import("memfs");
  return memfs.fs;
});

const CONFIG_DIR = `${homedir()}/.polychromos`;
const CONFIG_FILE = `${CONFIG_DIR}/config.json`;

describe("telemetry-config", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.resetModules();

    delete process.env.POLYCHROMOS_TELEMETRY_DISABLED;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    delete process.env.POLYCHROMOS_TELEMETRY_DISABLED;
  });

  describe("loadTelemetryConfig", () => {
    it("returns empty object when config file does not exist", async () => {
      const { loadTelemetryConfig } = await import("../telemetry-config.js");
      const config = loadTelemetryConfig();

      expect(config).toEqual({});
    });

    it("returns parsed config from file", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ telemetryEnabled: false, telemetryConsentAsked: true }),
      );

      const { loadTelemetryConfig } = await import("../telemetry-config.js");
      const config = loadTelemetryConfig();

      expect(config.telemetryEnabled).toBe(false);
      expect(config.telemetryConsentAsked).toBe(true);
    });

    it("returns empty object for invalid JSON", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(CONFIG_FILE, "not valid json{{{");

      const { loadTelemetryConfig } = await import("../telemetry-config.js");
      const config = loadTelemetryConfig();

      expect(config).toEqual({});
    });
  });

  describe("saveTelemetryConfig", () => {
    it("creates config directory and file", async () => {
      const { saveTelemetryConfig } = await import("../telemetry-config.js");
      saveTelemetryConfig({ telemetryEnabled: true });

      expect(vol.existsSync(CONFIG_DIR)).toBe(true);
      expect(vol.existsSync(CONFIG_FILE)).toBe(true);

      const content = vol.readFileSync(CONFIG_FILE, "utf-8") as string;
      const config = JSON.parse(content) as { telemetryEnabled: boolean };
      expect(config.telemetryEnabled).toBe(true);
    });

    it("merges with existing config", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ existingKey: "value" }),
      );

      const { saveTelemetryConfig } = await import("../telemetry-config.js");
      saveTelemetryConfig({ telemetryEnabled: false });

      const content = vol.readFileSync(CONFIG_FILE, "utf-8") as string;
      const config = JSON.parse(content) as Record<string, unknown>;
      expect(config.existingKey).toBe("value");
      expect(config.telemetryEnabled).toBe(false);
    });
  });

  describe("isTelemetryEnabled", () => {
    it("returns true by default when no config exists", async () => {
      const { isTelemetryEnabled } = await import("../telemetry-config.js");
      expect(isTelemetryEnabled()).toBe(true);
    });

    it("returns false when POLYCHROMOS_TELEMETRY_DISABLED=1", async () => {
      process.env.POLYCHROMOS_TELEMETRY_DISABLED = "1";

      const { isTelemetryEnabled } = await import("../telemetry-config.js");
      expect(isTelemetryEnabled()).toBe(false);
    });

    it("env var takes precedence over config", async () => {
      process.env.POLYCHROMOS_TELEMETRY_DISABLED = "1";
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ telemetryEnabled: true }),
      );

      const { isTelemetryEnabled } = await import("../telemetry-config.js");
      expect(isTelemetryEnabled()).toBe(false);
    });

    it("returns false when config disables telemetry", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ telemetryEnabled: false }),
      );

      const { isTelemetryEnabled } = await import("../telemetry-config.js");
      expect(isTelemetryEnabled()).toBe(false);
    });

    it("returns true when config enables telemetry", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ telemetryEnabled: true }),
      );

      const { isTelemetryEnabled } = await import("../telemetry-config.js");
      expect(isTelemetryEnabled()).toBe(true);
    });
  });

  describe("hasAskedForConsent", () => {
    it("returns false when no config exists", async () => {
      const { hasAskedForConsent } = await import("../telemetry-config.js");
      expect(hasAskedForConsent()).toBe(false);
    });

    it("returns true when consent was asked", async () => {
      vol.mkdirSync(CONFIG_DIR, { recursive: true });
      vol.writeFileSync(
        CONFIG_FILE,
        JSON.stringify({ telemetryConsentAsked: true }),
      );

      const { hasAskedForConsent } = await import("../telemetry-config.js");
      expect(hasAskedForConsent()).toBe(true);
    });
  });

  describe("setTelemetryEnabled", () => {
    it("persists enabled state and marks consent asked", async () => {
      const { setTelemetryEnabled } = await import("../telemetry-config.js");
      setTelemetryEnabled(true);

      const content = vol.readFileSync(CONFIG_FILE, "utf-8") as string;
      const config = JSON.parse(content) as {
        telemetryEnabled: boolean;
        telemetryConsentAsked: boolean;
      };
      expect(config.telemetryEnabled).toBe(true);
      expect(config.telemetryConsentAsked).toBe(true);
    });

    it("persists disabled state and marks consent asked", async () => {
      const { setTelemetryEnabled } = await import("../telemetry-config.js");
      setTelemetryEnabled(false);

      const content = vol.readFileSync(CONFIG_FILE, "utf-8") as string;
      const config = JSON.parse(content) as {
        telemetryEnabled: boolean;
        telemetryConsentAsked: boolean;
      };
      expect(config.telemetryEnabled).toBe(false);
      expect(config.telemetryConsentAsked).toBe(true);
    });
  });
});
