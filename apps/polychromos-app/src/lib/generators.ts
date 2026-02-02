import type { PolychromosElement } from "@polychromos/types";

interface ExportResult {
  html: string;
  css: string;
}

export function exportToHTML(
  element: PolychromosElement,
  indent = 0,
): ExportResult {
  const css: string[] = [];
  const indentStr = "  ".repeat(indent);
  const className = `poly-${element.id}`;

  // Generate CSS
  css.push(generateElementCSS(element, className));

  // Determine tag
  const tag = element.type === "text" ? "span" : "div";

  // Handle text content
  if (element.type === "text" && element.text) {
    return {
      html: `${indentStr}<${tag} class="${className}">${escapeHTML(
        element.text.content,
      )}</${tag}>`,
      css: css.join("\n\n"),
    };
  }

  // Handle images
  if (element.type === "image" && element.image) {
    return {
      html: `${indentStr}<img class="${className}" src="${escapeAttr(
        element.image.src,
      )}" alt="${escapeAttr(element.image.alt ?? "")}" />`,
      css: css.join("\n\n"),
    };
  }

  // Handle WebGL
  if (element.type === "webgl" && element.webgl) {
    return {
      html: `${indentStr}<canvas class="${className}" data-shader="${escapeAttr(
        element.webgl.shaderPath,
      )}"></canvas>`,
      css: css.join("\n\n"),
    };
  }

  // Handle containers with children
  const childrenHtml =
    element.children
      ?.map((child) => {
        const { html } = exportToHTML(child, indent + 1);
        const { css: childCss } = exportToHTML(child, indent + 1);
        css.push(childCss);
        return html;
      })
      .join("\n") ?? "";

  const html = childrenHtml
    ? `${indentStr}<${tag} class="${className}">\n${childrenHtml}\n${indentStr}</${tag}>`
    : `${indentStr}<${tag} class="${className}"></${tag}>`;

  return { html, css: css.join("\n\n") };
}

function generateElementCSS(el: PolychromosElement, className: string): string {
  const props: string[] = [];

  // Position
  if (el.x !== undefined) props.push(`left: ${el.x}px`);
  if (el.y !== undefined) props.push(`top: ${el.y}px`);

  // Size
  if (el.width !== undefined) {
    props.push(
      `width: ${typeof el.width === "number" ? `${el.width}px` : el.width}`,
    );
  }
  if (el.height !== undefined) {
    props.push(
      `height: ${typeof el.height === "number" ? `${el.height}px` : el.height}`,
    );
  }

  // Layout
  if (el.layout?.display) props.push(`display: ${el.layout.display}`);
  if (el.layout?.flexDirection)
    props.push(`flex-direction: ${el.layout.flexDirection}`);
  if (el.layout?.justifyContent)
    props.push(`justify-content: ${el.layout.justifyContent}`);
  if (el.layout?.alignItems) props.push(`align-items: ${el.layout.alignItems}`);
  if (el.layout?.gap) props.push(`gap: ${el.layout.gap}px`);

  // Spacing
  if (el.padding !== undefined) {
    props.push(`padding: ${formatSpacing(el.padding)}`);
  }
  if (el.margin !== undefined) {
    props.push(`margin: ${formatSpacing(el.margin)}`);
  }

  // Style
  if (el.style?.backgroundColor)
    props.push(`background-color: ${el.style.backgroundColor}`);
  if (el.style?.borderRadius !== undefined)
    props.push(`border-radius: ${el.style.borderRadius}px`);
  if (el.style?.border) props.push(`border: ${el.style.border}`);
  if (el.style?.opacity !== undefined)
    props.push(`opacity: ${el.style.opacity}`);

  // Typography
  if (el.text?.fontFamily) props.push(`font-family: ${el.text.fontFamily}`);
  if (el.text?.fontSize) props.push(`font-size: ${el.text.fontSize}px`);
  if (el.text?.fontWeight) props.push(`font-weight: ${el.text.fontWeight}`);
  if (el.text?.color) props.push(`color: ${el.text.color}`);
  if (el.text?.textAlign) props.push(`text-align: ${el.text.textAlign}`);
  if (el.text?.lineHeight) props.push(`line-height: ${el.text.lineHeight}`);

  // Image
  if (el.image?.objectFit) props.push(`object-fit: ${el.image.objectFit}`);

  return `.${className} {\n  ${props.join(";\n  ")};\n}`;
}

function formatSpacing(spacing: number | number[]): string {
  if (typeof spacing === "number") return `${spacing}px`;
  if (Array.isArray(spacing) && spacing.length === 2)
    return `${spacing[0]}px ${spacing[1]}px`;
  if (Array.isArray(spacing) && spacing.length === 4) {
    return `${spacing[0]}px ${spacing[1]}px ${spacing[2]}px ${spacing[3]}px`;
  }
  return "0";
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Tailwind export
export function exportToTailwind(element: PolychromosElement): string {
  const classes: string[] = [];

  // Layout
  if (element.layout?.display === "flex") classes.push("flex");
  if (element.layout?.display === "grid") classes.push("grid");
  if (element.layout?.flexDirection === "column") classes.push("flex-col");
  if (element.layout?.justifyContent === "center")
    classes.push("justify-center");
  if (element.layout?.justifyContent === "space-between")
    classes.push("justify-between");
  if (element.layout?.alignItems === "center") classes.push("items-center");
  if (element.layout?.gap) classes.push(`gap-[${element.layout.gap}px]`);

  // Size
  if (element.width && typeof element.width === "number") {
    classes.push(`w-[${element.width}px]`);
  }
  if (element.height && typeof element.height === "number") {
    classes.push(`h-[${element.height}px]`);
  }

  // Spacing
  if (element.padding) {
    if (typeof element.padding === "number") {
      classes.push(`p-[${element.padding}px]`);
    } else if (Array.isArray(element.padding) && element.padding.length === 2) {
      classes.push(
        `py-[${element.padding[0]}px]`,
        `px-[${element.padding[1]}px]`,
      );
    } else if (Array.isArray(element.padding)) {
      classes.push(
        `pt-[${element.padding[0]}px]`,
        `pr-[${element.padding[1]}px]`,
        `pb-[${element.padding[2]}px]`,
        `pl-[${element.padding[3]}px]`,
      );
    }
  }

  // Style
  if (element.style?.backgroundColor) {
    classes.push(`bg-[${element.style.backgroundColor}]`);
  }
  if (element.style?.borderRadius) {
    classes.push(`rounded-[${element.style.borderRadius}px]`);
  }

  // Typography
  if (element.text?.fontSize) classes.push(`text-[${element.text.fontSize}px]`);
  if (element.text?.fontWeight)
    classes.push(`font-[${element.text.fontWeight}]`);
  if (element.text?.color) classes.push(`text-[${element.text.color}]`);
  if (element.text?.textAlign) classes.push(`text-${element.text.textAlign}`);

  return classes.join(" ");
}
