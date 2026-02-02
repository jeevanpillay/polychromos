import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  createTestWorkspace,
  createDesignFile,
  readDesignFile,
  spawnDevCommand,
  waitForOutput,
  wait,
  type TestWorkspace,
} from './helpers.js';
import { getExtractedToken } from './setup.js';

describe('Dev Command E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    const token = getExtractedToken();
    convexClient.setAuth(token);
  });

  afterAll(async () => {
    // Cleanup created workspace
    // Note: No delete mutation exists, so we leave it for manual cleanup
  });

  beforeEach(async () => {
    // Create initial workspace in Convex
    const initialData = {
      id: 'test',
      version: '1.0',
      name: 'Dev Test',
      components: {},
    };

    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'Dev E2E Test',
      data: initialData,
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
    await createDesignFile(workspace, initialData);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('file watching', () => {
    it('starts watching and shows startup message', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        // Wait for dev to start watching
        await waitForOutput(dev.output, 'Watching design.json', 15000);

        // Should also show authenticated message
        const output = dev.output.join('');
        expect(output).toContain('Authenticated');
      } finally {
        dev.stop();
        await wait(500); // Give process time to clean up
      }
    });

    it('syncs design.json changes to Convex', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        // Wait for dev to start watching
        await waitForOutput(dev.output, 'Watching design.json', 15000);

        // Modify the design file
        const updatedData = {
          id: 'test',
          version: '1.0',
          name: 'Updated Name',
          components: { newComp: { id: 'newComp', name: 'New', elements: [] } },
        };
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(updatedData, null, 2)
        );

        // Wait for sync confirmation
        await waitForOutput(dev.output, 'Synced to Convex', 15000);

        // Verify in Convex
        const savedWorkspace = (await convexClient.query('workspaces:get' as never, {
          id: createdWorkspaceId,
        } as never)) as { data: { name: string; components: Record<string, unknown> } };

        expect(savedWorkspace.data.name).toBe('Updated Name');
        expect(savedWorkspace.data.components).toHaveProperty('newComp');
      } finally {
        dev.stop();
        await wait(500);
      }
    });

    it('handles no-change sync correctly', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json', 15000);

        // Read current content and write same content (touch file)
        const currentData = await readDesignFile(workspace);
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(currentData, null, 2)
        );

        // Wait for response - should detect no changes
        await waitForOutput(dev.output, 'No changes detected', 15000);
      } finally {
        dev.stop();
        await wait(500);
      }
    });

    it('debounces rapid file changes', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json', 15000);

        // Make rapid changes
        for (let i = 0; i < 5; i++) {
          await writeFile(
            join(workspace.dir, 'design.json'),
            JSON.stringify(
              {
                id: 'test',
                version: '1.0',
                name: `Rapid Change ${i}`,
                components: {},
              },
              null,
              2
            )
          );
          await wait(50); // 50ms between changes
        }

        // Wait for sync
        await waitForOutput(dev.output, 'Synced to Convex', 15000);

        // Verify final state in Convex
        const savedWorkspace = (await convexClient.query('workspaces:get' as never, {
          id: createdWorkspaceId,
        } as never)) as { data: { name: string } };

        // Should have the last change (debounced)
        expect(savedWorkspace.data.name).toBe('Rapid Change 4');
      } finally {
        dev.stop();
        await wait(500);
      }
    });
  });

  describe('version tracking', () => {
    it('increments event version on sync', async () => {
      const dev = spawnDevCommand(workspace);

      try {
        await waitForOutput(dev.output, 'Watching design.json', 15000);

        // Make first change
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(
            {
              id: 'test',
              version: '1.0',
              name: 'Version Test 1',
              components: {},
            },
            null,
            2
          )
        );

        await waitForOutput(dev.output, 'event v1', 15000);

        // Make second change
        await writeFile(
          join(workspace.dir, 'design.json'),
          JSON.stringify(
            {
              id: 'test',
              version: '1.0',
              name: 'Version Test 2',
              components: {},
            },
            null,
            2
          )
        );

        await waitForOutput(dev.output, 'event v2', 15000);

        // Verify in Convex
        const savedWorkspace = (await convexClient.query('workspaces:get' as never, {
          id: createdWorkspaceId,
        } as never)) as { eventVersion: number };

        expect(savedWorkspace.eventVersion).toBe(2);
      } finally {
        dev.stop();
        await wait(500);
      }
    });
  });
});
