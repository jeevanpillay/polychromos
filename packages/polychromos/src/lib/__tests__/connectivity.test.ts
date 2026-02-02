import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkConnectivity,
  getConnectivityState,
  shouldRecheck,
  resetConnectivityState,
} from "../connectivity.js";

describe("connectivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetConnectivityState();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("checkConnectivity", () => {
    it("returns online when fetch succeeds", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());

      const result = await checkConnectivity("https://convex.example.com");

      expect(result).toBe("online");
      expect(getConnectivityState()).toBe("online");
    });

    it("returns offline when fetch fails", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

      const result = await checkConnectivity("https://convex.example.com");

      expect(result).toBe("offline");
      expect(getConnectivityState()).toBe("offline");
    });

    it("returns offline when fetch is aborted", async () => {
      // Simulate an abort error which is what happens on timeout
      vi.mocked(fetch).mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

      const result = await checkConnectivity("https://convex.example.com");

      expect(result).toBe("offline");
    });

    it("makes HEAD request to provided URL", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());

      await checkConnectivity("https://my-convex.cloud.com");

      expect(fetch).toHaveBeenCalledWith(
        "https://my-convex.cloud.com",
        expect.objectContaining({
          method: "HEAD",
        }),
      );
    });
  });

  describe("getConnectivityState", () => {
    it("returns unknown initially", () => {
      expect(getConnectivityState()).toBe("unknown");
    });

    it("returns last known state", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());
      await checkConnectivity("https://example.com");

      expect(getConnectivityState()).toBe("online");

      vi.mocked(fetch).mockRejectedValueOnce(new Error("Offline"));
      await checkConnectivity("https://example.com");

      expect(getConnectivityState()).toBe("offline");
    });
  });

  describe("shouldRecheck", () => {
    it("returns true initially (never checked)", () => {
      expect(shouldRecheck()).toBe(true);
    });

    it("returns false immediately after check", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());
      await checkConnectivity("https://example.com");

      expect(shouldRecheck()).toBe(false);
    });

    it("returns true after 30 seconds", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());
      await checkConnectivity("https://example.com");

      expect(shouldRecheck()).toBe(false);

      // Advance 30 seconds
      vi.advanceTimersByTime(30001);

      expect(shouldRecheck()).toBe(true);
    });
  });

  describe("resetConnectivityState", () => {
    it("resets state to unknown", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response());
      await checkConnectivity("https://example.com");
      expect(getConnectivityState()).toBe("online");

      resetConnectivityState();

      expect(getConnectivityState()).toBe("unknown");
      expect(shouldRecheck()).toBe(true);
    });
  });
});
