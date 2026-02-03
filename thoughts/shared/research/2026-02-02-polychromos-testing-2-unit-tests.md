---
date: 2026-02-02T15:30:00+08:00
researcher: Claude
git_commit: 61c1d8ae9df5da504f08d507da19a52d4765fd6f
branch: feat/polychromos-mvp-implementation
repository: x
topic: "Polychromos Unit Test Implementation"
tags: [research, testing, polychromos, unit-tests, validators, generators]
status: complete
priority: 2
dependencies: [2026-02-02-polychromos-testing-1-infrastructure.md]
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research 2: Polychromos Unit Test Implementation

**Priority**: 2
**Dependencies**: Research 1 (Infrastructure Setup)
**Estimated Effort**: 3-4 hours

## Overview

This document covers unit tests for isolated logic that doesn't require external services. Unit tests form the foundation of the test pyramid (~70% of all tests).

## What This Document Covers

1. Type validators (`@polychromos/types`)
2. Generators (`exportToHTML`, `exportToTailwind`)
3. VersionManager (`packages/polychromos`)
4. Element renderers (React component tests)

---

## 1. Type Validators Tests

### Test File Structure

```
packages/polychromos-types/
└── src/
    └── __tests__/
        └── validators.test.ts
```

### Implementation

```typescript
// packages/polychromos-types/src/__tests__/validators.test.ts
import { describe, it, expect } from 'vitest';
import {
  PolychromosWorkspaceSchema,
  PolychromosComponentSchema,
} from '../validators';

describe('PolychromosWorkspaceSchema', () => {
  const validWorkspace = {
    id: 'ws_123',
    version: '1.0',
    name: 'Test Workspace',
    components: {
      main: {
        id: 'main',
        name: 'Main Component',
        width: 1024,
        height: 768,
        root: {
          id: 'root',
          type: 'box',
        },
      },
    },
  };

  it('validates a complete workspace', () => {
    const result = PolychromosWorkspaceSchema.safeParse(validWorkspace);
    expect(result.success).toBe(true);
  });

  it('validates workspace with settings', () => {
    const workspace = {
      ...validWorkspace,
      settings: {
        defaultUnits: 'px',
        rootFontSize: 16,
      },
    };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(true);
  });

  it('validates workspace with tokens', () => {
    const workspace = {
      ...validWorkspace,
      tokens: {
        colors: { primary: '#3b82f6', background: '#ffffff' },
        spacing: { sm: '8px', md: '16px' },
        fonts: { sans: { family: 'Geist Sans' } },
      },
    };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(true);
  });

  it('rejects invalid version', () => {
    const workspace = { ...validWorkspace, version: '2.0' };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const workspace = { id: 'ws_123' }; // Missing name, version, components
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });

  it('rejects invalid settings units', () => {
    const workspace = {
      ...validWorkspace,
      settings: { defaultUnits: 'em' }, // Only px or rem allowed
    };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });
});

describe('PolychromosComponentSchema', () => {
  it('validates component with root element', () => {
    const component = {
      id: 'main',
      name: 'Main',
      width: 800,
      height: 600,
      root: { id: 'root', type: 'box' },
    };
    const result = PolychromosComponentSchema.safeParse(component);
    expect(result.success).toBe(true);
  });

  it('rejects negative dimensions', () => {
    const component = {
      id: 'main',
      name: 'Main',
      width: -100,
      height: 600,
      root: { id: 'root', type: 'box' },
    };
    const result = PolychromosComponentSchema.safeParse(component);
    expect(result.success).toBe(false);
  });

  it('rejects zero dimensions', () => {
    const component = {
      id: 'main',
      name: 'Main',
      width: 0,
      height: 600,
      root: { id: 'root', type: 'box' },
    };
    const result = PolychromosComponentSchema.safeParse(component);
    expect(result.success).toBe(false);
  });
});

describe('Element type validation', () => {
  const baseElement = { id: 'el_1' };

  it('validates box element', () => {
    const element = { ...baseElement, type: 'box' };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates text element', () => {
    const element = {
      ...baseElement,
      type: 'text',
      text: { content: 'Hello', fontSize: 16 },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates image element with valid URL', () => {
    const element = {
      ...baseElement,
      type: 'image',
      image: { src: 'https://example.com/image.png', alt: 'Test' },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('rejects image element with invalid URL', () => {
    const element = {
      ...baseElement,
      type: 'image',
      image: { src: 'not-a-url' },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(false);
  });

  it('validates webgl element', () => {
    const element = {
      ...baseElement,
      type: 'webgl',
      webgl: { shaderPath: '/shaders/gradient.frag' },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid element type', () => {
    const element = { ...baseElement, type: 'video' }; // Not supported
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(false);
  });
});

describe('Spacing validation', () => {
  it('validates single number padding', () => {
    const element = { id: 'el', type: 'box', padding: 16 };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates 2-tuple padding', () => {
    const element = { id: 'el', type: 'box', padding: [16, 24] };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates 4-tuple padding', () => {
    const element = { id: 'el', type: 'box', padding: [8, 16, 24, 32] };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('rejects 3-tuple padding', () => {
    const element = { id: 'el', type: 'box', padding: [8, 16, 24] };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(false);
  });
});

describe('Layout validation', () => {
  it('validates flex layout', () => {
    const element = {
      id: 'el',
      type: 'box',
      layout: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
      },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates grid layout', () => {
    const element = {
      id: 'el',
      type: 'box',
      layout: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto',
      },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid display value', () => {
    const element = {
      id: 'el',
      type: 'box',
      layout: { display: 'inline-flex' }, // Not allowed
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(false);
  });
});

describe('Nested children validation', () => {
  it('validates nested box with children', () => {
    const element = {
      id: 'parent',
      type: 'box',
      children: [
        { id: 'child1', type: 'text', text: { content: 'Hello' } },
        { id: 'child2', type: 'box' },
      ],
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates deeply nested structure', () => {
    const element = {
      id: 'l1',
      type: 'box',
      children: [{
        id: 'l2',
        type: 'box',
        children: [{
          id: 'l3',
          type: 'text',
          text: { content: 'Deep' },
        }],
      }],
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });
});
```

---

## 2. Generator Tests

### Test File Structure

```
apps/polychromos/
└── src/
    └── lib/
        └── __tests__/
            └── generators.test.ts
```

### Implementation

```typescript
// apps/polychromos/src/lib/__tests__/generators.test.ts
import { describe, it, expect } from 'vitest';
import { exportToHTML, exportToTailwind } from '../generators';
import type { PolychromosElement } from '@polychromos/types';

describe('exportToHTML', () => {
  describe('box element', () => {
    it('generates HTML for simple box', () => {
      const element: PolychromosElement = {
        id: 'box1',
        type: 'box',
        width: 200,
        height: 100,
      };

      const { html, css } = exportToHTML(element);

      expect(html).toContain('<div class="poly-box1">');
      expect(html).toContain('</div>');
      expect(css).toContain('.poly-box1');
      expect(css).toContain('width: 200px');
      expect(css).toContain('height: 100px');
    });

    it('generates HTML for box with style', () => {
      const element: PolychromosElement = {
        id: 'styled',
        type: 'box',
        style: {
          backgroundColor: '#ff0000',
          borderRadius: 8,
          opacity: 0.5,
        },
      };

      const { css } = exportToHTML(element);

      expect(css).toContain('background-color: #ff0000');
      expect(css).toContain('border-radius: 8px');
      expect(css).toContain('opacity: 0.5');
    });

    it('generates HTML for box with layout', () => {
      const element: PolychromosElement = {
        id: 'flex',
        type: 'box',
        layout: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        },
      };

      const { css } = exportToHTML(element);

      expect(css).toContain('display: flex');
      expect(css).toContain('flex-direction: column');
      expect(css).toContain('justify-content: center');
      expect(css).toContain('align-items: center');
      expect(css).toContain('gap: 16px');
    });
  });

  describe('text element', () => {
    it('generates HTML for text', () => {
      const element: PolychromosElement = {
        id: 'text1',
        type: 'text',
        text: {
          content: 'Hello World',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
        },
      };

      const { html, css } = exportToHTML(element);

      expect(html).toContain('<span class="poly-text1">');
      expect(html).toContain('Hello World');
      expect(html).toContain('</span>');
      expect(css).toContain('font-size: 24px');
      expect(css).toContain('font-weight: bold');
      expect(css).toContain('color: #000000');
    });

    it('escapes HTML in text content', () => {
      const element: PolychromosElement = {
        id: 'xss',
        type: 'text',
        text: {
          content: '<script>alert("xss")</script>',
        },
      };

      const { html } = exportToHTML(element);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('image element', () => {
    it('generates HTML for image', () => {
      const element: PolychromosElement = {
        id: 'img1',
        type: 'image',
        width: 300,
        height: 200,
        image: {
          src: 'https://example.com/image.png',
          alt: 'Test image',
          objectFit: 'cover',
        },
      };

      const { html, css } = exportToHTML(element);

      expect(html).toContain('<img');
      expect(html).toContain('class="poly-img1"');
      expect(html).toContain('src="https://example.com/image.png"');
      expect(html).toContain('alt="Test image"');
      expect(css).toContain('object-fit: cover');
    });

    it('escapes quotes in image attributes', () => {
      const element: PolychromosElement = {
        id: 'img2',
        type: 'image',
        image: {
          src: 'https://example.com/image.png',
          alt: 'Image with "quotes"',
        },
      };

      const { html } = exportToHTML(element);

      expect(html).toContain('alt="Image with &quot;quotes&quot;"');
    });
  });

  describe('webgl element', () => {
    it('generates canvas with shader data attribute', () => {
      const element: PolychromosElement = {
        id: 'gl1',
        type: 'webgl',
        width: 400,
        height: 300,
        webgl: {
          shaderPath: '/shaders/gradient.frag',
        },
      };

      const { html } = exportToHTML(element);

      expect(html).toContain('<canvas');
      expect(html).toContain('class="poly-gl1"');
      expect(html).toContain('data-shader="/shaders/gradient.frag"');
    });
  });

  describe('nested elements', () => {
    it('generates HTML for nested children', () => {
      const element: PolychromosElement = {
        id: 'parent',
        type: 'box',
        children: [
          { id: 'child1', type: 'text', text: { content: 'First' } },
          { id: 'child2', type: 'text', text: { content: 'Second' } },
        ],
      };

      const { html } = exportToHTML(element);

      expect(html).toContain('<div class="poly-parent">');
      expect(html).toContain('<span class="poly-child1">First</span>');
      expect(html).toContain('<span class="poly-child2">Second</span>');
      expect(html).toContain('</div>');
    });

    it('preserves indentation for readability', () => {
      const element: PolychromosElement = {
        id: 'parent',
        type: 'box',
        children: [
          { id: 'child', type: 'box' },
        ],
      };

      const { html } = exportToHTML(element);
      const lines = html.split('\n');

      // Child should be indented
      const childLine = lines.find(l => l.includes('poly-child'));
      expect(childLine?.startsWith('  ')).toBe(true);
    });
  });

  describe('spacing formats', () => {
    it('formats single number padding', () => {
      const element: PolychromosElement = {
        id: 'pad1',
        type: 'box',
        padding: 16,
      };

      const { css } = exportToHTML(element);
      expect(css).toContain('padding: 16px');
    });

    it('formats 2-tuple padding', () => {
      const element: PolychromosElement = {
        id: 'pad2',
        type: 'box',
        padding: [16, 24],
      };

      const { css } = exportToHTML(element);
      expect(css).toContain('padding: 16px 24px');
    });

    it('formats 4-tuple padding', () => {
      const element: PolychromosElement = {
        id: 'pad4',
        type: 'box',
        padding: [8, 16, 24, 32],
      };

      const { css } = exportToHTML(element);
      expect(css).toContain('padding: 8px 16px 24px 32px');
    });
  });
});

describe('exportToTailwind', () => {
  describe('layout classes', () => {
    it('generates flex classes', () => {
      const element: PolychromosElement = {
        id: 'flex',
        type: 'box',
        layout: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        },
      };

      const classes = exportToTailwind(element);

      expect(classes).toContain('flex');
      expect(classes).toContain('flex-col');
      expect(classes).toContain('justify-center');
      expect(classes).toContain('items-center');
    });

    it('generates grid classes', () => {
      const element: PolychromosElement = {
        id: 'grid',
        type: 'box',
        layout: { display: 'grid' },
      };

      const classes = exportToTailwind(element);
      expect(classes).toContain('grid');
    });

    it('generates gap with arbitrary value', () => {
      const element: PolychromosElement = {
        id: 'gap',
        type: 'box',
        layout: { display: 'flex', gap: 12 },
      };

      const classes = exportToTailwind(element);
      expect(classes).toContain('gap-[12px]');
    });
  });

  describe('size classes', () => {
    it('generates width and height', () => {
      const element: PolychromosElement = {
        id: 'sized',
        type: 'box',
        width: 200,
        height: 100,
      };

      const classes = exportToTailwind(element);

      expect(classes).toContain('w-[200px]');
      expect(classes).toContain('h-[100px]');
    });

    it('handles string dimensions', () => {
      const element: PolychromosElement = {
        id: 'full',
        type: 'box',
        width: '100%',
        height: '50vh',
      };

      const classes = exportToTailwind(element);

      // String dimensions may need different handling
      expect(classes).toBeDefined();
    });
  });

  describe('spacing classes', () => {
    it('generates single padding', () => {
      const element: PolychromosElement = {
        id: 'pad',
        type: 'box',
        padding: 16,
      };

      const classes = exportToTailwind(element);
      expect(classes).toContain('p-[16px]');
    });

    it('generates vertical/horizontal padding', () => {
      const element: PolychromosElement = {
        id: 'pad',
        type: 'box',
        padding: [16, 24],
      };

      const classes = exportToTailwind(element);

      expect(classes).toContain('py-[16px]');
      expect(classes).toContain('px-[24px]');
    });

    it('generates four-sided padding', () => {
      const element: PolychromosElement = {
        id: 'pad',
        type: 'box',
        padding: [8, 16, 24, 32],
      };

      const classes = exportToTailwind(element);

      expect(classes).toContain('pt-[8px]');
      expect(classes).toContain('pr-[16px]');
      expect(classes).toContain('pb-[24px]');
      expect(classes).toContain('pl-[32px]');
    });
  });

  describe('style classes', () => {
    it('generates background color', () => {
      const element: PolychromosElement = {
        id: 'bg',
        type: 'box',
        style: { backgroundColor: '#3b82f6' },
      };

      const classes = exportToTailwind(element);
      expect(classes).toContain('bg-[#3b82f6]');
    });

    it('generates border radius', () => {
      const element: PolychromosElement = {
        id: 'rounded',
        type: 'box',
        style: { borderRadius: 8 },
      };

      const classes = exportToTailwind(element);
      expect(classes).toContain('rounded-[8px]');
    });
  });

  describe('typography classes', () => {
    it('generates text element classes', () => {
      const element: PolychromosElement = {
        id: 'text',
        type: 'text',
        text: {
          content: 'Hello',
          fontSize: 24,
          fontWeight: 'bold',
          color: '#000000',
          textAlign: 'center',
        },
      };

      const classes = exportToTailwind(element);

      expect(classes).toContain('text-[24px]');
      expect(classes).toContain('font-[bold]');
      expect(classes).toContain('text-[#000000]');
      expect(classes).toContain('text-center');
    });
  });
});
```

---

## 3. VersionManager Tests

### Test File Structure

```
packages/polychromos/
└── src/
    └── lib/
        └── __tests__/
            └── version-manager.test.ts
```

### Implementation

```typescript
// packages/polychromos/src/lib/__tests__/version-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs module
vi.mock('node:fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('VersionManager', () => {
  beforeEach(() => {
    vol.reset();
  });

  afterEach(() => {
    vol.reset();
  });

  describe('init', () => {
    it('creates .polychromos directory if it does not exist', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');

      await vm.init();

      expect(vol.existsSync('.polychromos')).toBe(true);
    });

    it('does not fail if directory already exists', async () => {
      vol.mkdirSync('.polychromos', { recursive: true });

      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');

      await expect(vm.init()).resolves.not.toThrow();
    });

    it('loads existing event log version count', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1}\n{"v":2}\n{"v":3}\n',
      });

      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(3);
    });

    it('starts at version 0 if no event log exists', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(0);
    });
  });

  describe('recordChange', () => {
    it('increments version number', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      expect(vm.getVersion()).toBe(1);
    });

    it('appends to events.jsonl', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'first' });
      await vm.recordChange({ name: 'second' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      expect(entry1.v).toBe(1);
      expect(entry2.v).toBe(2);
    });

    it('includes timestamp in entry', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.ts).toBe(now);

      vi.useRealTimers();
    });
  });

  describe('list', () => {
    it('returns empty array if no events', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = await vm.list();

      expect(history).toEqual([]);
    });

    it('returns all events in order', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1,"ts":1000}\n{"v":2,"ts":2000}\n',
      });

      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = await vm.list();

      expect(history).toHaveLength(2);
      expect(history[0].v).toBe(1);
      expect(history[1].v).toBe(2);
    });
  });

  describe('getVersion', () => {
    it('returns current version', async () => {
      const { VersionManager } = await import('../version-manager.js');
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(0);

      await vm.recordChange({});
      expect(vm.getVersion()).toBe(1);

      await vm.recordChange({});
      expect(vm.getVersion()).toBe(2);
    });
  });
});
```

---

## 4. Element Renderer Tests

### Test File Structure

```
apps/polychromos/
└── src/
    └── components/
        └── element-renderers/
            └── __tests__/
                ├── box.test.tsx
                ├── text.test.tsx
                └── image.test.tsx
```

### Implementation

```typescript
// apps/polychromos/src/components/element-renderers/__tests__/box.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Box } from '../box';
import type { PolychromosElement } from '@polychromos/types';

describe('Box renderer', () => {
  it('renders a div', () => {
    const element: PolychromosElement = {
      id: 'box1',
      type: 'box',
    };

    render(<Box element={element} />);

    const div = screen.getByTestId('element-box1');
    expect(div.tagName).toBe('DIV');
  });

  it('applies width and height styles', () => {
    const element: PolychromosElement = {
      id: 'sized',
      type: 'box',
      width: 200,
      height: 100,
    };

    render(<Box element={element} />);

    const div = screen.getByTestId('element-sized');
    expect(div).toHaveStyle({ width: '200px', height: '100px' });
  });

  it('applies flex layout styles', () => {
    const element: PolychromosElement = {
      id: 'flex',
      type: 'box',
      layout: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      },
    };

    render(<Box element={element} />);

    const div = screen.getByTestId('element-flex');
    expect(div).toHaveStyle({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    });
  });

  it('applies background color', () => {
    const element: PolychromosElement = {
      id: 'colored',
      type: 'box',
      style: { backgroundColor: '#ff0000' },
    };

    render(<Box element={element} />);

    const div = screen.getByTestId('element-colored');
    expect(div).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('renders children', () => {
    const element: PolychromosElement = {
      id: 'parent',
      type: 'box',
      children: [
        { id: 'child1', type: 'box' },
        { id: 'child2', type: 'box' },
      ],
    };

    render(<Box element={element} />);

    expect(screen.getByTestId('element-child1')).toBeInTheDocument();
    expect(screen.getByTestId('element-child2')).toBeInTheDocument();
  });
});

// apps/polychromos/src/components/element-renderers/__tests__/text.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Text } from '../text';
import type { PolychromosElement } from '@polychromos/types';

describe('Text renderer', () => {
  it('renders text content', () => {
    const element: PolychromosElement = {
      id: 'text1',
      type: 'text',
      text: { content: 'Hello World' },
    };

    render(<Text element={element} />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('applies typography styles', () => {
    const element: PolychromosElement = {
      id: 'styled',
      type: 'text',
      text: {
        content: 'Styled',
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333333',
      },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Styled');
    expect(span).toHaveStyle({
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#333333',
    });
  });

  it('renders empty span if no text config', () => {
    const element: PolychromosElement = {
      id: 'empty',
      type: 'text',
    };

    render(<Text element={element} />);

    const span = screen.getByTestId('element-empty');
    expect(span.textContent).toBe('');
  });
});

// apps/polychromos/src/components/element-renderers/__tests__/image.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Image } from '../image';
import type { PolychromosElement } from '@polychromos/types';

describe('Image renderer', () => {
  it('renders img tag with src', () => {
    const element: PolychromosElement = {
      id: 'img1',
      type: 'image',
      image: {
        src: 'https://example.com/image.png',
        alt: 'Test image',
      },
    };

    render(<Image element={element} />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    expect(img).toHaveAttribute('alt', 'Test image');
  });

  it('applies object-fit style', () => {
    const element: PolychromosElement = {
      id: 'cover',
      type: 'image',
      image: {
        src: 'https://example.com/image.png',
        objectFit: 'cover',
      },
    };

    render(<Image element={element} />);

    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ objectFit: 'cover' });
  });

  it('returns null if no image config', () => {
    const element: PolychromosElement = {
      id: 'noimg',
      type: 'image',
    };

    const { container } = render(<Image element={element} />);

    expect(container.firstChild).toBeNull();
  });
});
```

---

## Test Data Fixtures

```typescript
// packages/polychromos/test/fixtures/sample-workspace.ts
import type { PolychromosWorkspace } from '@polychromos/types';

export const sampleWorkspace: PolychromosWorkspace = {
  id: 'ws_test',
  version: '1.0',
  name: 'Test Workspace',
  settings: {
    defaultUnits: 'px',
    rootFontSize: 16,
  },
  tokens: {
    colors: {
      primary: '#3b82f6',
      background: '#ffffff',
      foreground: '#000000',
    },
    spacing: {
      sm: '8px',
      md: '16px',
      lg: '24px',
    },
  },
  components: {
    main: {
      id: 'main',
      name: 'Main Component',
      width: 1024,
      height: 768,
      root: {
        id: 'root',
        type: 'box',
        layout: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
        width: '100%',
        height: '100%',
        style: {
          backgroundColor: '#ffffff',
        },
        children: [
          {
            id: 'title',
            type: 'text',
            text: {
              content: 'Welcome',
              fontSize: 32,
              fontWeight: 'bold',
              color: '#000000',
            },
          },
          {
            id: 'subtitle',
            type: 'text',
            text: {
              content: 'Edit to see changes',
              fontSize: 16,
              color: '#666666',
            },
            margin: [16, 0, 0, 0],
          },
        ],
      },
    },
  },
};
```

---

## Verification Checklist

- [ ] `pnpm --filter @polychromos/types test` passes
- [ ] `pnpm --filter @polychromos/polychromos test src/lib` passes
- [ ] `pnpm --filter @polychromos/cli test` passes
- [ ] Coverage reports show >80% for validators
- [ ] Coverage reports show >80% for generators
- [ ] Coverage reports show >80% for version manager

---

## Next Steps

After completing unit tests, proceed to:
- **Research 3**: Integration Test Implementation (CLI commands, Convex sync)
