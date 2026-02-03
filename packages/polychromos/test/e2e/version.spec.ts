import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import {
  createTestWorkspace,
  createDesignFile,
  readDesignFile,
  runCLI,
  spawnDevCommand,
  waitForOutput,
  wait,
  type TestWorkspace,
} from './helpers.js';
import { getExtractedToken } from './setup.js';

describe('Version Control E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    const token = getExtractedToken();
    convexClient.setAuth(token);
  });

  afterAll(async () => {
    // Cleanup - no delete mutation exists
  });

  beforeEach(async () => {
    const initialData = {
      id: 'test',
      version: '1.0',
      name: 'Initial State',
      components: {},
    };

    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'Version Control E2E',
      data: initialData,
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
    await createDesignFile(workspace, initialData);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  /**
   * Helper to make a change via the dev command
   */
  async function makeChange(name: string): Promise<void> {
    const dev = spawnDevCommand(workspace);
    try {
      await waitForOutput(dev.output, 'Watching design.json', 15000);

      // Wait for chokidar watcher to fully initialize and file system to stabilize
      // This prevents race conditions where the file is read during overwrite
      await wait(200);

      // Ensure workspace directory exists (prevents ENOENT errors)
      const filePath = join(workspace.dir, 'design.json');
      await mkdir(dirname(filePath), { recursive: true });

      await writeFile(
        filePath,
        JSON.stringify(
          {
            id: 'test',
            version: '1.0',
            name,
            components: {},
          },
          null,
          2
        )
      );

      await waitForOutput(dev.output, 'Synced to Convex', 15000);
    } finally {
      dev.stop();
      await wait(500);
    }
  }

  describe('undo command', () => {
    it('reverts to previous state', async () => {
      // Make a change
      await makeChange('After Change');

      // Verify change is in Convex
      let saved = (await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never)) as { data: { name: string } };
      expect(saved.data.name).toBe('After Change');

      // Run undo
      const output = runCLI('undo', workspace);
      expect(output).toContain('Undone');

      // Verify local file is updated
      const localData = await readDesignFile(workspace);
      expect(localData.name).toBe('Initial State');

      // Verify Convex state
      saved = (await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never)) as { data: { name: string } };
      expect(saved.data.name).toBe('Initial State');
    });

    it('returns message when at base version', async () => {
      // Try to undo when already at base state (no changes made)
      const output = runCLI('undo', workspace);
      expect(output).toMatch(/nothing to undo/i);
    });
  });

  describe('redo command', () => {
    it('restores undone changes', async () => {
      // Make a change
      await makeChange('After Change');

      // Undo it
      runCLI('undo', workspace);

      // Verify at initial state
      let localData = await readDesignFile(workspace);
      expect(localData.name).toBe('Initial State');

      // Redo
      const output = runCLI('redo', workspace);
      expect(output).toContain('Redone');

      // Verify change is back
      localData = await readDesignFile(workspace);
      expect(localData.name).toBe('After Change');

      // Verify in Convex
      const saved = (await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never)) as { data: { name: string } };
      expect(saved.data.name).toBe('After Change');
    });

    it('returns message when no redo available', async () => {
      // No changes to redo (nothing has been undone)
      const output = runCLI('redo', workspace);
      expect(output).toMatch(/nothing to redo/i);
    });
  });

  describe('history command', () => {
    it('shows no history for new workspace', async () => {
      const output = runCLI('history', workspace);
      expect(output).toMatch(/no.*history/i);
    });

    it('shows all events after changes', async () => {
      // Make multiple changes
      await makeChange('Change 1');
      await makeChange('Change 2');

      const output = runCLI('history', workspace);

      // Should show version numbers
      expect(output).toContain('v1');
      expect(output).toContain('v2');
    });

    it('shows current marker on active version', async () => {
      await makeChange('Change 1');
      await makeChange('Change 2');

      const output = runCLI('history', workspace);

      // Current version (v2) should be marked
      expect(output).toMatch(/v2.*current|current.*v2/i);
    });

    it('shows correct position after undo', async () => {
      await makeChange('Change 1');
      await makeChange('Change 2');

      // Undo once
      runCLI('undo', workspace);

      const output = runCLI('history', workspace);

      // v1 should now be current
      expect(output).toMatch(/v1.*current|current.*v1/i);
      // v2 should still exist (for redo)
      expect(output).toContain('v2');
    });
  });

  describe('undo/redo roundtrip', () => {
    it('preserves data integrity through multiple operations', async () => {
      const states = ['State A', 'State B', 'State C'];

      // Create history
      for (const name of states) {
        await makeChange(name);
      }

      // Verify we're at State C
      let data = await readDesignFile(workspace);
      expect(data.name).toBe('State C');

      // Undo all the way back (3 times to get to base)
      runCLI('undo', workspace); // C -> B
      runCLI('undo', workspace); // B -> A
      runCLI('undo', workspace); // A -> Initial

      // Verify at initial state
      data = await readDesignFile(workspace);
      expect(data.name).toBe('Initial State');

      // Redo all the way forward
      runCLI('redo', workspace); // Initial -> A
      runCLI('redo', workspace); // A -> B
      runCLI('redo', workspace); // B -> C

      // Verify at final state
      data = await readDesignFile(workspace);
      expect(data.name).toBe('State C');

      // Also verify Convex state
      const saved = (await convexClient.query('workspaces:get' as never, {
        id: createdWorkspaceId,
      } as never)) as { data: { name: string } };
      expect(saved.data.name).toBe('State C');
    });
  });
});
