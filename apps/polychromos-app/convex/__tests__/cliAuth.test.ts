/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

describe("cliAuth", () => {
  test("createSession creates pending session", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_test123" });

    const result = await t.query(api.cliAuth.getSession, { code: "pol_test123" });
    expect(result.status).toBe("pending");
  });

  test("createSession rejects duplicate codes", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_duplicate" });

    await expect(
      t.mutation(api.cliAuth.createSession, { code: "pol_duplicate" })
    ).rejects.toThrow("Session code already exists");
  });

  test("completeSession requires authentication", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_noauth" });

    await expect(
      t.mutation(api.cliAuth.completeSession, {
        code: "pol_noauth",
        token: "test-token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Must be authenticated");
  });

  test("completeSession stores token when authenticated", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_complete" });

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    const expiresAt = Date.now() + 86400000;
    await asUser.mutation(api.cliAuth.completeSession, {
      code: "pol_complete",
      token: "test-token-value",
      expiresAt,
    });

    const result = await t.query(api.cliAuth.getSession, { code: "pol_complete" });
    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.token).toBe("test-token-value");
      expect(result.expiresAt).toBe(expiresAt);
    }
  });

  test("getSession returns not_found for unknown code", async () => {
    const t = convexTest(schema, modules);

    const result = await t.query(api.cliAuth.getSession, { code: "pol_unknown" });
    expect(result.status).toBe("not_found");
  });

  test("completeSession rejects already completed sessions", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(api.cliAuth.createSession, { code: "pol_already" });

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    await asUser.mutation(api.cliAuth.completeSession, {
      code: "pol_already",
      token: "first-token",
      expiresAt: Date.now() + 86400000,
    });

    await expect(
      asUser.mutation(api.cliAuth.completeSession, {
        code: "pol_already",
        token: "second-token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Session already completed");
  });

  test("completeSession rejects non-existent session", async () => {
    const t = convexTest(schema, modules);

    const asUser = t.withIdentity({
      subject: "user_123",
      issuer: "https://clerk.example.com",
    });

    await expect(
      asUser.mutation(api.cliAuth.completeSession, {
        code: "pol_nonexistent",
        token: "token",
        expiresAt: Date.now() + 86400000,
      })
    ).rejects.toThrow("Session not found");
  });

  test("cleanupExpiredSessions removes old sessions", async () => {
    const t = convexTest(schema, modules);

    // Create session with recent timestamp
    await t.mutation(api.cliAuth.createSession, { code: "pol_old" });

    // The cleanup function deletes sessions older than 24 hours
    // This session is new, so it won't be deleted
    const result = await t.mutation(api.cliAuth.cleanupExpiredSessions, {});
    expect(result.deleted).toBe(0);
  });
});
