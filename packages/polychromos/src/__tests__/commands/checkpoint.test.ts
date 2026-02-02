import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import { checkpointCommand } from '../../commands/checkpoint';

interface VersionEntry {
  v: number;
  ts: number;
  patches: unknown[];
  checkpoint?: string;
}

describe('checkpoint command', () => {
  beforeEach(() => {
    vol.reset();
    // Create root directory
    vol.mkdirSync(process.cwd(), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('creates checkpoint entry in events.jsonl', async () => {
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });
    vol.writeFileSync(`${process.cwd()}/.polychromos/events.jsonl`, '{"v":1,"ts":1000,"patches":[]}\n');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await checkpointCommand('release-1.0');

    const content = vol.readFileSync(`${process.cwd()}/.polychromos/events.jsonl`, 'utf-8') as string;
    const lines = content.trim().split('\n');
    const lastLine = lines.at(-1);
    expect(lastLine).toBeDefined();
    const lastEntry = JSON.parse(lastLine ?? '') as VersionEntry;

    expect(lastEntry.checkpoint).toBe('release-1.0');
    expect(lastEntry.patches).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('logs success message with checkpoint name', async () => {
    vol.mkdirSync(`${process.cwd()}/.polychromos`, { recursive: true });

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await checkpointCommand('my-checkpoint');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Checkpoint "my-checkpoint" created'),
    );

    consoleSpy.mockRestore();
  });

  it('creates .polychromos directory if it does not exist', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await checkpointCommand('test');

    expect(vol.existsSync(`${process.cwd()}/.polychromos`)).toBe(true);

    consoleSpy.mockRestore();
  });
});
