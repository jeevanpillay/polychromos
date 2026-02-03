# Polychromos Unit Test Implementation Plan

## Overview

Implement comprehensive unit tests for the Polychromos design system following Research 2 specifications. This covers validators (`@polychromos/types`), generators (`apps/polychromos-app`), VersionManager (`packages/polychromos`), and element renderers (`apps/polychromos-app`).

## Current State Analysis

### Infrastructure Implemented (Research 1)
- Vitest configs at root, `packages/polychromos`, `packages/polychromos-types`, `apps/polychromos-app`
- Test setup files in each package
- Filesystem mocking with memfs in `packages/polychromos/test/mocks/fs.ts`
- Convex testing helpers in `apps/polychromos-app/test/`
- GitHub workflow at `.github/workflows/test.yml`

### Current Test Status
- `packages/polychromos-types/src/validators.test.ts` - Only placeholder test
- No other test files exist

### Key Discoveries
- `escapeHTML()` in generators.ts:139-143 uses `document.createElement()` - requires refactoring for Node environment
- Element renderers use React components with `useMemo` - need jsdom + @testing-library/react
- VersionManager uses fs/promises - memfs mock infrastructure already exists
- Validators use Zod schemas with recursive lazy evaluation for nested elements

## Desired End State

All unit tests from Research 2 implemented with >80% coverage for:
- Type validators in `packages/polychromos-types`
- Generators in `apps/polychromos-app/src/lib`
- VersionManager in `packages/polychromos/src/lib`
- Element renderers in `apps/polychromos-app/src/components/element-renderers`

### Verification Commands
```bash
pnpm --filter @polychromos/types test        # Validators pass
pnpm --filter @polychromos/cli test          # VersionManager pass
pnpm --filter polychromos-app test           # Generators + renderers pass
pnpm test                                     # All tests pass from root
```

## What We're NOT Doing

- Integration tests (covered in Research 3)
- E2E tests (covered in Research 4)
- Convex function tests (covered in Research 3)
- CLI command tests (integration scope)

## Test Fixture Strategy

**Decision**: Add test fixtures as a separate export from `@polychromos/types`

**Rationale**:
1. Follows existing multi-export pattern (`./schema`, `./validators`)
2. Fixtures are tightly coupled to the types they represent
3. All test-consuming packages already depend on `@polychromos/types`
4. Avoids creating a new package for small test data
5. Single source of truth prevents drift

**Structure**:
```
packages/polychromos-types/
└── src/
    ├── fixtures/
    │   ├── index.ts           # Export all fixtures
    │   ├── workspaces.ts      # Sample workspaces
    │   ├── components.ts      # Sample components
    │   └── elements.ts        # Sample elements
    └── ...
```

**Export**:
```json
{
  "exports": {
    "./fixtures": "./src/fixtures/index.ts"
  }
}
```

---

## Phase 1: Test Fixtures in @polychromos/types

### Overview
Create shared test fixtures that all packages can import for consistent test data.

### Changes Required

#### 1. Create Fixtures Directory and Files

**File**: `packages/polychromos-types/src/fixtures/elements.ts`
```typescript
import type { PolychromosElement } from '../schema';

export const simpleBoxElement: PolychromosElement = {
  id: 'box1',
  type: 'box',
  width: 200,
  height: 100,
};

export const styledBoxElement: PolychromosElement = {
  id: 'styled-box',
  type: 'box',
  width: 300,
  height: 200,
  style: {
    backgroundColor: '#ff0000',
    borderRadius: 8,
    opacity: 0.5,
  },
};

export const flexBoxElement: PolychromosElement = {
  id: 'flex-box',
  type: 'box',
  layout: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
};

export const gridBoxElement: PolychromosElement = {
  id: 'grid-box',
  type: 'box',
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto',
  },
};

export const textElement: PolychromosElement = {
  id: 'text1',
  type: 'text',
  text: {
    content: 'Hello World',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
};

export const imageElement: PolychromosElement = {
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

export const webglElement: PolychromosElement = {
  id: 'gl1',
  type: 'webgl',
  width: 400,
  height: 300,
  webgl: {
    shaderPath: '/shaders/gradient.frag',
  },
};

export const nestedBoxElement: PolychromosElement = {
  id: 'parent',
  type: 'box',
  children: [
    { id: 'child1', type: 'text', text: { content: 'First' } },
    { id: 'child2', type: 'text', text: { content: 'Second' } },
  ],
};

export const deeplyNestedElement: PolychromosElement = {
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

export const paddedBoxElement: PolychromosElement = {
  id: 'padded',
  type: 'box',
  padding: 16,
};

export const paddedBox2Tuple: PolychromosElement = {
  id: 'padded-2',
  type: 'box',
  padding: [16, 24],
};

export const paddedBox4Tuple: PolychromosElement = {
  id: 'padded-4',
  type: 'box',
  padding: [8, 16, 24, 32],
};
```

**File**: `packages/polychromos-types/src/fixtures/components.ts`
```typescript
import type { PolychromosComponent } from '../schema';

export const simpleComponent: PolychromosComponent = {
  id: 'main',
  name: 'Main Component',
  width: 1024,
  height: 768,
  root: {
    id: 'root',
    type: 'box',
  },
};

export const componentWithTextRoot: PolychromosComponent = {
  id: 'text-comp',
  name: 'Text Component',
  width: 800,
  height: 600,
  root: {
    id: 'text-root',
    type: 'text',
    text: { content: 'Hello' },
  },
};
```

**File**: `packages/polychromos-types/src/fixtures/workspaces.ts`
```typescript
import type { PolychromosWorkspace } from '../schema';

export const minimalWorkspace: PolychromosWorkspace = {
  id: 'ws_minimal',
  version: '1.0',
  name: 'Minimal Workspace',
  components: {
    main: {
      id: 'main',
      name: 'Main Component',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const workspaceWithSettings: PolychromosWorkspace = {
  id: 'ws_settings',
  version: '1.0',
  name: 'Workspace with Settings',
  settings: {
    defaultUnits: 'px',
    rootFontSize: 16,
  },
  components: {
    main: {
      id: 'main',
      name: 'Main',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const workspaceWithTokens: PolychromosWorkspace = {
  id: 'ws_tokens',
  version: '1.0',
  name: 'Workspace with Tokens',
  tokens: {
    colors: { primary: '#3b82f6', background: '#ffffff' },
    spacing: { sm: '8px', md: '16px' },
    fonts: { sans: { family: 'Geist Sans' } },
  },
  components: {
    main: {
      id: 'main',
      name: 'Main',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const fullWorkspace: PolychromosWorkspace = {
  id: 'ws_full',
  version: '1.0',
  name: 'Full Workspace',
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

**File**: `packages/polychromos-types/src/fixtures/index.ts`
```typescript
export * from './elements';
export * from './components';
export * from './workspaces';
```

#### 2. Update Package Exports

**File**: `packages/polychromos-types/package.json`
**Changes**: Add fixtures export

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./validators": "./src/validators.ts",
    "./fixtures": "./src/fixtures/index.ts"
  }
}
```

### Success Criteria

#### Automated Verification
- [x] TypeScript compiles: `pnpm --filter @polychromos/types typecheck`
- [x] Fixtures can be imported: Create a test that imports from `@polychromos/fixtures`

#### Manual Verification
- [x] Confirm fixtures match type definitions

---

## Phase 2: Validator Unit Tests

### Overview
Implement comprehensive validator tests for all Zod schemas in `@polychromos/types`.

### Changes Required

#### 1. Replace Placeholder Test

**File**: `packages/polychromos-types/src/validators.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import {
  PolychromosWorkspaceSchema,
  PolychromosComponentSchema,
} from './validators';
import {
  minimalWorkspace,
  workspaceWithSettings,
  workspaceWithTokens,
  simpleComponent,
} from './fixtures';

describe('PolychromosWorkspaceSchema', () => {
  it('validates a minimal workspace', () => {
    const result = PolychromosWorkspaceSchema.safeParse(minimalWorkspace);
    expect(result.success).toBe(true);
  });

  it('validates workspace with settings', () => {
    const result = PolychromosWorkspaceSchema.safeParse(workspaceWithSettings);
    expect(result.success).toBe(true);
  });

  it('validates workspace with tokens', () => {
    const result = PolychromosWorkspaceSchema.safeParse(workspaceWithTokens);
    expect(result.success).toBe(true);
  });

  it('rejects invalid version', () => {
    const workspace = { ...minimalWorkspace, version: '2.0' };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const workspace = { id: 'ws_123' };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });

  it('rejects invalid settings units', () => {
    const workspace = {
      ...minimalWorkspace,
      settings: { defaultUnits: 'em' },
    };
    const result = PolychromosWorkspaceSchema.safeParse(workspace);
    expect(result.success).toBe(false);
  });
});

describe('PolychromosComponentSchema', () => {
  it('validates component with root element', () => {
    const result = PolychromosComponentSchema.safeParse(simpleComponent);
    expect(result.success).toBe(true);
  });

  it('rejects negative dimensions', () => {
    const component = { ...simpleComponent, width: -100 };
    const result = PolychromosComponentSchema.safeParse(component);
    expect(result.success).toBe(false);
  });

  it('rejects zero dimensions', () => {
    const component = { ...simpleComponent, width: 0 };
    const result = PolychromosComponentSchema.safeParse(component);
    expect(result.success).toBe(false);
  });
});

describe('Element type validation', () => {
  it('validates box element', () => {
    const element = { id: 'el_1', type: 'box' };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('validates text element', () => {
    const element = {
      id: 'el_1',
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
      id: 'el_1',
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
      id: 'el_1',
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
      id: 'el_1',
      type: 'webgl',
      webgl: { shaderPath: '/shaders/gradient.frag' },
    };
    const result = PolychromosComponentSchema.safeParse({
      id: 'c', name: 'c', width: 100, height: 100, root: element,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid element type', () => {
    const element = { id: 'el_1', type: 'video' };
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
      layout: { display: 'inline-flex' },
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

### Success Criteria

#### Automated Verification
- [x] Tests pass: `pnpm --filter @polychromos/types test`
- [x] Coverage >80%: `pnpm --filter @polychromos/types test:coverage`

#### Manual Verification
- [x] Review test output for comprehensive coverage of edge cases

**Implementation Note**: After completing this phase and automated verification passes, pause for confirmation before proceeding.

---

## Phase 3: Generator Unit Tests

### Overview
Implement unit tests for `exportToHTML` and `exportToTailwind` generators. Requires refactoring `escapeHTML` for Node compatibility.

### Changes Required

#### 1. Refactor escapeHTML for Node Environment

**File**: `apps/polychromos-app/src/lib/generators.ts`
**Changes**: Replace DOM-based escapeHTML with pure string implementation

```typescript
// Replace lines 139-143
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

#### 2. Create Generator Tests

**File**: `apps/polychromos-app/src/lib/__tests__/generators.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { exportToHTML, exportToTailwind } from '../generators';
import {
  simpleBoxElement,
  styledBoxElement,
  flexBoxElement,
  textElement,
  imageElement,
  webglElement,
  nestedBoxElement,
  paddedBoxElement,
  paddedBox2Tuple,
  paddedBox4Tuple,
} from '@polychromos/types/fixtures';

describe('exportToHTML', () => {
  describe('box element', () => {
    it('generates HTML for simple box', () => {
      const { html, css } = exportToHTML(simpleBoxElement);

      expect(html).toContain('<div class="poly-box1">');
      expect(html).toContain('</div>');
      expect(css).toContain('.poly-box1');
      expect(css).toContain('width: 200px');
      expect(css).toContain('height: 100px');
    });

    it('generates HTML for box with style', () => {
      const { css } = exportToHTML(styledBoxElement);

      expect(css).toContain('background-color: #ff0000');
      expect(css).toContain('border-radius: 8px');
      expect(css).toContain('opacity: 0.5');
    });

    it('generates HTML for box with layout', () => {
      const { css } = exportToHTML(flexBoxElement);

      expect(css).toContain('display: flex');
      expect(css).toContain('flex-direction: column');
      expect(css).toContain('justify-content: center');
      expect(css).toContain('align-items: center');
      expect(css).toContain('gap: 16px');
    });
  });

  describe('text element', () => {
    it('generates HTML for text', () => {
      const { html, css } = exportToHTML(textElement);

      expect(html).toContain('<span class="poly-text1">');
      expect(html).toContain('Hello World');
      expect(html).toContain('</span>');
      expect(css).toContain('font-size: 24px');
      expect(css).toContain('font-weight: bold');
      expect(css).toContain('color: #000000');
    });

    it('escapes HTML in text content', () => {
      const xssElement = {
        id: 'xss',
        type: 'text' as const,
        text: {
          content: '<script>alert("xss")</script>',
        },
      };

      const { html } = exportToHTML(xssElement);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('image element', () => {
    it('generates HTML for image', () => {
      const { html, css } = exportToHTML(imageElement);

      expect(html).toContain('<img');
      expect(html).toContain('class="poly-img1"');
      expect(html).toContain('src="https://example.com/image.png"');
      expect(html).toContain('alt="Test image"');
      expect(css).toContain('object-fit: cover');
    });

    it('escapes quotes in image attributes', () => {
      const imgWithQuotes = {
        id: 'img2',
        type: 'image' as const,
        image: {
          src: 'https://example.com/image.png',
          alt: 'Image with "quotes"',
        },
      };

      const { html } = exportToHTML(imgWithQuotes);

      expect(html).toContain('alt="Image with &quot;quotes&quot;"');
    });
  });

  describe('webgl element', () => {
    it('generates canvas with shader data attribute', () => {
      const { html } = exportToHTML(webglElement);

      expect(html).toContain('<canvas');
      expect(html).toContain('class="poly-gl1"');
      expect(html).toContain('data-shader="/shaders/gradient.frag"');
    });
  });

  describe('nested elements', () => {
    it('generates HTML for nested children', () => {
      const { html } = exportToHTML(nestedBoxElement);

      expect(html).toContain('<div class="poly-parent">');
      expect(html).toContain('<span class="poly-child1">First</span>');
      expect(html).toContain('<span class="poly-child2">Second</span>');
      expect(html).toContain('</div>');
    });

    it('preserves indentation for readability', () => {
      const { html } = exportToHTML(nestedBoxElement);
      const lines = html.split('\n');

      const childLine = lines.find(l => l.includes('poly-child1'));
      expect(childLine?.startsWith('  ')).toBe(true);
    });
  });

  describe('spacing formats', () => {
    it('formats single number padding', () => {
      const { css } = exportToHTML(paddedBoxElement);
      expect(css).toContain('padding: 16px');
    });

    it('formats 2-tuple padding', () => {
      const { css } = exportToHTML(paddedBox2Tuple);
      expect(css).toContain('padding: 16px 24px');
    });

    it('formats 4-tuple padding', () => {
      const { css } = exportToHTML(paddedBox4Tuple);
      expect(css).toContain('padding: 8px 16px 24px 32px');
    });
  });
});

describe('exportToTailwind', () => {
  describe('layout classes', () => {
    it('generates flex classes', () => {
      const classes = exportToTailwind(flexBoxElement);

      expect(classes).toContain('flex');
      expect(classes).toContain('flex-col');
      expect(classes).toContain('justify-center');
      expect(classes).toContain('items-center');
    });

    it('generates grid classes', () => {
      const gridElement = {
        id: 'grid',
        type: 'box' as const,
        layout: { display: 'grid' as const },
      };

      const classes = exportToTailwind(gridElement);
      expect(classes).toContain('grid');
    });

    it('generates gap with arbitrary value', () => {
      const classes = exportToTailwind(flexBoxElement);
      expect(classes).toContain('gap-[16px]');
    });
  });

  describe('size classes', () => {
    it('generates width and height', () => {
      const classes = exportToTailwind(simpleBoxElement);

      expect(classes).toContain('w-[200px]');
      expect(classes).toContain('h-[100px]');
    });

    it('handles string dimensions', () => {
      const fullWidthElement = {
        id: 'full',
        type: 'box' as const,
        width: '100%',
        height: '50vh',
      };

      const classes = exportToTailwind(fullWidthElement);
      expect(classes).toBeDefined();
    });
  });

  describe('spacing classes', () => {
    it('generates single padding', () => {
      const classes = exportToTailwind(paddedBoxElement);
      expect(classes).toContain('p-[16px]');
    });

    it('generates vertical/horizontal padding', () => {
      const classes = exportToTailwind(paddedBox2Tuple);

      expect(classes).toContain('py-[16px]');
      expect(classes).toContain('px-[24px]');
    });

    it('generates four-sided padding', () => {
      const classes = exportToTailwind(paddedBox4Tuple);

      expect(classes).toContain('pt-[8px]');
      expect(classes).toContain('pr-[16px]');
      expect(classes).toContain('pb-[24px]');
      expect(classes).toContain('pl-[32px]');
    });
  });

  describe('style classes', () => {
    it('generates background color', () => {
      const classes = exportToTailwind(styledBoxElement);
      expect(classes).toContain('bg-[#ff0000]');
    });

    it('generates border radius', () => {
      const classes = exportToTailwind(styledBoxElement);
      expect(classes).toContain('rounded-[8px]');
    });
  });

  describe('typography classes', () => {
    it('generates text element classes', () => {
      const classes = exportToTailwind(textElement);

      expect(classes).toContain('text-[24px]');
      expect(classes).toContain('font-[bold]');
      expect(classes).toContain('text-[#000000]');
    });
  });
});
```

### Success Criteria

#### Automated Verification
- [x] Tests pass: `pnpm --filter polychromos-app test src/lib`
- [x] Coverage >80% for generators.ts

#### Manual Verification
- [x] Confirm escapeHTML refactor doesn't break app functionality

**Implementation Note**: Pause for confirmation after this phase.

---

## Phase 4: VersionManager Unit Tests

### Overview
Implement unit tests for the VersionManager class using memfs for filesystem mocking.

### Changes Required

#### 1. Update Test Setup

**File**: `packages/polychromos/test/setup.ts`
```typescript
import { beforeEach, vi } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

beforeEach(() => {
  // Reset filesystem between tests
  vol.reset();
});
```

#### 2. Create VersionManager Tests

**File**: `packages/polychromos/src/lib/__tests__/version-manager.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { VersionManager } from '../version-manager';

describe('VersionManager', () => {
  beforeEach(() => {
    vol.reset();
    vi.useRealTimers();
  });

  describe('init', () => {
    it('creates .polychromos directory if it does not exist', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vol.existsSync('.polychromos')).toBe(true);
    });

    it('does not fail if directory already exists', async () => {
      vol.mkdirSync('.polychromos', { recursive: true });

      const vm = new VersionManager('.polychromos');
      await expect(vm.init()).resolves.not.toThrow();
    });

    it('loads existing event log version count', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1,"ts":1000,"patches":[]}\n{"v":2,"ts":2000,"patches":[]}\n{"v":3,"ts":3000,"patches":[]}\n',
      });

      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(3);
    });

    it('starts at version 0 if no event log exists', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(0);
    });
  });

  describe('recordChange', () => {
    it('increments version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      expect(vm.getVersion()).toBe(1);
    });

    it('appends to events.jsonl', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'first' });
      await vm.recordChange({ name: 'second' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8') as string;
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

      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8') as string;
      const entry = JSON.parse(content.trim());

      expect(entry.ts).toBe(now);
    });

    it('saves base snapshot on first change', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const data = { name: 'test', value: 42 };
      await vm.recordChange(data);

      const base = JSON.parse(vol.readFileSync('.polychromos/base.json', 'utf-8') as string);
      expect(base).toEqual(data);
    });

    it('clears redo stack on new change', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      await vm.undo();

      // After undo, redo should work
      await vm.recordChange({ v: 3 });

      // Redo stack should be cleared
      const result = await vm.redo();
      expect(result).toBeNull();
    });
  });

  describe('undo', () => {
    it('returns null when nothing to undo', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const result = await vm.undo();

      expect(result).toBeNull();
    });

    it('decrements version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      expect(vm.getVersion()).toBe(2);

      await vm.undo();
      expect(vm.getVersion()).toBe(1);
    });

    it('restores previous state', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });

      const result = await vm.undo();

      expect(result).toEqual({ value: 'first' });
    });

    it('updates snapshot file', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });
      await vm.undo();

      const snapshot = JSON.parse(vol.readFileSync('.polychromos/snapshot.json', 'utf-8') as string);
      expect(snapshot).toEqual({ value: 'first' });
    });
  });

  describe('redo', () => {
    it('returns null when nothing to redo', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const result = await vm.redo();

      expect(result).toBeNull();
    });

    it('increments version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      await vm.undo();
      expect(vm.getVersion()).toBe(1);

      await vm.redo();
      expect(vm.getVersion()).toBe(2);
    });

    it('restores undone state', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });
      await vm.undo();

      const result = await vm.redo();

      expect(result).toEqual({ value: 'second' });
    });
  });

  describe('checkpoint', () => {
    it('creates checkpoint entry with name', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.checkpoint('release-v1');

      const history = vm.list();
      const checkpoint = history.find(e => e.checkpoint === 'release-v1');

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.patches).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns empty array if no events', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = vm.list();

      expect(history).toEqual([]);
    });

    it('returns all events in order', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1,"ts":1000,"patches":[]}\n{"v":2,"ts":2000,"patches":[]}\n',
      });

      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = vm.list();

      expect(history).toHaveLength(2);
      expect(history[0].v).toBe(1);
      expect(history[1].v).toBe(2);
    });
  });

  describe('getVersion', () => {
    it('returns current version', async () => {
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

### Success Criteria

#### Automated Verification
- [x] Tests pass: `pnpm --filter @polychromos/cli test`
- [x] Coverage >80% for version-manager.ts

#### Manual Verification
- [x] Verify memfs mocking works correctly in CI

**Implementation Note**: Pause for confirmation after this phase.

---

## Phase 5: Element Renderer Unit Tests

### Overview
Implement React component tests for element renderers using @testing-library/react and jsdom.

### Changes Required

#### 1. Update App Vitest Config for jsdom

**File**: `apps/polychromos-app/vitest.config.ts`
**Changes**: Add jsdom environment for component tests

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['convex/**/*.test.ts', 'src/**/*.test.{ts,tsx}', 'e2e/**/*.test.ts'],
    passWithNoTests: true,
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        inline: ['convex-test'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['convex/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', 'convex/_generated/**'],
    },
  },
});
```

#### 2. Update Test Setup for React Testing Library

**File**: `apps/polychromos-app/test/setup.ts`
```typescript
import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
  process.env.IS_TEST = 'true';
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  // Cleanup
});
```

#### 3. Install Required Dev Dependencies

**File**: `apps/polychromos-app/package.json`
**Changes**: Add @testing-library/jest-dom and @vitejs/plugin-react

```bash
pnpm --filter polychromos-app add -D @testing-library/jest-dom @vitejs/plugin-react
```

#### 4. Create Element Renderer Tests

**File**: `apps/polychromos-app/src/components/element-renderers/__tests__/box.test.tsx`
```typescript
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
});
```

**File**: `apps/polychromos-app/src/components/element-renderers/__tests__/text.test.tsx`
```typescript
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
```

**File**: `apps/polychromos-app/src/components/element-renderers/__tests__/image.test.tsx`
```typescript
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

#### 5. Update Element Renderers to Include data-testid

**File**: `apps/polychromos-app/src/components/element-renderers/box.tsx`
**Changes**: Ensure data-testid is set (verify it uses `data-element-id` or add `data-testid`)

Check if components already have test IDs; if using `data-element-id`, update tests to use that selector.

### Success Criteria

#### Automated Verification
- [x] Tests pass: `pnpm --filter polychromos-app test src/components`
- [x] Coverage >80% for element renderers (box: 82%, image: 93%, text: 95%)

#### Manual Verification
- [x] Verify React components render correctly in actual app

**Implementation Note**: Pause for confirmation after this phase.

---

## Phase 6: Final Integration & CI Verification

### Overview
Verify all tests pass together and CI workflow works correctly.

### Changes Required

#### 1. Run All Tests Locally

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

#### 2. Verify CI Workflow

Ensure `.github/workflows/test.yml` runs all tests correctly.

### Success Criteria

#### Automated Verification
- [x] `pnpm test` passes from root (all packages) - 94 tests passing
- [x] `pnpm test:coverage` shows >80% for targeted files
- [ ] GitHub Actions workflow passes

#### Manual Verification
- [x] Review coverage reports for gaps
- [x] Confirm no flaky tests

---

## Testing Strategy Summary

### Unit Tests (This Plan)
- Type validators: Schema validation edge cases
- Generators: HTML/CSS/Tailwind output correctness
- VersionManager: File I/O and state management
- Element Renderers: React component rendering

### Integration Tests (Research 3)
- CLI commands end-to-end
- Convex sync operations

### E2E Tests (Research 4)
- Full application flows with local backend

## References

- Research 1: `thoughts/shared/research/2026-02-02-polychromos-testing-1-infrastructure.md`
- Research 2: `thoughts/shared/research/2026-02-02-polychromos-testing-2-unit-tests.md`
- Validators: `packages/polychromos-types/src/validators.ts`
- Generators: `apps/polychromos-app/src/lib/generators.ts`
- VersionManager: `packages/polychromos/src/lib/version-manager.ts`
- Element Renderers: `apps/polychromos-app/src/components/element-renderers/`
