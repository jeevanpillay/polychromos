import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Event, EventHint } from "@sentry/node";

const mockInit = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();
const mockSetUser = vi.fn();

vi.mock("@sentry/node", () => ({
  init: mockInit,
  close: mockClose,
  captureException: mockCaptureException,
  setUser: mockSetUser,
}));

vi.mock("fs", async () => {
  const memfs = await import("memfs");
  return memfs.fs;
});

describe("sentry", () => {
  let savedBeforeSend: ((event: Event, hint?: EventHint) => Event | null) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    delete process.env.POLYCHROMOS_TELEMETRY_DISABLED;

    // Capture the beforeSend callback from Sentry.init
    mockInit.mockImplementation((options: { beforeSend?: (event: Event, hint?: EventHint) => Event | null }) => {
      savedBeforeSend = options.beforeSend;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    savedBeforeSend = undefined;

    delete process.env.POLYCHROMOS_TELEMETRY_DISABLED;
  });

  describe("initSentry", () => {
    it("calls Sentry.init with DSN and release", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      expect(mockInit).toHaveBeenCalledOnce();
      const options = mockInit.mock.calls[0]![0] as Record<string, unknown>;
      expect(options.dsn).toContain("sentry.io");
      expect(options.release).toMatch(/^polychromos-cli@/);
      expect(options.beforeSend).toBeTypeOf("function");
    });
  });

  describe("beforeSend", () => {
    it("drops events when POLYCHROMOS_TELEMETRY_DISABLED=1", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      process.env.POLYCHROMOS_TELEMETRY_DISABLED = "1";

      const event: Event = { exception: { values: [] } };
      const result = savedBeforeSend!(event);

      expect(result).toBeNull();
    });

    it("passes events when telemetry is enabled", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      const event: Event = { message: "test" };
      const result = savedBeforeSend!(event);

      expect(result).not.toBeNull();
    });

    it("scrubs macOS file paths", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      const event: Event = {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  { filename: "/Users/jeevan/project/src/index.ts" },
                ],
              },
            },
          ],
        },
      };

      const result = savedBeforeSend!(event);

      expect(result!.exception!.values![0]!.stacktrace!.frames![0]!.filename).toBe(
        "/Users/***/project/src/index.ts",
      );
    });

    it("scrubs Linux file paths", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      const event: Event = {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  { filename: "/home/jeevan/project/src/index.ts" },
                ],
              },
            },
          ],
        },
      };

      const result = savedBeforeSend!(event);

      expect(result!.exception!.values![0]!.stacktrace!.frames![0]!.filename).toBe(
        "/home/***/project/src/index.ts",
      );
    });

    it("scrubs Windows file paths", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      const event: Event = {
        exception: {
          values: [
            {
              stacktrace: {
                frames: [
                  { filename: "C:\\Users\\jeevan\\project\\src\\index.ts" },
                ],
              },
            },
          ],
        },
      };

      const result = savedBeforeSend!(event);

      expect(result!.exception!.values![0]!.stacktrace!.frames![0]!.filename).toBe(
        "C:\\Users\\***\\project\\src\\index.ts",
      );
    });

    it("passes events without exceptions unchanged", async () => {
      const { initSentry } = await import("../sentry.js");
      initSentry();

      const event: Event = { message: "simple message" };
      const result = savedBeforeSend!(event);

      expect(result).toEqual(event);
    });
  });

  describe("closeSentry", () => {
    it("calls Sentry.close with 2000ms timeout", async () => {
      const { closeSentry } = await import("../sentry.js");
      await closeSentry();

      expect(mockClose).toHaveBeenCalledWith(2000);
    });
  });

  describe("captureException", () => {
    it("forwards error to Sentry.captureException", async () => {
      const { captureException } = await import("../sentry.js");
      const error = new Error("test error");
      captureException(error);

      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });
  });

  describe("setUser", () => {
    it("calls Sentry.setUser with user ID", async () => {
      const { setUser } = await import("../sentry.js");
      setUser("user_123");

      expect(mockSetUser).toHaveBeenCalledWith({ id: "user_123" });
    });
  });
});
