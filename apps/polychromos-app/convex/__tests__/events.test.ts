/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';

import { api } from '../_generated/api';
import schema from '../schema';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const modules = import.meta.glob('../**/*.ts');

describe('events mutations', () => {
  describe('recordEvent', () => {
    it('records event with patches', async () => {
      const t = convexTest(schema, modules);

      // Create workspace first
      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 1,
        patches: [{ op: 'replace', path: '/name', value: 'Updated' }],
      });

      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(1);
      expect(history[0]?.version).toBe(1);
      expect(history[0]?.patches[0]?.op).toBe('replace');
    });

    it('includes timestamp', async () => {
      const t = convexTest(schema, modules);
      const before = Date.now();

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 1,
        patches: [],
      });

      const after = Date.now();
      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history[0]?.timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0]?.timestamp).toBeLessThanOrEqual(after);
    });

    it('records multiple events', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 1,
        patches: [{ op: 'replace', path: '/name', value: 'V1' }],
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 2,
        patches: [{ op: 'replace', path: '/name', value: 'V2' }],
      });

      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(2);
    });
  });

  describe('getHistory', () => {
    it('returns events in ascending order', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 1,
        patches: [{ op: 'replace', path: '/name', value: 'V1' }],
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 2,
        patches: [{ op: 'replace', path: '/name', value: 'V2' }],
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId,
        version: 3,
        patches: [{ op: 'replace', path: '/name', value: 'V3' }],
      });

      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(3);
      expect(history[0]?.version).toBe(1);
      expect(history[1]?.version).toBe(2);
      expect(history[2]?.version).toBe(3);
    });

    it('returns empty array for workspace with no events', async () => {
      const t = convexTest(schema, modules);

      const workspaceId = await t.mutation(api.workspaces.create, {
        name: 'Test',
        data: { id: 'ws_1', version: '1.0', name: 'Test', components: {} },
      });

      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history).toEqual([]);
    });

    it('filters events by workspaceId', async () => {
      const t = convexTest(schema, modules);

      const workspace1 = await t.mutation(api.workspaces.create, {
        name: 'First',
        data: { id: 'ws_1', version: '1.0', name: 'First', components: {} },
      });

      const workspace2 = await t.mutation(api.workspaces.create, {
        name: 'Second',
        data: { id: 'ws_2', version: '1.0', name: 'Second', components: {} },
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId: workspace1,
        version: 1,
        patches: [],
      });

      await t.mutation(api.events.recordEvent, {
        workspaceId: workspace2,
        version: 1,
        patches: [],
      });

      const history1 = await t.query(api.events.getHistory, {
        workspaceId: workspace1,
      });
      const history2 = await t.query(api.events.getHistory, {
        workspaceId: workspace2,
      });

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
    });
  });
});
