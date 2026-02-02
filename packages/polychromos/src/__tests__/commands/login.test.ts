import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";
import { homedir } from "os";
import type { TokenData } from "../../lib/credentials.js";

// Mock readline
const mockQuestion = vi.fn();
const mockClose = vi.fn();
vi.mock("readline", () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  })),
}));

describe("login command", () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync(homedir(), { recursive: true });
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves credentials when valid token provided", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    // Simulate user entering a token
    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        callback("test_token_123");
      },
    );

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    // Verify credentials were saved
    const credsPath = `${homedir()}/.polychromos/credentials.json`;
    expect(vol.existsSync(credsPath)).toBe(true);

    const creds = JSON.parse(
      vol.readFileSync(credsPath, "utf-8") as string,
    ) as TokenData;
    expect(creds.accessToken).toBe("test_token_123");

    expect(consoleSpy).toHaveBeenCalledWith("✓ Login successful!");
    consoleSpy.mockRestore();
  });

  it("exits with error when empty token provided", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        callback("");
      },
    );

    const { loginCommand } = await import("../../commands/login.js");
    await expect(loginCommand()).rejects.toThrow("process.exit(1)");

    expect(consoleSpy).toHaveBeenCalledWith(
      "No token provided. Login cancelled.",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("exits with error when whitespace-only token provided", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        callback("   \n\t  ");
      },
    );

    const { loginCommand } = await import("../../commands/login.js");
    await expect(loginCommand()).rejects.toThrow("process.exit(1)");

    expect(consoleSpy).toHaveBeenCalledWith(
      "No token provided. Login cancelled.",
    );

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("trims whitespace from token", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        callback("  token_with_spaces  \n");
      },
    );

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    const credsPath = `${homedir()}/.polychromos/credentials.json`;
    const creds = JSON.parse(
      vol.readFileSync(credsPath, "utf-8") as string,
    ) as TokenData;
    expect(creds.accessToken).toBe("token_with_spaces");

    consoleSpy.mockRestore();
  });

  it("displays instructions before prompting", async () => {
    const consoleSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    mockQuestion.mockImplementation(
      (prompt: string, callback: (answer: string) => void) => {
        callback("token");
      },
    );

    const { loginCommand } = await import("../../commands/login.js");
    await loginCommand();

    expect(consoleSpy).toHaveBeenCalledWith("Polychromos CLI Login");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("__session"),
    );

    consoleSpy.mockRestore();
  });
});
