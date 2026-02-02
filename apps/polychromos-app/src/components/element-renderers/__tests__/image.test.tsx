/* eslint-disable @typescript-eslint/no-unsafe-call */
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
        alt: 'Cover image',
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

  it('applies width and height styles', () => {
    const element: PolychromosElement = {
      id: 'sized',
      type: 'image',
      width: 300,
      height: 200,
      image: {
        src: 'https://example.com/image.png',
        alt: 'Sized image',
      },
    };

    render(<Image element={element} />);

    const img = screen.getByRole('img');
    expect(img).toHaveStyle({ width: '300px', height: '200px' });
  });

  it('uses empty string for missing alt', () => {
    const element: PolychromosElement = {
      id: 'noalt',
      type: 'image',
      image: {
        src: 'https://example.com/image.png',
      },
    };

    const { container } = render(<Image element={element} />);

    const img = container.querySelector('[data-element-id="noalt"]');
    expect(img).toHaveAttribute('alt', '');
  });
});
