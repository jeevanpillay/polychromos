import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../retry.js";

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("withRetry", () => {
    it("returns result on first successful attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on transient failure and succeeds", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("success");

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const promise = withRetry(fn);

      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Attempt 1/3 failed"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("does not retry on Unauthenticated error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Unauthenticated"));

      await expect(withRetry(fn)).rejects.toThrow("Unauthenticated");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on Access denied error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Access denied"));

      await expect(withRetry(fn)).rejects.toThrow("Access denied");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on Version conflict error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Version conflict"));

      await expect(withRetry(fn)).rejects.toThrow("Version conflict");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws after max attempts exceeded", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Persistent error"));

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      let caughtError: Error | undefined;
      const promise = withRetry(fn).catch((e: Error) => {
        caughtError = e;
      });

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      await promise;

      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toBe("Persistent error");
      expect(fn).toHaveBeenCalledTimes(3);

      consoleWarnSpy.mockRestore();
    });

    it("uses exponential backoff", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce("success");

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const promise = withRetry(fn);

      // First retry after 1000ms (1000 * 2^0)
      expect(fn).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);

      // Second retry after 2000ms (1000 * 2^1)
      expect(fn).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);

      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("retrying in 1000ms"),
      );
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("retrying in 2000ms"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("respects maxDelayMs option", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"))
        .mockRejectedValueOnce(new Error("Error 4"))
        .mockResolvedValueOnce("success");

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const promise = withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
      });

      // Advance through retries
      await vi.advanceTimersByTimeAsync(1000); // 1st retry: 1000ms
      await vi.advanceTimersByTimeAsync(2000); // 2nd retry: 2000ms
      await vi.advanceTimersByTimeAsync(3000); // 3rd retry: capped at 3000ms (not 4000ms)
      await vi.advanceTimersByTimeAsync(3000); // 4th retry: capped at 3000ms (not 8000ms)

      const result = await promise;
      expect(result).toBe("success");

      // Check delays are capped
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("retrying in 3000ms"),
      );
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("retrying in 3000ms"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("accepts custom options", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error"))
        .mockResolvedValueOnce("success");

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      const promise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 500 });

      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe("success");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("retrying in 500ms"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("converts non-Error objects to Error", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow(
        "string error",
      );
    });
  });
});
