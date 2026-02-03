import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateSessionCode, getAuthUrl, getConvexUrl } from "../auth.js";

describe("generateSessionCode", () => {
  it("should generate unique codes", () => {
    const code1 = generateSessionCode();
    const code2 = generateSessionCode();
    expect(code1).not.toBe(code2);
  });

  it("should start with pol_ prefix", () => {
    const code = generateSessionCode();
    expect(code).toMatch(/^pol_[a-f0-9]{32}$/);
  });

  it("should be 36 characters total", () => {
    const code = generateSessionCode();
    expect(code.length).toBe(36); // "pol_" (4) + 32 hex chars
  });
});

describe("getAuthUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default production URL", () => {
    delete process.env.POLYCHROMOS_APP_URL;
    const url = getAuthUrl("pol_test123");
    expect(url).toBe("https://app.polychromos.xyz/cli-auth?code=pol_test123");
  });

  it("should use environment variable when set", () => {
    process.env.POLYCHROMOS_APP_URL = "http://localhost:3001";
    const url = getAuthUrl("pol_test123");
    expect(url).toBe("http://localhost:3001/cli-auth?code=pol_test123");
  });

  it("should encode special characters", () => {
    const url = getAuthUrl("pol_test&code=bad");
    expect(url).toContain("pol_test%26code%3Dbad");
  });
});

describe("getConvexUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default production URL", () => {
    delete process.env.POLYCHROMOS_CONVEX_URL;
    const url = getConvexUrl();
    expect(url).toBe("https://dainty-toucan-799.convex.cloud");
  });

  it("should use environment variable when set", () => {
    process.env.POLYCHROMOS_CONVEX_URL = "http://127.0.0.1:3210";
    const url = getConvexUrl();
    expect(url).toBe("http://127.0.0.1:3210");
  });
});
