import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";

// Mock all external dependencies
vi.mock("open", () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: vi.fn(),
    query: vi.fn(),
  })),
}));

describe("loginCommand", () => {
  const originalEnv = process.env;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    process.env = { ...originalEnv };
    mockExit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("should open browser with auth URL", async () => {
    const open = (await import("open")).default;
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        status: "completed",
        token: "test-token",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as never);

    await loginCommand();

    expect(open).toHaveBeenCalledWith(expect.stringContaining("/cli-auth?code=pol_"));
  });

  it("should save credentials on successful auth", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const testToken = "test-token-123";
    const testExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        status: "completed",
        token: testToken,
        expiresAt: testExpiry,
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as never);

    await loginCommand();

    // Verify credentials were saved
    const credsPath = `${homedir()}/.polychromos/credentials.json`;
    expect(vol.existsSync(credsPath)).toBe(true);

    const credsContent = vol.readFileSync(credsPath, "utf-8") as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const creds = JSON.parse(credsContent);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(creds.accessToken).toBe(testToken);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(creds.expiresAt).toBe(testExpiry);
  });

  it("should exit on session expiry", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ status: "expired" }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as never);

    await expect(loginCommand()).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit on session not found", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ status: "not_found" }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as never);

    await expect(loginCommand()).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should poll until completion", async () => {
    const { ConvexHttpClient } = await import("convex/browser");
    const { loginCommand } = await import("../../commands/login.js");

    let pollCount = 0;
    const mockClient = {
      mutation: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation(() => {
        pollCount++;
        if (pollCount < 3) {
          return Promise.resolve({ status: "pending" });
        }
        return Promise.resolve({
          status: "completed",
          token: "test-token",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      }),
    };
    vi.mocked(ConvexHttpClient).mockImplementation(() => mockClient as never);

    await loginCommand();

    expect(pollCount).toBeGreaterThanOrEqual(3);
  });
});
