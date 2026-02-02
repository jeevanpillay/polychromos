import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

interface DesignData {
  name: string;
}

// Mock ConvexHttpClient at module level
const mockMutation = vi.fn();
const mockSetAuth = vi.fn();
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    mutation: mockMutation,
    setAuth: mockSetAuth,
  })),
}));

// Mock credentials
vi.mock('../../lib/credentials.js', () => ({
  getValidToken: vi.fn().mockResolvedValue('mock-token'),
}));

describe('redo command', () => {
  beforeEach(() => {
    vol.reset();
    vi.clearAllMocks();
    // Reset modules to ensure fresh imports with our mocks
    vi.resetModules();
    // Re-setup the mock after module reset
    vi.doMock('convex/browser', () => ({
      ConvexHttpClient: vi.fn().mockImplementation(() => ({
        mutation: mockMutation,
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
        'design.json': JSON.stringify({ name: 'current' }),
      },
      process.cwd(),
    );
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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { redoCommand } = await import('../../commands/redo.js');

    await redoCommand();

    expect(mockMutation).toHaveBeenCalledWith('workspaces:redo', {
      id: 'test_workspace_id',
    });

    const design = JSON.parse(vol.readFileSync(`${process.cwd()}/design.json`, 'utf-8') as string) as DesignData;
    expect(design.name).toBe('next');

    consoleSpy.mockRestore();
  });

  it('logs message when nothing to redo', async () => {
    mockMutation.mockResolvedValue({
      success: false,
      message: 'Nothing to redo',
    });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { redoCommand } = await import('../../commands/redo.js');

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

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { redoCommand } = await import('../../commands/redo.js');

    await redoCommand();

    expect(consoleSpy).toHaveBeenCalledWith('✓ Redone: v1 → v2');

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
    const { redoCommand } = await import('../../commands/redo.js');

    await expect(redoCommand()).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith('No Convex configuration found.');
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
