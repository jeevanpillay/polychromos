/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";

import { api } from "../_generated/api";
import schema from "../schema";

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const modules = import.meta.glob("../**/*.ts");

interface WorkspaceData {
  name: string;
  [key: string]: unknown;
}

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

describe("workspaces mutations", () => {
  describe("create", () => {
    it("creates a workspace with ownerId from identity", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test Workspace",
        data: {
          id: "ws_123",
          version: "1.0",
          name: "Test",
          components: {},
        },
      });

      expect(workspaceId).toBeDefined();

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      expect(workspace?.name).toBe("Test Workspace");
      expect(workspace?.ownerId).toBe(testUser.subject);
      expect(workspace?.version).toBe(1);
    });

    it("rejects unauthenticated create", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(api.workspaces.create, {
          name: "Test",
          data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
        }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("initializes eventVersion and maxEventVersion to 0", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.eventVersion).toBe(0);
      expect(workspace?.maxEventVersion).toBe(0);
    });

    it("stores baseData equal to initial data", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const initialData = {
        id: "ws_1",
        version: "1.0",
        name: "Test",
        components: {},
      };

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: initialData,
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.baseData).toEqual(initialData);
    });

    it("sets createdAt and updatedAt timestamps", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const before = Date.now();

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const after = Date.now();
      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.createdAt).toBeGreaterThanOrEqual(before);
      expect(workspace?.createdAt).toBeLessThanOrEqual(after);
      expect(workspace?.updatedAt).toBe(workspace?.createdAt);
    });
  });

  describe("list", () => {
    it("returns only workspaces owned by current user", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      // User creates a workspace
      await asUser.mutation(api.workspaces.create, {
        name: "User Workspace",
        data: { id: "ws_1", version: "1.0", name: "User", components: {} },
      });

      // Other user creates a workspace
      await asOther.mutation(api.workspaces.create, {
        name: "Other Workspace",
        data: { id: "ws_2", version: "1.0", name: "Other", components: {} },
      });

      // User only sees their own workspace
      const userWorkspaces = await asUser.query(api.workspaces.list, {});
      expect(userWorkspaces).toHaveLength(1);
      expect(userWorkspaces[0]?.name).toBe("User Workspace");

      // Other user only sees their own workspace
      const otherWorkspaces = await asOther.query(api.workspaces.list, {});
      expect(otherWorkspaces).toHaveLength(1);
      expect(otherWorkspaces[0]?.name).toBe("Other Workspace");
    });

    it("returns empty array for unauthenticated users", async () => {
      const t = convexTest(schema, modules);

      const workspaces = await t.query(api.workspaces.list, {});

      expect(workspaces).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns workspace by id for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace?.name).toBe("Test");
    });

    it("returns null for other user's workspace", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "User's Private Workspace",
        data: { id: "ws_1", version: "1.0", name: "Private", components: {} },
      });

      // Other user tries to get it
      const workspace = await asOther.query(api.workspaces.get, {
        id: workspaceId,
      });

      expect(workspace).toBeNull();
    });

    it("returns null for unauthenticated users", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      // Unauthenticated query
      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace).toBeNull();
    });
  });

  describe("update", () => {
    it("updates workspace for owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
        expectedVersion: 1,
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      const data = workspace?.data as WorkspaceData;
      expect(data.name).toBe("Updated");
      expect(workspace?.version).toBe(2);
    });

    it("rejects update from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await expect(
        asOther.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: "ws_1", version: "1.0", name: "Hacked", components: {} },
          expectedVersion: 1,
        }),
      ).rejects.toThrow("Access denied");
    });

    it("rejects unauthenticated update", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await expect(
        t.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: "ws_1", version: "1.0", name: "Hacked", components: {} },
          expectedVersion: 1,
        }),
      ).rejects.toThrow("Unauthenticated");
    });

    it("increments eventVersion and maxEventVersion on update", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      expect(workspace?.eventVersion).toBe(1);
      expect(workspace?.maxEventVersion).toBe(1);
    });

    it("records event with userId", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      const history = await asUser.query(api.events.getHistory, { workspaceId });
      expect(history).toHaveLength(1);
      expect(history[0]?.userId).toBe(testUser.subject);
    });

    it("skips update when no actual changes", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const data = { name: "Same" };

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data,
      });

      const result = await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data, // Same data
        expectedVersion: 1,
      });

      expect(result.noChanges).toBe(true);

      const workspace = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      expect(workspace?.version).toBe(1); // Not incremented
      expect(workspace?.eventVersion).toBe(0); // No event
    });

    it("rejects update with wrong expectedVersion", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      await expect(
        asUser.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
          expectedVersion: 999,
        }),
      ).rejects.toThrow("Version conflict");
    });

    it("updates updatedAt timestamp", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const before = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
        expectedVersion: 1,
      });

      const after = await asUser.query(api.workspaces.get, {
        id: workspaceId,
      });
      expect(after?.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
    });
  });

  describe("undo", () => {
    it("returns 'Nothing to undo' when at base state", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Test", components: {} },
      });

      const result = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Nothing to undo");
    });

    it("reverts to previous state after update", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { id: "ws_1", version: "1.0", name: "Original", components: {} },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: "ws_1", version: "1.0", name: "Updated", components: {} },
        expectedVersion: 1,
      });

      const result = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe("Original");
      expect(result.previousVersion).toBe(1);
      expect(result.currentVersion).toBe(0);
    });

    it("rejects undo from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await expect(
        asOther.mutation(api.workspaces.undo, { id: workspaceId }),
      ).rejects.toThrow("Access denied");
    });

    it("can undo multiple times", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "v0" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "v1" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "v2" },
        expectedVersion: 2,
      });

      // Undo to v1
      const result1 = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });
      const data1 = result1.data as WorkspaceData;
      expect(data1.name).toBe("v1");

      // Undo to v0
      const result2 = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });
      const data2 = result2.data as WorkspaceData;
      expect(data2.name).toBe("v0");

      // Can't undo further
      const result3 = await asUser.mutation(api.workspaces.undo, {
        id: workspaceId,
      });
      expect(result3.success).toBe(false);
    });
  });

  describe("redo", () => {
    it("returns 'Nothing to redo' when at max version", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Test" },
      });

      const result = await asUser.mutation(api.workspaces.redo, {
        id: workspaceId,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Nothing to redo");
    });

    it("reapplies changes after undo", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.undo, { id: workspaceId });

      const result = await asUser.mutation(api.workspaces.redo, {
        id: workspaceId,
      });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe("Updated");
      expect(result.previousVersion).toBe(0);
      expect(result.currentVersion).toBe(1);
    });

    it("rejects redo from non-owner", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);
      const asOther = t.withIdentity(otherUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "Original" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "Updated" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.undo, { id: workspaceId });

      await expect(
        asOther.mutation(api.workspaces.redo, { id: workspaceId }),
      ).rejects.toThrow("Access denied");
    });

    it("discards future events when making new change after undo (branching)", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity(testUser);

      const workspaceId = await asUser.mutation(api.workspaces.create, {
        name: "Test",
        data: { name: "v0" },
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "v1" },
        expectedVersion: 1,
      });

      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "v2" },
        expectedVersion: 2,
      });

      // Undo to v1
      await asUser.mutation(api.workspaces.undo, { id: workspaceId });

      // Make a new change (branching)
      await asUser.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: "v1-alt" },
        expectedVersion: 4, // version incremented by undo
      });

      // Redo should say nothing to redo (v2 was discarded)
      const result = await asUser.mutation(api.workspaces.redo, {
        id: workspaceId,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Nothing to redo");
    });
  });
});
