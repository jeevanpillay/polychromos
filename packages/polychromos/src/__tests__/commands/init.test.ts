import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';
import type { PolychromosWorkspace } from '@polychromos/types';
import { initCommand } from '../../commands/init';

describe('init command', () => {
  beforeEach(() => {
    vol.reset();
    // Create the root directory that files will be written to
    vol.mkdirSync(process.cwd(), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates design.json with workspace name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('my-design');

    expect(vol.existsSync('design.json')).toBe(true);

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string) as PolychromosWorkspace;
    expect(content.name).toBe('my-design');

    consoleSpy.mockRestore();
  });

  it('creates workspace with valid schema', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string) as PolychromosWorkspace;

    expect(content.id).toMatch(/^ws_/);
    expect(content.version).toBe('1.0');
    expect(content.components).toBeDefined();
    expect(content.components.main).toBeDefined();
    expect(content.components.main?.root.type).toBe('box');

    consoleSpy.mockRestore();
  });

  it('includes default settings', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string) as PolychromosWorkspace;

    expect(content.settings).toBeDefined();
    expect(content.settings?.defaultUnits).toBe('px');
    expect(content.settings?.rootFontSize).toBe(16);

    consoleSpy.mockRestore();
  });

  it('includes default tokens', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('test');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string) as PolychromosWorkspace;

    expect(content.tokens).toBeDefined();
    expect(content.tokens?.colors?.primary).toBe('#3b82f6');
    expect(content.tokens?.spacing?.md).toBe('16px');

    consoleSpy.mockRestore();
  });

  it('logs success messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('test');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Created design.json'));

    consoleSpy.mockRestore();
  });

  it('includes workspace id in success message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('my-workspace');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Workspace: my-workspace'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID: ws_'));

    consoleSpy.mockRestore();
  });

  it('creates main component with welcome text using workspace name', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await initCommand('Cool Project');

    const content = JSON.parse(vol.readFileSync('design.json', 'utf-8') as string) as PolychromosWorkspace;
    const mainComponent = content.components.main;
    const titleElement = mainComponent?.root.children?.[0];

    expect(titleElement?.text?.content).toBe('Welcome to Cool Project');

    consoleSpy.mockRestore();
  });
});
