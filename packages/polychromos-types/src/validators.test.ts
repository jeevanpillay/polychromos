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
