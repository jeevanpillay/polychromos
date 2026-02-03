/* eslint-disable @typescript-eslint/non-nullable-type-assertion-style */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Box } from '../box';
import type { PolychromosElement } from '@polychromos/types';

describe('Box renderer', () => {
  it('renders a div', () => {
    const element: PolychromosElement = {
      id: 'box1',
      type: 'box',
    };

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="box1"]');
    expect(div).not.toBeNull();
    expect(div?.tagName).toBe('DIV');
  });

  it('applies width and height styles', () => {
    const element: PolychromosElement = {
      id: 'sized',
      type: 'box',
      width: 200,
      height: 100,
    };

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="sized"]') as HTMLElement;
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

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="flex"]') as HTMLElement;
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

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="colored"]') as HTMLElement;
    expect(div).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('applies gap style', () => {
    const element: PolychromosElement = {
      id: 'gap',
      type: 'box',
      layout: {
        display: 'flex',
        gap: 16,
      },
    };

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="gap"]') as HTMLElement;
    expect(div).toHaveStyle({ gap: '16px' });
  });

  it('applies padding style', () => {
    const element: PolychromosElement = {
      id: 'padded',
      type: 'box',
      padding: 16,
    };

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="padded"]') as HTMLElement;
    expect(div).toHaveStyle({ padding: '16px' });
  });

  it('applies border radius', () => {
    const element: PolychromosElement = {
      id: 'rounded',
      type: 'box',
      style: { borderRadius: 8 },
    };

    const { container } = render(<Box element={element} />);

    const div = container.querySelector('[data-element-id="rounded"]') as HTMLElement;
    expect(div).toHaveStyle({ borderRadius: '8px' });
  });
});
