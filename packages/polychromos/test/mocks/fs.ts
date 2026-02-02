import { vol } from 'memfs';
import { vi } from 'vitest';

export function mockFileSystem(files: Record<string, string> = {}) {
  vol.reset();
  vol.fromJSON(files);

  vi.mock('fs/promises', async () => {
    const memfs = await import('memfs');
    return memfs.fs.promises;
  });
}

export function resetFileSystem() {
  vol.reset();
  vi.restoreAllMocks();
}
