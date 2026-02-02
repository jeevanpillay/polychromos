import { describe, it, expect } from "vitest";
import { getVersion } from "../version.js";

describe("version", () => {
  describe("getVersion", () => {
    it("returns a valid semver version string", () => {
      const version = getVersion();

      // Should be a valid semver format (x.y.z or x.y.z-prerelease)
      expect(version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
    });

    it("returns the same value on subsequent calls (caching)", () => {
      const version1 = getVersion();
      const version2 = getVersion();

      expect(version1).toBe(version2);
    });

    it("does not return 'unknown' in normal operation", () => {
      const version = getVersion();

      expect(version).not.toBe("unknown");
    });
  });
});
