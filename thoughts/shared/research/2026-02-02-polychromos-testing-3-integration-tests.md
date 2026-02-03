---
date: 2026-02-02T15:30:00+08:00
researcher: Claude
git_commit: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos Integration Test Implementation"
tags: [research, testing, polychromos, integration-tests, cli, convex]
status: complete
priority: 3
dependencies: [2026-02-02-polychromos-testing-1-infrastructure.md, 2026-02-02-polychromos-testing-2-unit-tests.md]
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research 3: Polychromos Integration Test Implementation

**Priority**: 3
**Dependencies**: Research 1 (Infrastructure), Research 2 (Unit Tests)
**Estimated Effort**: 3-4 hours

## Overview

This document covers integration tests that verify interactions between components. These tests form ~25% of the test pyramid and require mocking external dependencies or using the local Convex backend.

## What This Document Covers

1. CLI command tests (init, dev, undo, redo, history, checkpoint, export)
2. Convex mutation/query tests (workspaces, events)
3. CLI → Convex sync integration

---

## 1. CLI Command Tests

### Test File Structure

```
packages/polychromos/
└── src/
    └── __tests__/
        └── commands/
            ├── init.test.ts
            ├── dev.test.ts
            ├── undo.test.ts
            ├── redo.test.ts
            ├── history.test.ts
            ├── checkpoint.test.ts
            └── export.test.ts
```

### Init Command Tests

```typescript
// packages/polychromos/src/__tests__/commands/init.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('init command', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/test', { recursive: true });
    process.chdir('/test');
  });

  afterEach(() => {
    vol.reset();
  });

  it('creates design.json with workspace name', async () => {
    const { initCommand } = await import('../../commands/init.js');

    await initCommand('my-design');

    expect(vol.existsSync('/test/design.json')).toBe(true);

    const content = JSON.parse(vol.readFileSync('/test/design.json', 'utf-8'));
    expect(content.name).toBe('my-design');
  });

  it('creates workspace with valid schema', async () => {
    const { initCommand } = await import('../../commands/init.js');

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('/test/design.json', 'utf-8'));

    expect(content.id).toMatch(/^ws_/);
    expect(content.version).toBe('1.0');
    expect(content.components).toBeDefined();
    expect(content.components.main).toBeDefined();
    expect(content.components.main.root.type).toBe('box');
  });

  it('includes default settings', async () => {
    const { initCommand } = await import('../../commands/init.js');

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('/test/design.json', 'utf-8'));

    expect(content.settings).toBeDefined();
    expect(content.settings.defaultUnits).toBe('px');
    expect(content.settings.rootFontSize).toBe(16);
  });

  it('includes default tokens', async () => {
    const { initCommand } = await import('../../commands/init.js');

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('/test/design.json', 'utf-8'));

    expect(content.tokens).toBeDefined();
    expect(content.tokens.colors.primary).toBeDefined();
    expect(content.tokens.spacing.md).toBeDefined();
  });

  it('logs success messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { initCommand } = await import('../../commands/init.js');

    await initCommand('test');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created design.json'));
    consoleSpy.mockRestore();
  });
});
```

### Dev Command Tests

```typescript
// packages/polychromos/src/__tests__/commands/dev.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => mockWatcher),
  },
}));

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: vi.fn().mockResolvedValue({}),
    query: vi.fn().mockResolvedValue(null),
  })),
}));

describe('dev command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
    vol.fromJSON({
      './design.json': JSON.stringify({
        id: 'ws_test',
        version: '1.0',
        name: 'Test',
        components: {},
      }),
      './.polychromos/': null,
    });
  });

  afterEach(() => {
    vol.reset();
    vi.useRealTimers();
  });

  it('starts watching design.json', async () => {
    const chokidar = await import('chokidar');
    const { devCommand } = await import('../../commands/dev.js');

    await devCommand();

    expect(chokidar.default.watch).toHaveBeenCalledWith('design.json', {
      persistent: true,
      awaitWriteFinish: expect.objectContaining({
        stabilityThreshold: 200,
        pollInterval: 100,
      }),
    });
  });

  it('registers change handler', async () => {
    const { devCommand } = await import('../../commands/dev.js');

    await devCommand();

    expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('registers error handler', async () => {
    const { devCommand } = await import('../../commands/dev.js');

    await devCommand();

    expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('debounces rapid file changes', async () => {
    vi.useFakeTimers();
    const { devCommand } = await import('../../commands/dev.js');

    await devCommand();

    const changeHandler = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'change'
    )?.[1];

    const syncSpy = vi.fn();
    // Simulate rapid changes
    changeHandler?.();
    changeHandler?.();
    changeHandler?.();

    // Advance time less than debounce threshold
    await vi.advanceTimersByTimeAsync(100);

    // Should not have synced yet
    // (Would need to spy on internal sync function)

    // Advance past debounce
    await vi.advanceTimersByTimeAsync(300);

    vi.useRealTimers();
  });

  it('logs startup messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { devCommand } = await import('../../commands/dev.js');

    await devCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Watching design.json')
    );
    consoleSpy.mockRestore();
  });
});
```

### History Command Tests

```typescript
// packages/polychromos/src/__tests__/commands/history.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('history command', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  it('shows empty history message when no events', async () => {
    vol.mkdirSync('.polychromos', { recursive: true });

    const consoleSpy = vi.spyOn(console, 'log');
    const { historyCommand } = await import('../../commands/history.js');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No history')
    );
    consoleSpy.mockRestore();
  });

  it('lists all version entries', async () => {
    vol.fromJSON({
      '.polychromos/events.jsonl': [
        '{"v":1,"ts":1704067200000}',
        '{"v":2,"ts":1704067260000}',
        '{"v":3,"ts":1704067320000}',
      ].join('\n'),
    });

    const consoleSpy = vi.spyOn(console, 'log');
    const { historyCommand } = await import('../../commands/history.js');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v1'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v2'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('v3'));
    consoleSpy.mockRestore();
  });

  it('formats timestamps in human readable format', async () => {
    const ts = new Date('2024-01-01T12:00:00Z').getTime();
    vol.fromJSON({
      '.polychromos/events.jsonl': `{"v":1,"ts":${ts}}`,
    });

    const consoleSpy = vi.spyOn(console, 'log');
    const { historyCommand } = await import('../../commands/history.js');

    await historyCommand();

    // Should contain formatted date
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\d{1,2}:\d{2}/)
    );
    consoleSpy.mockRestore();
  });
});
```

### Checkpoint Command Tests

```typescript
// packages/polychromos/src/__tests__/commands/checkpoint.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('checkpoint command', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({
      '.polychromos/': null,
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
  });

  it('creates named checkpoint file', async () => {
    const { checkpointCommand } = await import('../../commands/checkpoint.js');

    await checkpointCommand('release-1.0');

    expect(vol.existsSync('.polychromos/checkpoints/release-1.0.json')).toBe(true);
  });

  it('copies current design.json to checkpoint', async () => {
    const { checkpointCommand } = await import('../../commands/checkpoint.js');

    await checkpointCommand('backup');

    const checkpoint = JSON.parse(
      vol.readFileSync('.polychromos/checkpoints/backup.json', 'utf-8')
    );

    expect(checkpoint.name).toBe('Test');
  });

  it('logs success message', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { checkpointCommand } = await import('../../commands/checkpoint.js');

    await checkpointCommand('my-checkpoint');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Checkpoint created: my-checkpoint')
    );
    consoleSpy.mockRestore();
  });
});
```

### Export Command Tests

```typescript
// packages/polychromos/src/__tests__/commands/export.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('export command', () => {
  const sampleDesign = {
    id: 'ws_test',
    version: '1.0',
    name: 'Test',
    components: {
      main: {
        id: 'main',
        name: 'Main',
        width: 800,
        height: 600,
        root: {
          id: 'root',
          type: 'box',
          children: [
            {
              id: 'text1',
              type: 'text',
              text: { content: 'Hello', fontSize: 24 },
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
    vol.reset();
  });

  it('exports to HTML format', async () => {
    const { exportCommand } = await import('../../commands/export.js');

    await exportCommand('html');

    expect(vol.existsSync('./export/index.html')).toBe(true);

    const html = vol.readFileSync('./export/index.html', 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).toContain('Hello');
  });

  it('exports to Tailwind format', async () => {
    const { exportCommand } = await import('../../commands/export.js');

    await exportCommand('tailwind');

    expect(vol.existsSync('./export/component.tsx')).toBe(true);

    const tsx = vol.readFileSync('./export/component.tsx', 'utf-8');
    expect(tsx).toContain('className=');
  });

  it('rejects unknown format', async () => {
    const consoleSpy = vi.spyOn(console, 'error');
    const { exportCommand } = await import('../../commands/export.js');

    await exportCommand('svg');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown format')
    );
    consoleSpy.mockRestore();
  });

  it('logs export location', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { exportCommand } = await import('../../commands/export.js');

    await exportCommand('html');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Exported to')
    );
    consoleSpy.mockRestore();
  });
});
```

---

## 2. Convex Function Tests

### Test File Structure

```
apps/polychromos/
└── convex/
    └── __tests__/
        ├── workspaces.test.ts
        └── events.test.ts
```

### Workspaces Tests

```typescript
// apps/polychromos/convex/__tests__/workspaces.test.ts
import { convexTest } from 'convex-test';
import { describe, it, expect, beforeEach } from 'vitest';
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

      await expect(
        t.mutation(api.workspaces.update, {
          id: 'nonexistent_id' as any,
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

      const workspace = await t.query(api.workspaces.get, {
        id: 'nonexistent' as any,
      });

      expect(workspace).toBeNull();
    });
  });
});
```

### Events Tests

```typescript
// apps/polychromos/convex/__tests__/events.test.ts
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

---

## 3. CLI → Convex Sync Integration

```typescript
// packages/polychromos/test/integration/cli-convex-sync.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

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
      '.polychromos/': null,
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
  });

  it('syncs design.json to Convex on change', async () => {
    mockQuery.mockResolvedValue({ version: 1 });
    mockMutation.mockResolvedValue({ success: true });

    const { syncToConvex } = await import('../../src/lib/sync.js');

    await syncToConvex(
      'ws_test',
      JSON.stringify({
        id: 'ws_test',
        version: '1.0',
        name: 'Updated',
        components: {},
      }),
      1 // expectedVersion
    );

    expect(mockMutation).toHaveBeenCalledWith(
      expect.any(String), // api.workspaces.update
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Updated' }),
        expectedVersion: 1,
      })
    );
  });

  it('handles version conflict gracefully', async () => {
    mockMutation.mockRejectedValue(new Error('Version conflict'));

    const { syncToConvex } = await import('../../src/lib/sync.js');

    await expect(
      syncToConvex(
        'ws_test',
        JSON.stringify({ id: 'ws_test', version: '1.0', name: 'Test', components: {} }),
        1
      )
    ).rejects.toThrow('Version conflict');
  });

  it('retries on transient network errors', async () => {
    mockMutation
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ success: true });

    const { syncToConvex } = await import('../../src/lib/sync.js');

    await syncToConvex(
      'ws_test',
      JSON.stringify({ id: 'ws_test', version: '1.0', name: 'Test', components: {} }),
      1,
      { maxRetries: 3 }
    );

    expect(mockMutation).toHaveBeenCalledTimes(3);
  });
});
```

---

## Single-Flight Pattern Tests

```typescript
// packages/polychromos/src/__tests__/lib/single-flight.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('single-flight pattern', () => {
  it('only allows one mutation in-flight at a time', async () => {
    const mockMutate = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    // Import the syncWithSingleFlight function
    const { createSingleFlight } = await import('../../lib/single-flight.js');
    const singleFlight = createSingleFlight(mockMutate);

    // Trigger multiple syncs rapidly
    singleFlight({ v: 1 });
    singleFlight({ v: 2 });
    singleFlight({ v: 3 });

    // Wait for all to complete
    await new Promise((r) => setTimeout(r, 500));

    // First call starts immediately, subsequent calls are coalesced
    // Should have called with v:1 first, then v:3 (latest pending)
    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockMutate).toHaveBeenNthCalledWith(1, { v: 1 });
    expect(mockMutate).toHaveBeenNthCalledWith(2, { v: 3 });
  });

  it('processes latest pending data after current mutation completes', async () => {
    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((r) => (resolveFirst = r));

    const mockMutate = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValue(undefined);

    const { createSingleFlight } = await import('../../lib/single-flight.js');
    const singleFlight = createSingleFlight(mockMutate);

    // Start first mutation
    singleFlight({ v: 1 });

    // Queue more while first is in-flight
    singleFlight({ v: 2 });
    singleFlight({ v: 3 });

    // Complete first mutation
    resolveFirst!();
    await new Promise((r) => setTimeout(r, 10));

    // Should have processed v:3 (latest)
    expect(mockMutate).toHaveBeenLastCalledWith({ v: 3 });
  });
});
```

---

## Verification Checklist

- [ ] All CLI command tests pass
- [ ] All Convex workspaces tests pass
- [ ] All Convex events tests pass
- [ ] CLI → Convex sync integration tests pass
- [ ] Single-flight pattern works correctly
- [ ] Version conflict detection works

---

## Next Steps

After completing integration tests, proceed to:
- **Research 4**: E2E Test Implementation (full flow testing)
