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
