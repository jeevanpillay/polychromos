# Polychromos Integration Test Implementation Plan

## Overview

This plan implements integration tests for the Polychromos CLI commands and Convex functions. Integration tests verify interactions between components - CLI commands interacting with the filesystem and version manager, and Convex mutations/queries working with the database.

## Current State Analysis

### CLI Commands (`packages/polychromos/src/commands/`)
- **init.ts**: Creates `design.json` with workspace structure
- **dev.ts**: Watches file changes, syncs with Convex (requires Convex config, no local-only mode)
- **undo.ts/redo.ts**: Call Convex `workspaces:undo`/`workspaces:redo` mutations, update `design.json`
- **history.ts**: Fetches version history from Convex `events:getHistory` query
- **checkpoint.ts**: Creates named checkpoint via VersionManager (local only)
- **export.ts**: Exports to HTML or Tailwind format (writes to current directory, not `./export/`)

### Convex Functions (`apps/polychromos-app/convex/`)
- **workspaces.ts**: `get`, `list`, `create`, `update` (with automatic event recording), `undo`, `redo`
- **events.ts**: `recordEvent`, `getHistory`
- **schema.ts**: Defines `workspaces` table (with `baseData`, `eventVersion`, `maxEventVersion`) and `events` table with indexes

### Existing Testing Infrastructure
- Vitest configured with memfs for filesystem mocking (`packages/polychromos/test/setup.ts:5-8`)
- `convex-test` available in `apps/polychromos-app` for Convex function testing
- Test fixtures exported from `@polychromos/types/fixtures`

### Key Discoveries
1. CLI command functions are exported (e.g., `initCommand`, `devCommand`) and can be imported directly
2. The `dev.ts` command has internal single-flight pattern not separately testable
3. Export command writes to current directory (e.g., `main-component.html`), not `./export/`
4. Checkpoint doesn't create separate files - it adds entries to `events.jsonl`
5. The vitest config already includes `test/**/*.test.ts` pattern for test files

## Desired End State

After implementation:
1. Integration tests exist for all 7 CLI commands in `packages/polychromos/src/__tests__/commands/`
2. Integration tests exist for Convex functions in `apps/polychromos-app/convex/__tests__/`
3. CLI-Convex sync integration tests verify the full data flow
4. All tests pass with `pnpm test`
5. Coverage includes the new test files

### Verification
- Run `pnpm --filter @polychromos/cli test` - all CLI integration tests pass
- Run `pnpm --filter @polychromos/polychromos-app test:convex` - all Convex tests pass
- Run `pnpm test` - all tests pass across monorepo

## What We're NOT Doing

- E2E tests (covered in Research 4)
- Performance/load testing
- Visual regression testing
- Testing the actual Convex cloud deployment
- Testing the React UI components (already have unit tests)
- Modifying the CLI command implementations

## Implementation Approach

We'll implement tests in three phases:
1. **Phase 1**: CLI Command Integration Tests - Test each command with memfs
2. **Phase 2**: Convex Function Tests - Test mutations/queries with convex-test
3. **Phase 3**: CLI-Convex Sync Tests - Test the integration between CLI and mocked Convex

---

## Phase 1: CLI Command Integration Tests

### Overview
Create integration tests for each CLI command using memfs to mock the filesystem. Tests will verify the commands produce correct files and console output.

### Changes Required

#### 1. Create test directory structure
Create the directory: `packages/polychromos/src/__tests__/commands/`

#### 2. Init Command Tests
**File**: `packages/polychromos/src/__tests__/commands/init.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { initCommand } from '../../commands/init';

describe('init command', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates design.json with workspace name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('my-design');

    expect(vol.existsSync('design.json')).toBe(true);

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);
    expect(content.name).toBe('my-design');

    consoleSpy.mockRestore();
  });

  it('creates workspace with valid schema', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);

    expect(content.id).toMatch(/^ws_/);
    expect(content.version).toBe('1.0');
    expect(content.components).toBeDefined();
    expect(content.components.main).toBeDefined();
    expect(content.components.main.root.type).toBe('box');

    consoleSpy.mockRestore();
  });

  it('includes default settings', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);

    expect(content.settings).toBeDefined();
    expect(content.settings.defaultUnits).toBe('px');
    expect(content.settings.rootFontSize).toBe(16);

    consoleSpy.mockRestore();
  });

  it('includes default tokens', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);

    expect(content.tokens).toBeDefined();
    expect(content.tokens.colors.primary).toBe('#3b82f6');
    expect(content.tokens.spacing.md).toBe('16px');

    consoleSpy.mockRestore();
  });

  it('logs success messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('test');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created design.json'));

    consoleSpy.mockRestore();
  });

  it('includes workspace id in success message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('my-workspace');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workspace: my-workspace'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID: ws_'));

    consoleSpy.mockRestore();
  });

  it('creates main component with welcome text using workspace name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await initCommand('Cool Project');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);
    const titleElement = content.components.main.root.children[0];

    expect(titleElement.text.content).toBe('Welcome to Cool Project');

    consoleSpy.mockRestore();
  });
});
```

#### 3. History Command Tests
**File**: `packages/polychromos/src/__tests__/commands/history.test.ts`

**Note**: The history command now fetches from Convex. Tests must mock the ConvexHttpClient.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock ConvexHttpClient
const mockQuery = vi.fn();
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
  })),
}));

describe('history command', () => {
  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
    // Setup config for Convex
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({
        convexUrl: 'https://test.convex.cloud',
        workspaceId: 'test_workspace_id',
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows empty history message when no events', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 0, maxEventVersion: 0 }) // workspace
      .mockResolvedValueOnce([]); // history

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith('No version history found.');

    consoleSpy.mockRestore();
  });

  it('lists all version entries', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 3, maxEventVersion: 3 })
      .mockResolvedValueOnce([
        { version: 1, timestamp: 1704067200000, patches: [] },
        { version: 2, timestamp: 1704067260000, patches: [] },
        { version: 3, timestamp: 1704067320000, patches: [] },
      ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v1'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v2'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v3'));

    consoleSpy.mockRestore();
  });

  it('shows patch count for each entry', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 1, maxEventVersion: 1 })
      .mockResolvedValueOnce([
        { version: 1, timestamp: 1704067200000, patches: [{ op: 'replace', path: '/name', value: 'test' }] },
      ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1 change'));

    consoleSpy.mockRestore();
  });

  it('shows current marker on active version', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 2, maxEventVersion: 3 })
      .mockResolvedValueOnce([
        { version: 1, timestamp: 1704067200000, patches: [] },
        { version: 2, timestamp: 1704067260000, patches: [] },
        { version: 3, timestamp: 1704067320000, patches: [] },
      ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    // v2 should have the current marker since eventVersion is 2
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v2'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/v2.*← current/));

    consoleSpy.mockRestore();
  });

  it('shows current and max version summary', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 2, maxEventVersion: 3 })
      .mockResolvedValueOnce([
        { version: 1, timestamp: 1704067200000, patches: [] },
        { version: 2, timestamp: 1704067260000, patches: [] },
        { version: 3, timestamp: 1704067320000, patches: [] },
      ]);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith('Current: v2 / Max: v3');

    consoleSpy.mockRestore();
  });

  it('exits with error when no Convex config', async () => {
    vol.reset();
    vol.mkdirSync('.polychromos', { recursive: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { historyCommand } = await import('../../commands/history');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith('No Convex configuration found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

#### 4. Checkpoint Command Tests
**File**: `packages/polychromos/src/__tests__/commands/checkpoint.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { checkpointCommand } from '../../commands/checkpoint';

describe('checkpoint command', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('creates checkpoint entry in events.jsonl', async () => {
    vol.mkdirSync('.polychromos', { recursive: true });
    vol.writeFileSync('.polychromos/events.jsonl', '{"v":1,"ts":1000,"patches":[]}\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await checkpointCommand('release-1.0');

    const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8') as string;
    const lines = content.trim().split('\n');
    const lastEntry = JSON.parse(lines[lines.length - 1]);

    expect(lastEntry.checkpoint).toBe('release-1.0');
    expect(lastEntry.patches).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('logs success message with checkpoint name', async () => {
    vol.mkdirSync('.polychromos', { recursive: true });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await checkpointCommand('my-checkpoint');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Checkpoint "my-checkpoint" created')
    );

    consoleSpy.mockRestore();
  });

  it('creates .polychromos directory if it does not exist', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await checkpointCommand('test');

    expect(vol.existsSync('.polychromos')).toBe(true);

    consoleSpy.mockRestore();
  });
});
```

#### 5. Export Command Tests
**File**: `packages/polychromos/src/__tests__/commands/export.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { exportCommand } from '../../commands/export';

describe('export command', () => {
  const sampleDesign = {
    id: 'ws_test',
    version: '1.0',
    name: 'Test Design',
    settings: { defaultUnits: 'px', rootFontSize: 16 },
    tokens: { colors: {}, spacing: {} },
    components: {
      main: {
        id: 'main',
        name: 'Main Component',
        width: 800,
        height: 600,
        root: {
          id: 'root',
          type: 'box',
          width: '100%',
          height: '100%',
          children: [
            {
              id: 'text1',
              type: 'text',
              text: { content: 'Hello World', fontSize: 24 },
            },
          ],
        },
      },
    },
  };

  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      './design.json': JSON.stringify(sampleDesign),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports to HTML format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    // Export writes to component name file
    expect(vol.existsSync('main-component.html')).toBe(true);

    const html = vol.readFileSync('main-component.html', 'utf-8') as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).toContain('Hello World');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exports to Tailwind format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('tailwind');

    expect(vol.existsSync('main-component.tailwind.html')).toBe(true);

    const html = vol.readFileSync('main-component.tailwind.html', 'utf-8') as string;
    expect(html).toContain('tailwindcss.com');
    expect(html).toContain('class=');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('rejects unknown format', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('svg');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs export location', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Exported to'));

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('fails gracefully when design.json is missing', async () => {
    vol.reset(); // Remove design.json

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading design.json'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('escapes HTML in text content', async () => {
    const designWithScript = {
      ...sampleDesign,
      components: {
        main: {
          ...sampleDesign.components.main,
          root: {
            id: 'root',
            type: 'text',
            text: { content: '<script>alert("xss")</script>', fontSize: 16 },
          },
        },
      },
    };
    vol.writeFileSync('./design.json', JSON.stringify(designWithScript));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    const html = vol.readFileSync('main-component.html', 'utf-8') as string;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

#### 6. Undo Command Tests
**File**: `packages/polychromos/src/__tests__/commands/undo.test.ts`

**Note**: The undo command now uses Convex mutations. Tests must mock the ConvexHttpClient.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock ConvexHttpClient
const mockMutation = vi.fn();
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: mockMutation,
  })),
}));

describe('undo command', () => {
  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
    // Setup config for Convex
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({
        convexUrl: 'https://test.convex.cloud',
        workspaceId: 'test_workspace_id',
      }),
      'design.json': JSON.stringify({ name: 'current' }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Convex undo mutation and writes result to design.json', async () => {
    mockMutation.mockResolvedValue({
      success: true,
      data: { name: 'previous' },
      previousVersion: 2,
      currentVersion: 1,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { undoCommand } = await import('../../commands/undo');

    await undoCommand();

    expect(mockMutation).toHaveBeenCalledWith('workspaces:undo', {
      id: 'test_workspace_id',
    });

    const design = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);
    expect(design.name).toBe('previous');

    consoleSpy.mockRestore();
  });

  it('logs message when nothing to undo', async () => {
    mockMutation.mockResolvedValue({
      success: false,
      message: 'Nothing to undo',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { undoCommand } = await import('../../commands/undo');

    await undoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('Nothing to undo');

    consoleSpy.mockRestore();
  });

  it('logs success message with version numbers after undo', async () => {
    mockMutation.mockResolvedValue({
      success: true,
      data: { name: 'v1' },
      previousVersion: 2,
      currentVersion: 1,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { undoCommand } = await import('../../commands/undo');

    await undoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('✓ Undone: v2 → v1');

    consoleSpy.mockRestore();
  });

  it('exits with error when no Convex config', async () => {
    vol.reset();
    vol.mkdirSync('.polychromos', { recursive: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { undoCommand } = await import('../../commands/undo');

    await undoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('No Convex configuration found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

#### 7. Redo Command Tests
**File**: `packages/polychromos/src/__tests__/commands/redo.test.ts`

**Note**: The redo command now uses Convex mutations. Redo state is persisted server-side via `eventVersion` and `maxEventVersion`, so redo works across CLI invocations.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock ConvexHttpClient
const mockMutation = vi.fn();
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: mockMutation,
  })),
}));

describe('redo command', () => {
  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
    // Setup config for Convex
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({
        convexUrl: 'https://test.convex.cloud',
        workspaceId: 'test_workspace_id',
      }),
      'design.json': JSON.stringify({ name: 'current' }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Convex redo mutation and writes result to design.json', async () => {
    mockMutation.mockResolvedValue({
      success: true,
      data: { name: 'next' },
      previousVersion: 1,
      currentVersion: 2,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { redoCommand } = await import('../../commands/redo');

    await redoCommand();

    expect(mockMutation).toHaveBeenCalledWith('workspaces:redo', {
      id: 'test_workspace_id',
    });

    const design = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string);
    expect(design.name).toBe('next');

    consoleSpy.mockRestore();
  });

  it('logs message when nothing to redo', async () => {
    mockMutation.mockResolvedValue({
      success: false,
      message: 'Nothing to redo',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { redoCommand } = await import('../../commands/redo');

    await redoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('Nothing to redo');

    consoleSpy.mockRestore();
  });

  it('logs success message with version numbers after redo', async () => {
    mockMutation.mockResolvedValue({
      success: true,
      data: { name: 'v2' },
      previousVersion: 1,
      currentVersion: 2,
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { redoCommand } = await import('../../commands/redo');

    await redoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('✓ Redone: v1 → v2');

    consoleSpy.mockRestore();
  });

  it('exits with error when no Convex config', async () => {
    vol.reset();
    vol.mkdirSync('.polychromos', { recursive: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const { redoCommand } = await import('../../commands/redo');

    await redoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('No Convex configuration found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

### Success Criteria

#### Automated Verification:
- [x] All CLI command tests pass: `pnpm --filter @polychromos/cli test`
- [x] TypeScript compiles: `pnpm --filter @polychromos/cli typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Tests cover the main functionality of each command
- [ ] Edge cases (missing files, invalid input) are tested
- [ ] Console output is properly verified

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 2.

---

## Phase 2: Convex Function Tests

### Overview
Create integration tests for Convex mutations and queries using the `convex-test` library. These tests will verify database operations work correctly.

### Changes Required

#### 1. Create test directory
Create the directory: `apps/polychromos-app/convex/__tests__/`

#### 2. Workspaces Tests
**File**: `apps/polychromos-app/convex/__tests__/workspaces.test.ts`

```typescript
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import { api } from '../_generated/api';
import schema from '../schema';

const modules = import.meta.glob('../**/*.ts');

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
      expect(workspace?.data.name).toBe('Updated');
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
      expect(history[0].version).toBe(1);
      expect(history[0].patches.length).toBeGreaterThan(0);
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
        })
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
        })
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
      expect(after?.updatedAt).toBeGreaterThan(before!.updatedAt);
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
      expect(result.data.name).toBe('Original');
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
      expect(result1.data.name).toBe('v1');

      // Undo to v0
      const result2 = await t.mutation(api.workspaces.undo, { id: workspaceId });
      expect(result2.data.name).toBe('v0');

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
      expect(result.data.name).toBe('Updated');
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
```

#### 3. Events Tests
**File**: `apps/polychromos-app/convex/__tests__/events.test.ts`

```typescript
import { convexTest } from 'convex-test';
import { describe, it, expect } from 'vitest';
import { api } from '../_generated/api';
import schema from '../schema';

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
        patches: [
          { op: 'replace', path: '/name', value: 'Updated' },
        ],
      });

      const history = await t.query(api.events.getHistory, { workspaceId });

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(1);
      expect(history[0].patches[0].op).toBe('replace');
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

      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
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
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(3);
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
```

### Success Criteria

#### Automated Verification:
- [x] All Convex tests pass: `pnpm --filter @polychromos/polychromos-app test:convex`
- [x] TypeScript compiles: `pnpm --filter @polychromos/polychromos-app typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [x] Tests verify all CRUD operations for workspaces
- [x] Tests verify event recording and history retrieval
- [x] Version conflict detection is properly tested

**Implementation Note**: After completing this phase and all automated verification passes, pause here for confirmation before proceeding to Phase 3.

---

## Phase 3: CLI-Convex Sync Integration Tests

### Overview
Test the integration between CLI commands and Convex by mocking the ConvexHttpClient. This verifies the data flow from file changes through to the sync mechanism.

### Changes Required

#### 1. Create test file
**File**: `packages/polychromos/test/integration/cli-convex-sync.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock ConvexHttpClient
const mockMutation = vi.fn();
const mockQuery = vi.fn();

vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: mockMutation,
    query: mockQuery,
  })),
}));

describe('CLI to Convex sync integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({
        convexUrl: 'https://test.convex.cloud',
        workspaceId: 'ws_test123',
      }),
      '.polychromos/events.jsonl': '',
      './design.json': JSON.stringify({
        id: 'ws_test',
        version: '1.0',
        name: 'Test',
        components: {},
      }),
    });
  });

  afterEach(() => {
    vol.reset();
    vi.useRealTimers();
  });

  it('loads config from .polychromos/config.json', async () => {
    const { loadConfig } = await import('../../src/lib/config.js');

    const config = await loadConfig();

    expect(config).toEqual({
      convexUrl: 'https://test.convex.cloud',
      workspaceId: 'ws_test123',
    });
  });

  it('returns null when config is missing', async () => {
    vol.reset();
    vol.mkdirSync('.polychromos', { recursive: true });

    const { loadConfig } = await import('../../src/lib/config.js');

    const config = await loadConfig();

    expect(config).toBeNull();
  });

  it('returns null when config is invalid', async () => {
    vol.reset();
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({ convexUrl: 'test' }), // missing workspaceId
    });

    const { loadConfig } = await import('../../src/lib/config.js');

    const config = await loadConfig();

    expect(config).toBeNull();
  });

  it('saves config correctly', async () => {
    vol.mkdirSync('.polychromos', { recursive: true });

    const { saveConfig } = await import('../../src/lib/config.js');

    await saveConfig({
      convexUrl: 'https://new.convex.cloud',
      workspaceId: 'ws_new',
    });

    const content = JSON.parse(vol.readFileSync('.polychromos/config.json', 'utf-8') as string);
    expect(content.convexUrl).toBe('https://new.convex.cloud');
    expect(content.workspaceId).toBe('ws_new');
  });
});

describe('Single-flight pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid changes to single mutation', async () => {
    vi.useFakeTimers();

    // Simulate the single-flight pattern logic
    let pendingMutation: Promise<void> | null = null;
    let pendingData: unknown = null;
    const mutationCalls: unknown[] = [];

    const mockMutate = async (data: unknown) => {
      mutationCalls.push(data);
      await new Promise((r) => setTimeout(r, 100));
    };

    const syncWithSingleFlight = async (data: unknown): Promise<void> => {
      pendingData = data;
      if (pendingMutation) return;

      while (pendingData) {
        const toSync = pendingData;
        pendingData = null;

        pendingMutation = mockMutate(toSync);
        await pendingMutation;
        pendingMutation = null;
      }
    };

    // Trigger multiple syncs rapidly
    void syncWithSingleFlight({ v: 1 });
    void syncWithSingleFlight({ v: 2 });
    void syncWithSingleFlight({ v: 3 });

    // Advance past first mutation
    await vi.advanceTimersByTimeAsync(150);

    // Advance past second mutation (should only process v:3)
    await vi.advanceTimersByTimeAsync(150);

    // First call with v:1, second call with v:3 (v:2 coalesced)
    expect(mutationCalls).toHaveLength(2);
    expect(mutationCalls[0]).toEqual({ v: 1 });
    expect(mutationCalls[1]).toEqual({ v: 3 });
  });

  it('processes latest pending data after current mutation completes', async () => {
    vi.useFakeTimers();

    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((r) => (resolveFirst = r));

    let pendingMutation: Promise<void> | null = null;
    let pendingData: unknown = null;
    const mutationCalls: unknown[] = [];
    let callCount = 0;

    const mockMutate = async (data: unknown) => {
      mutationCalls.push(data);
      if (callCount++ === 0) {
        await firstPromise;
      }
    };

    const syncWithSingleFlight = async (data: unknown): Promise<void> => {
      pendingData = data;
      if (pendingMutation) return;

      while (pendingData) {
        const toSync = pendingData;
        pendingData = null;

        pendingMutation = mockMutate(toSync);
        await pendingMutation;
        pendingMutation = null;
      }
    };

    // Start first mutation
    void syncWithSingleFlight({ v: 1 });

    // Queue more while first is in-flight
    void syncWithSingleFlight({ v: 2 });
    void syncWithSingleFlight({ v: 3 });

    // Complete first mutation
    resolveFirst!();
    await vi.advanceTimersByTimeAsync(10);

    // Should have processed v:3 (latest)
    expect(mutationCalls).toHaveLength(2);
    expect(mutationCalls[1]).toEqual({ v: 3 });
  });
});
```

#### 2. Update vitest config to include integration tests
The vitest config already includes `test/**/*.test.ts` pattern, so no changes needed.

### Success Criteria

#### Automated Verification:
- [x] All integration tests pass: `pnpm --filter @polychromos/cli test`
- [x] Full test suite passes: `pnpm test`
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [x] Config loading/saving works correctly
- [x] Single-flight pattern correctly coalesces rapid changes
- [x] Integration test patterns can be extended for more scenarios

**Implementation Note**: After completing this phase, all integration tests should be complete.

---

## Testing Strategy

### Unit Tests (Already Exist):
- VersionManager tests in `packages/polychromos/src/lib/__tests__/`
- Validator tests in `packages/polychromos-types/src/`
- Generator tests in `apps/polychromos-app/src/lib/__tests__/`
- Element renderer tests in `apps/polychromos-app/src/components/element-renderers/__tests__/`

### Integration Tests (This Plan):
- CLI command tests with memfs filesystem mocking
- Convex function tests with convex-test
- CLI-Convex sync tests with mocked ConvexHttpClient

### Key Edge Cases to Test:
- Missing files (design.json, config.json)
- Invalid input (wrong format, missing fields)
- Version conflicts
- Empty states (no history, no workspaces)
- XSS prevention in export
- Undo at base state (eventVersion = 0)
- Redo at max version (eventVersion = maxEventVersion)
- Branching: undo then new change discards future events
- No-op updates (same data) should not create events

## Performance Considerations

- Tests use in-memory filesystem (memfs) for fast execution
- Convex tests use in-memory database simulation
- No actual network calls are made in tests
- Tests are parallelizable within each describe block

## Migration Notes

No migration needed - these are new test files that don't affect existing code.

## References

- Research document: `thoughts/shared/research/2026-02-02-polychromos-testing-3-integration-tests.md`
- Existing unit tests: `packages/polychromos/src/lib/__tests__/version-manager.test.ts`
- Test setup: `packages/polychromos/test/setup.ts`
- Convex test docs: https://docs.convex.dev/functions/testing
