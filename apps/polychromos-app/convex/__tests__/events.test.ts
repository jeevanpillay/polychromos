/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const modules = import.meta.glob("../**/*.ts");

// Default test user identity
const testUser = {
  name: "Test User",
  email: "test@example.com",
  subject: "user_test_123",
  issuer: "https://clerk.test.com",
};

// Second test user for isolation tests
const otherUser = {
  name: "Other User",
  email: "other@example.com",
  subject: "user_other_456",
  issuer: "https://clerk.test.com",
};

describe("events mutations", () => {
  describe("recordEvent", () => {
    it("records event with patches and userId", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      // Create workspace first
      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const result = await asUser.mutation(api.events.recordEvent, {
        workspaceId,
        patches: [{ op: "replace", path: "/name", value: "Updated" }],
      });

      expect(result.version).toBe(1);

      const history = await asUser.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(1);
      expect(history[0]?.version).toBe(1);
      expect(history[0]?.patches[0]?.op).toBe("replace");
      expect(history[0]?.userId).toBe(testUser.subject);
    });

    it("rejects unauthenticated recordEvent", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await expect(
        t.mutation(api.events.recordEvent, {
          workspaceId,
          patches: [],
        }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("rejects recordEvent from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await expect(
        asOther.mutation(api.events.recordEvent, {
          workspaceId,
          patches: [],
        }),
      ).rejects.toThrow("Access denied");
    });

    it("includes timestamp", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const before = Date.now();

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await asUser.mutation(api.events.recordEvent, {
        workspaceId,
        patches: [],
      });

      const after = Date.now();
      const history = await asUser.query(api.events.getHistory, { workspaceId });

      expect(history[0]?.timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0]?.timestamp).toBeLessThanOrEqual(after);
    });

    it("records multiple events through workspace updates", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      // Events should be created through workspace updates, not recordEvent directly
      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "V1", components: {} },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "V2", components: {} },
        expectedVersion: 2,
      });

      const history = await asUser.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(2);
      expect(history[0]?.version).toBe(1);
      expect(history[1]?.version).toBe(2);
    });
  });

  describe("getHistory", () => {
    it("returns events in ascending order", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      // Create events through workspace updates
      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "V1", components: {} },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "V2", components: {} },
        expectedVersion: 2,
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "V3", components: {} },
        expectedVersion: 3,
      });

      const history = await asUser.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(3);
      expect(history[0]?.version).toBe(1);
      expect(history[1]?.version).toBe(2);
      expect(history[2]?.version).toBe(3);
    });

    it("returns empty array for workspace with no events", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const history = await asUser.query(api.events.getHistory, { workspaceId });

      expect(history).toEqual([]);
    });

    it("rejects getHistory from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await expect(
        asOther.query(api.events.getHistory, { workspaceId }),
      ).rejects.toThrow("Access denied");
    });

    it("rejects unauthenticated getHistory", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await expect(
        t.query(api.events.getHistory, { workspaceId }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("isolates events by workspace for same user", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspace1 = await asUser.mutation(api.workspaces.create, {
        name: "First",
        data: { id: "ws_1", version: "1.0", name: "First", components: {} },
      });

      const workspace2 = await asUser.mutation(api.workspaces.create, {
        name: "Second",
        data: { id: "ws_2", version: "1.0", name: "Second", components: {} },
      });

      await asUser.mutation(api.events.recordEvent, {
        workspaceId: workspace1,
        patches: [],
      });

      await asUser.mutation(api.events.recordEvent, {
        workspaceId: workspace2,
        patches: [],
      });

      const history1 = await asUser.query(api.events.getHistory, {
        workspaceId: workspace1,
      });
      const history2 = await asUser.query(api.events.getHistory, {
        workspaceId: workspace2,
      });

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
    });
  });
});
