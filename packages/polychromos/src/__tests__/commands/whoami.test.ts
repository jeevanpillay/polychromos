import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

// Mock ConvexHttpClient
const mockQuery = vi.fn();
const mockSetAuth = vi.fn();
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    setAuth: mockSetAuth,
  })),
}));

describe("whoami command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();

    // Re-setup mock after module reset
    vi.doMock("convex/browser", () => ({
      ConvexHttpClient: vi.fn().mockImplementation(() => ({
        query: mockQuery,
        setAuth: mockSetAuth,
      })),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    delete process.env.POLYCHROMOS_TOKEN;
  });

  it("displays login prompt when not authenticated", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Not logged in. Run `polychromos login` to authenticate.",
    );

    consoleSpy.mockRestore();
  });

  it("displays init prompt when logged in but no config", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Add credentials but no config
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" }),
    );

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Logged in, but no project configured.",
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("polychromos init"),
    );

    consoleSpy.mockRestore();
  });

  it("displays auth status when fully configured", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Add credentials
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" }),
    );

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      }),
    );

    // Mock successful query
    mockQuery.mockResolvedValue([{ id: "ws_1" }, { id: "ws_2" }]);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(mockSetAuth).toHaveBeenCalledWith("test_token");
    expect(consoleSpy).toHaveBeenCalledWith("✓ Authenticated");
    expect(consoleSpy).toHaveBeenCalledWith("  Workspaces: 2");
    expect(consoleSpy).toHaveBeenCalledWith(
      "  Convex URL: https://test.convex.cloud",
    );

    consoleSpy.mockRestore();
  });

  it("displays error when token is invalid", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Add credentials
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "invalid_token" }),
    );

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      }),
    );

    // Mock authentication error
    mockQuery.mockRejectedValue(new Error("Unauthenticated"));

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Token invalid or expired. Run `polychromos login` to re-authenticate.",
    );

    consoleSpy.mockRestore();
  });

  it("displays generic error for non-auth failures", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    // Add credentials and config
    const credsDir = `${homedir()}/.polychromos`;
    vol.mkdirSync(credsDir, { recursive: true });
    vol.writeFileSync(
      `${credsDir}/credentials.json`,
      JSON.stringify({ accessToken: "test_token" }),
    );
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      }),
    );

    // Mock network error
    mockQuery.mockRejectedValue(new Error("Network error"));

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error verifying authentication:",
      "Network error",
    );

    consoleSpy.mockRestore();
  });

  it("uses POLYCHROMOS_TOKEN env var when available", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Set env var instead of file
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    process.env.POLYCHROMOS_TOKEN = "env_token";

    // Add project config
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(
      `${process.cwd()}/.polychromos/config.json`,
      JSON.stringify({
        convexUrl: "https://test.convex.cloud",
        workspaceId: "ws_123",
      }),
    );

    mockQuery.mockResolvedValue([]);

    const { whoamiCommand } = await import("../../commands/whoami.js");
    await whoamiCommand();

    expect(mockSetAuth).toHaveBeenCalledWith("env_token");

    consoleSpy.mockRestore();
  });
});
