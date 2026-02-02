/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';

import { api } from '../_generated/api';
import schema from '../schema';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const modules = import.meta.glob('../**/*.ts');

interface WorkspaceData {
  name: string;
  [key: string]: unknown;
}

describe('workspaces mutations', () => {
  describe('create', () => {
    it('creates a workspace with initial version 1', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test Workspace',
        data: {
          id: 'ws_123',
          version: '1.0',
          name: 'Test',
          components: {},
        },
      });

      expect(workspaceId).toBeDefined();

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });
      expect(workspace?.name).toBe('Test Workspace');
      expect(workspace?.version).toBe(1);
    });

    it('initializes eventVersion and maxEventVersion to 0', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace?.eventVersion).toBe(0);
      expect(workspace?.maxEventVersion).toBe(0);
    });

    it('stores baseData equal to initial data', async () => {
      const t = convexTest(schema, modules);
      const initialData = { id: 'ws_1', version: '1.0', name: 'Test', components: {} };

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: initialData,
      });

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace?.baseData).toEqual(initialData);
    });

    it('sets createdAt and updatedAt timestamps', async () => {
      const t = convexTest(schema, modules);
      const before = Date.now();

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const after = Date.now();
      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace?.createdAt).toBeGreaterThanOrEqual(before);
      expect(workspace?.createdAt).toBeLessThanOrEqual(after);
      expect(workspace?.updatedAt).toBe(workspace?.createdAt);
    });
  });

  describe('update', () => {
    it('updates workspace and increments version', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Original', components: {} },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: 'ws_1', version: '1.0', name: 'Updated', components: {} },
        expectedVersion: 1,
      });

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });
      const data = workspace?.data as WorkspaceData;
      expect(data.name).toBe('Updated');
      expect(workspace?.version).toBe(2);
    });

    it('increments eventVersion and maxEventVersion on update', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'Original' },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'Updated' },
        expectedVersion: 1,
      });

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });
      expect(workspace?.eventVersion).toBe(1);
      expect(workspace?.maxEventVersion).toBe(1);
    });

    it('records event automatically on update', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'Original' },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'Updated' },
        expectedVersion: 1,
      });

      const history = await t.query(api.events.getHistory, { workspaceId });
      expect(history).toHaveLength(1);
      expect(history[0]?.version).toBe(1);
      expect(history[0]?.patches.length).toBeGreaterThan(0);
    });

    it('skips update when no actual changes', async () => {
      const t = convexTest(schema, modules);
      const data = { name: 'Same' };

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data,
      });

      const result = await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data, // Same data
        expectedVersion: 1,
      });

      expect(result.noChanges).toBe(true);

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });
      expect(workspace?.version).toBe(1); // Not incremented
      expect(workspace?.eventVersion).toBe(0); // No event
    });

    it('rejects update with wrong expectedVersion', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      await expect(
        t.mutation(api.workspaces.update, {
          id: workspaceId,
          data: { id: 'ws_1', version: '1.0', name: 'Updated', components: {} },
          expectedVersion: 999,
        }),
      ).rejects.toThrow('Version conflict');
    });

    it('throws if workspace not found', async () => {
      const t = convexTest(schema, modules);

      // Use a run to create a fake ID that passes validation
      const fakeId = await t.run(async (ctx) => {
        // Create and immediately delete to get a valid but non-existent ID format
        const id = await ctx.db.insert('workspaces', {
          name: 'temp',
          data: {},
          baseData: {},
          eventVersion: 0,
          maxEventVersion: 0,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.mutation(api.workspaces.update, {
          id: fakeId,
          data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
          expectedVersion: 1,
        }),
      ).rejects.toThrow('Workspace not found');
    });

    it('updates updatedAt timestamp', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const before = await t.query(api.workspaces.get, { id: workspaceId });

      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: 'ws_1', version: '1.0', name: 'Updated', components: {} },
        expectedVersion: 1,
      });

      const after = await t.query(api.workspaces.get, { id: workspaceId });
      expect(after?.updatedAt).toBeGreaterThan(before?.updatedAt ?? 0);
    });
  });

  describe('list', () => {
    it('returns all workspaces', async () => {
      const t = convexTest(schema, modules);

      await t.mutation(api.workspaces.create, {
        name: 'First',
        data: { id: 'ws_1', version: '1.0', name: 'First', components: {} },
      });

      await t.mutation(api.workspaces.create, {
        name: 'Second',
        data: { id: 'ws_2', version: '1.0', name: 'Second', components: {} },
      });

      const workspaces = await t.query(api.workspaces.list, {});

      expect(workspaces).toHaveLength(2);
      expect(workspaces.map((w) => w.name)).toContain('First');
      expect(workspaces.map((w) => w.name)).toContain('Second');
    });

    it('returns empty array when no workspaces', async () => {
      const t = convexTest(schema, modules);

      const workspaces = await t.query(api.workspaces.list, {});

      expect(workspaces).toEqual([]);
    });
  });

  describe('get', () => {
    it('returns workspace by id', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const workspace = await t.query(api.workspaces.get, { id: workspaceId });

      expect(workspace?.name).toBe('Test');
    });

    it('returns null for nonexistent id', async () => {
      const t = convexTest(schema, modules);

      // Create and delete to get a valid but nonexistent ID
      const fakeId = await t.run(async (ctx) => {
        const id = await ctx.db.insert('workspaces', {
          name: 'temp',
          data: {},
          baseData: {},
          eventVersion: 0,
          maxEventVersion: 0,
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      const workspace = await t.query(api.workspaces.get, { id: fakeId });

      expect(workspace).toBeNull();
    });
  });

  describe('undo', () => {
    it('returns "Nothing to undo" when at base state', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const result = await t.mutation(api.workspaces.undo, { id: workspaceId });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Nothing to undo');
    });

    it('reverts to previous state after update', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Original', components: {} },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { id: 'ws_1', version: '1.0', name: 'Updated', components: {} },
        expectedVersion: 1,
      });

      const result = await t.mutation(api.workspaces.undo, { id: workspaceId });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe('Original');
      expect(result.previousVersion).toBe(1);
      expect(result.currentVersion).toBe(0);
    });

    it('can undo multiple times', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'v0' },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'v1' },
        expectedVersion: 1,
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'v2' },
        expectedVersion: 2,
      });

      // Undo to v1
      const result1 = await t.mutation(api.workspaces.undo, { id: workspaceId });
      const data1 = result1.data as WorkspaceData;
      expect(data1.name).toBe('v1');

      // Undo to v0
      const result2 = await t.mutation(api.workspaces.undo, { id: workspaceId });
      const data2 = result2.data as WorkspaceData;
      expect(data2.name).toBe('v0');

      // Can't undo further
      const result3 = await t.mutation(api.workspaces.undo, { id: workspaceId });
      expect(result3.success).toBe(false);
    });
  });

  describe('redo', () => {
    it('returns "Nothing to redo" when at max version', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'Test' },
      });

      const result = await t.mutation(api.workspaces.redo, { id: workspaceId });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Nothing to redo');
    });

    it('reapplies changes after undo', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'Original' },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'Updated' },
        expectedVersion: 1,
      });

      await t.mutation(api.workspaces.undo, { id: workspaceId });

      const result = await t.mutation(api.workspaces.redo, { id: workspaceId });

      expect(result.success).toBe(true);
      const data = result.data as WorkspaceData;
      expect(data.name).toBe('Updated');
      expect(result.previousVersion).toBe(0);
      expect(result.currentVersion).toBe(1);
    });

    it('discards future events when making new change after undo (branching)', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { name: 'v0' },
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'v1' },
        expectedVersion: 1,
      });

      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'v2' },
        expectedVersion: 2,
      });

      // Undo to v1
      await t.mutation(api.workspaces.undo, { id: workspaceId });

      // Make a new change (branching)
      await t.mutation(api.workspaces.update, {
        id: workspaceId,
        data: { name: 'v1-alt' },
        expectedVersion: 4, // version incremented by undo
      });

      // Redo should say nothing to redo (v2 was discarded)
      const result = await t.mutation(api.workspaces.redo, { id: workspaceId });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Nothing to redo');
    });
  });
});
