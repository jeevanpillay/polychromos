/* eslint-disable @typescript-eslint/no-unsafe-call */
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

  it('renders empty span if no text content', () => {
    const element: PolychromosElement = {
      id: 'empty',
      type: 'text',
    };

    const { container } = render(<Text element={element} />);

    const span = container.querySelector('[data-element-id="empty"]');
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe('');
  });

  it('applies text alignment', () => {
    const element: PolychromosElement = {
      id: 'aligned',
      type: 'text',
      text: {
        content: 'Centered',
        textAlign: 'center',
      },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Centered');
    expect(span).toHaveStyle({ textAlign: 'center' });
  });

  it('applies line height', () => {
    const element: PolychromosElement = {
      id: 'lined',
      type: 'text',
      text: {
        content: 'With line height',
        lineHeight: 1.5,
      },
    };

    render(<Text element={element} />);

    const span = screen.getByText('With line height');
    expect(span).toHaveStyle({ lineHeight: '1.5' });
  });

  it('applies width and height styles', () => {
    const element: PolychromosElement = {
      id: 'sized',
      type: 'text',
      width: 200,
      height: 50,
      text: { content: 'Sized text' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Sized text');
    expect(span).toHaveStyle({ width: '200px', height: '50px' });
  });

  it('handles string width and height', () => {
    const element: PolychromosElement = {
      id: 'string-sized',
      type: 'text',
      width: '100%',
      height: 'auto',
      text: { content: 'Full width' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Full width');
    expect(span).toHaveStyle({ width: '100%', height: 'auto' });
  });

  it('applies padding', () => {
    const element: PolychromosElement = {
      id: 'padded',
      type: 'text',
      padding: 16,
      text: { content: 'Padded' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Padded');
    expect(span).toHaveStyle({ padding: '16px' });
  });

  it('applies 2-tuple padding', () => {
    const element: PolychromosElement = {
      id: 'padded-2',
      type: 'text',
      padding: [8, 16],
      text: { content: 'Padded 2' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Padded 2');
    expect(span).toHaveStyle({ padding: '8px 16px' });
  });

  it('applies 4-tuple padding', () => {
    const element: PolychromosElement = {
      id: 'padded-4',
      type: 'text',
      padding: [4, 8, 12, 16],
      text: { content: 'Padded 4' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Padded 4');
    expect(span).toHaveStyle({ padding: '4px 8px 12px 16px' });
  });

  it('applies margin', () => {
    const element: PolychromosElement = {
      id: 'margined',
      type: 'text',
      margin: 16,
      text: { content: 'Margined' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Margined');
    expect(span).toHaveStyle({ margin: '16px' });
  });

  it('applies background color', () => {
    const element: PolychromosElement = {
      id: 'bg',
      type: 'text',
      style: { backgroundColor: '#f0f0f0' },
      text: { content: 'With background' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('With background');
    expect(span).toHaveStyle({ backgroundColor: '#f0f0f0' });
  });

  it('applies opacity', () => {
    const element: PolychromosElement = {
      id: 'opacity',
      type: 'text',
      style: { opacity: 0.5 },
      text: { content: 'Semi-transparent' },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Semi-transparent');
    expect(span).toHaveStyle({ opacity: '0.5' });
  });

  it('applies font family', () => {
    const element: PolychromosElement = {
      id: 'font',
      type: 'text',
      text: {
        content: 'Custom font',
        fontFamily: 'Arial, sans-serif',
      },
    };

    render(<Text element={element} />);

    const span = screen.getByText('Custom font');
    expect(span).toHaveStyle({ fontFamily: 'Arial, sans-serif' });
  });
});
