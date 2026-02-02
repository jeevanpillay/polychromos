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
    // Create root directory
    vol.mkdirSync(process.cwd(), { recursive: true });
    vol.fromJSON(
      {
        './design.json': JSON.stringify(sampleDesign),
      },
      process.cwd(),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports to HTML format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    // Export writes to component name file
    expect(vol.existsSync(`${process.cwd()}/main-component.html`)).toBe(true);

    const html = vol.readFileSync(`${process.cwd()}/main-component.html`, 'utf-8') as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).toContain('Hello World');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('exports to Tailwind format', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('tailwind');

    expect(vol.existsSync(`${process.cwd()}/main-component.tailwind.html`)).toBe(true);

    const html = vol.readFileSync(`${process.cwd()}/main-component.tailwind.html`, 'utf-8') as string;
    expect(html).toContain('tailwindcss');
    expect(html).toContain('class=');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('rejects unknown format', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('svg');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('logs export location', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Exported to'));

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('fails gracefully when design.json is missing', async () => {
    vol.reset(); // Remove design.json
    vol.mkdirSync(process.cwd(), { recursive: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Make process.exit throw to stop execution
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: number | string | null) => {
        throw new Error(`process.exit(${code})`);
      });

    await expect(exportCommand('html')).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error reading design.json'),
      expect.anything(),
    );
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
    vol.writeFileSync(`${process.cwd()}/design.json`, JSON.stringify(designWithScript));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await exportCommand('html');

    const html = vol.readFileSync(`${process.cwd()}/main-component.html`, 'utf-8') as string;
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
