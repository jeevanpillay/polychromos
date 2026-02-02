import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock ConvexHttpClient at module level
const mockQuery = vi.fn();
const mockSetAuth = vi.fn();
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    setAuth: mockSetAuth,
  })),
}));

// Mock credentials
vi.mock('../../lib/credentials.js', () => ({
  getValidToken: vi.fn().mockResolvedValue('mock-token'),
}));

describe('history command', () => {
  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
    // Reset modules to ensure fresh imports with our mocks
    vi.resetModules();
    // Re-setup the mock after module reset
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: vi.fn().mockImplementation(() => ({
        query: mockQuery,
        setAuth: mockSetAuth,
      })),
    }));
    // Re-setup credentials mock
    vi.doMock('../../lib/credentials.js', () => ({
      getValidToken: vi.fn().mockResolvedValue('mock-token'),
    }));
    // Create root directory
    vol.mkdirSync(process.cwd(), { recursive: true });
    // Setup config for Convex
    vol.fromJSON(
      {
        '.polychromos/config.json': JSON.stringify({
          convexUrl: 'https://test.convex.cloud',
          workspaceId: 'test_workspace_id',
        }),
      },
      process.cwd(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows empty history message when no events', async () => {
    mockQuery
      .mockResolvedValueOnce({ eventVersion: 0, maxEventVersion: 0 }) // workspace
      .mockResolvedValueOnce([]); // history

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { historyCommand } = await import('../../commands/history.js');

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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { historyCommand } = await import('../../commands/history.js');

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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { historyCommand } = await import('../../commands/history.js');

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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { historyCommand } = await import('../../commands/history.js');

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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { historyCommand } = await import('../../commands/history.js');

    await historyCommand();

    expect(consoleSpy).toHaveBeenCalledWith('Current: v2 / Max: v3');

    consoleSpy.mockRestore();
  });

  it('exits with error when no Convex config', async () => {
    vol.reset();
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Make process.exit throw to stop execution
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });
    const { historyCommand } = await import('../../commands/history.js');

    await expect(historyCommand()).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith('No Convex configuration found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
