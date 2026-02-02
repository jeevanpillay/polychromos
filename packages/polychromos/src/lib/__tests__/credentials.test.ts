import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";
import type { TokenData } from "../credentials.js";

describe("credentials", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    delete process.env.POLYCHROMOS_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    delete process.env.POLYCHROMOS_TOKEN;
  });

  describe("saveCredentials", () => {
    it("creates .polychromos directory if not exists", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({ accessToken: "test" });

      expect(vol.existsSync(`${homedir()}/.polychromos`)).toBe(true);
    });

    it("writes credentials to file", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({
        accessToken: "test_token",
        refreshToken: "refresh_token",
        expiresAt: 1234567890,
      });

      const content = vol.readFileSync(
        `${homedir()}/.polychromos/credentials.json`,
        "utf-8",
      ) as string;
      const creds = JSON.parse(content) as TokenData;

      expect(creds.accessToken).toBe("test_token");
      expect(creds.refreshToken).toBe("refresh_token");
      expect(creds.expiresAt).toBe(1234567890);
    });

    it("overwrites existing credentials", async () => {
      const { saveCredentials } = await import("../credentials.js");

      await saveCredentials({ accessToken: "first" });
      await saveCredentials({ accessToken: "second" });

      const content = vol.readFileSync(
        `${homedir()}/.polychromos/credentials.json`,
        "utf-8",
      ) as string;
      const creds = JSON.parse(content) as TokenData;

      expect(creds.accessToken).toBe("second");
    });
  });

  describe("loadCredentials", () => {
    it("returns credentials from file", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "file_token" }),
      );

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds?.accessToken).toBe("file_token");
    });

    it("prefers POLYCHROMOS_TOKEN env var over file", async () => {
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      process.env.POLYCHROMOS_TOKEN = "env_token";

      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "file_token" }),
      );

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds?.accessToken).toBe("env_token");
    });

    it("returns null when no credentials exist", async () => {
      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds).toBeNull();
    });

    it("returns null for invalid JSON", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(`${credsDir}/credentials.json`, "invalid json");

      const { loadCredentials } = await import("../credentials.js");
      const creds = await loadCredentials();

      expect(creds).toBeNull();
    });
  });

  describe("clearCredentials", () => {
    it("removes credentials file", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      const credsPath = `${credsDir}/credentials.json`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(credsPath, JSON.stringify({ accessToken: "test" }));

      const { clearCredentials } = await import("../credentials.js");
      await clearCredentials();

      expect(vol.existsSync(credsPath)).toBe(false);
    });

    it("does not throw when file does not exist", async () => {
      const { clearCredentials } = await import("../credentials.js");

      await expect(clearCredentials()).resolves.not.toThrow();
    });
  });

  describe("getValidToken", () => {
    it("returns token when valid", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "valid_token" }),
      );

      const { getValidToken } = await import("../credentials.js");
      const token = await getValidToken();

      expect(token).toBe("valid_token");
    });

    it("throws when not authenticated", async () => {
      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow(
        "Not authenticated. Run `polychromos login` first.",
      );
    });

    it("throws when token expired", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({
          accessToken: "expired_token",
          expiresAt: Date.now() - 1000, // Already expired
        }),
      );

      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow(
        "Token expired. Run `polychromos login` to refresh.",
      );
    });

    it("throws when expiry is within buffer", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({
          accessToken: "almost_expired_token",
          expiresAt: Date.now() + 4 * 60 * 1000, // 4 minutes from now (within 5 min buffer)
        }),
      );

      const { getValidToken } = await import("../credentials.js");

      await expect(getValidToken()).rejects.toThrow("Token expired");
    });

    it("returns token when no expiry set", async () => {
      const credsDir = `${homedir()}/.polychromos`;
      vol.mkdirSync(credsDir, { recursive: true });
      vol.writeFileSync(
        `${credsDir}/credentials.json`,
        JSON.stringify({ accessToken: "no_expiry_token" }),
      );

      const { getValidToken } = await import("../credentials.js");
      const token = await getValidToken();

      expect(token).toBe("no_expiry_token");
    });
  });
});
