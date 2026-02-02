import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

describe('CLI to Convex sync integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({
        convexUrl: 'https://test.convex.cloud',
        workspaceId: 'ws_test123',
      }),
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

  it('returns null when config file is missing', async () => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.mkdirSync('.polychromos', { recursive: true });

    const { loadConfig } = await import('../../src/lib/config.js');

    const config = await loadConfig();

    expect(config).toBeNull();
  });

  it('returns null when config is missing required fields', async () => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.fromJSON({
      '.polychromos/config.json': JSON.stringify({ convexUrl: 'test' }), // missing workspaceId
    });

    const { loadConfig } = await import('../../src/lib/config.js');

    const config = await loadConfig();

    expect(config).toBeNull();
  });

  it('saves config correctly', async () => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.mkdirSync('.polychromos', { recursive: true });

    const { saveConfig } = await import('../../src/lib/config.js');

    await saveConfig({
      convexUrl: 'https://new.convex.cloud',
      workspaceId: 'ws_new',
    });

    const content = JSON.parse(
      vol.readFileSync('.polychromos/config.json', 'utf-8') as string,
    ) as { convexUrl: string; workspaceId: string };
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

    let resolveFirst: (() => void) | undefined;
    const firstPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

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
