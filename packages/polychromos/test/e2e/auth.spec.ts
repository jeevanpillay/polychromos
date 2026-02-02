import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConvexHttpClient } from 'convex/browser';
import {
  createTestWorkspace,
  runCLI,
  type TestWorkspace,
} from './helpers.js';
import { getExtractedToken } from './setup.js';

describe('CLI Authentication E2E', () => {
  let convexClient: ConvexHttpClient;
  let workspace: TestWorkspace;
  let createdWorkspaceId: string;

  beforeAll(async () => {
    convexClient = new ConvexHttpClient('http://127.0.0.1:3210');

    // Get token from setup
    const token = getExtractedToken();
    convexClient.setAuth(token);
  });

  afterAll(async () => {
    // Cleanup any created workspaces
    if (createdWorkspaceId) {
      try {
        // Note: There's no delete mutation in the current API, so we skip cleanup
        // In a real implementation, we'd add a delete mutation for test cleanup
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(async () => {
    // Create a workspace in Convex first
    const initialData = {
      id: 'test',
      version: '1.0',
      name: 'E2E Test Workspace',
      components: {},
    };

    createdWorkspaceId = await convexClient.mutation('workspaces:create' as never, {
      name: 'E2E Test Workspace',
      data: initialData,
    } as never);

    workspace = await createTestWorkspace(createdWorkspaceId);
  });

  afterEach(async () => {
    await workspace.cleanup();
  });

  describe('whoami command', () => {
    it('shows authenticated user info with real Convex', async () => {
      const output = runCLI('whoami', workspace);

      expect(output).toContain('Authenticated');
      expect(output).toMatch(/workspaces?:/i);
    });

    it('lists workspaces count', async () => {
      const output = runCLI('whoami', workspace);

      // Should show at least 1 workspace (the one we created)
      expect(output).toMatch(/Workspaces:\s*\d+/);
    });
  });

  describe('history command', () => {
    it('shows no history for new workspace', async () => {
      const output = runCLI('history', workspace);

      // New workspace should have no version history
      expect(output).toMatch(/no.*history|history.*empty/i);
    });
  });
});
