import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

describe("logout command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears credentials when logged in", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Pre-populate credentials
    const credsDir = `${homedir()}/.polychromos`;
    const credsPath = `${credsDir}/credentials.json`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(credsPath, JSON.stringify({ accessToken: "test_token" }));

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(vol.existsSync(credsPath)).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith("✓ Logged out successfully.");

    consoleSpy.mockRestore();
  });

  it("displays message when not logged in", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Not currently logged in.");

    consoleSpy.mockRestore();
  });

  it("handles missing credentials file gracefully", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Create directory but not file
    vol.mkdirSync(`${homedir()}/.polychromos`, { recursive: true });

    const { logoutCommand } = await import("../../commands/logout.js");
    await logoutCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Not currently logged in.");

    consoleSpy.mockRestore();
  });
});
