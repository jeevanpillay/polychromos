import { readFile, writeFile } from "fs/promises";
import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";

interface ExportResult {
  html: string;
  css: string;
}

export async function exportCommand(format: string): Promise<void> {
  const validFormats = ["html", "tailwind"];

  if (!validFormats.includes(format)) {
    console.error(`Invalid format: ${format}`);
    console.error(`Valid formats: ${validFormats.join(", ")}`);
    process.exit(1);
  }

  // Read design.json
  let workspace: PolychromosWorkspace;
  try {
    const content = await readFile("design.json", "utf-8");
    workspace = JSON.parse(content) as PolychromosWorkspace;
  } catch (error) {
    console.error("Error reading design.json:", error);
    console.error("Run 'polychromos init <name>' to create a design file.");
    process.exit(1);
  }

  // Get the first component (or could allow specifying which one)
  const componentIds = Object.keys(workspace.components);
  if (componentIds.length === 0) {
    console.error("No components found in workspace.");
    process.exit(1);
  }

  const componentId = componentIds[0];
  if (!componentId) {
    console.error("No components found in workspace.");
    process.exit(1);
  }
  const component = workspace.components[componentId];
  if (!component) {
    console.error(`Component "${componentId}" not found in workspace.`);
    process.exit(1);
  }

  if (format === "html") {
    const { html, css } = exportToHTML(component.root);
    const fullHtml = generateFullHTML(workspace.name, html, css);

    const filename = `${component.name.toLowerCase().replace(/\s+/g, "-")}.html`;
    await writeFile(filename, fullHtml, "utf-8");
    console.log(`✓ Exported to ${filename}`);
  } else if (format === "tailwind") {
    const tailwindCode = exportToTailwindRecursive(component.root);

    const filename = `${component.name.toLowerCase().replace(/\s+/g, "-")}.tailwind.html`;
    await writeFile(
      filename,
      generateTailwindHTML(workspace.name, tailwindCode),
      "utf-8",
    );
    console.log(`✓ Exported to ${filename}`);
  }
}

function generateFullHTML(title: string, html: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>
`;
}

function generateTailwindHTML(title: string, html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
${html}
</body>
</html>
`;
}

function exportToHTML(element: PolychromosElement, indent = 0): ExportResult {
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
        const { html, css: childCss } = exportToHTML(child, indent + 1);
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

  if (props.length === 0) return `.${className} {}`;
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

function exportToTailwindRecursive(
  element: PolychromosElement,
  indent = 0,
): string {
  const indentStr = "  ".repeat(indent);
  const classes = exportToTailwind(element);
  const tag = element.type === "text" ? "span" : "div";

  // Handle text content
  if (element.type === "text" && element.text) {
    return `${indentStr}<${tag} class="${classes}">${escapeHTML(
      element.text.content,
    )}</${tag}>`;
  }

  // Handle images
  if (element.type === "image" && element.image) {
    return `${indentStr}<img class="${classes}" src="${escapeAttr(
      element.image.src,
    )}" alt="${escapeAttr(element.image.alt ?? "")}" />`;
  }

  // Handle WebGL
  if (element.type === "webgl" && element.webgl) {
    return `${indentStr}<canvas class="${classes}" data-shader="${escapeAttr(
      element.webgl.shaderPath,
    )}"></canvas>`;
  }

  // Handle containers with children
  const childrenHtml =
    element.children
      ?.map((child) => exportToTailwindRecursive(child, indent + 1))
      .join("\n") ?? "";

  if (childrenHtml) {
    return `${indentStr}<${tag} class="${classes}">\n${childrenHtml}\n${indentStr}</${tag}>`;
  }

  return `${indentStr}<${tag} class="${classes}"></${tag}>`;
}

function exportToTailwind(element: PolychromosElement): string {
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
  } else if (element.width === "100%") {
    classes.push("w-full");
  }
  if (element.height && typeof element.height === "number") {
    classes.push(`h-[${element.height}px]`);
  } else if (element.height === "100%") {
    classes.push("h-full");
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

  if (element.margin) {
    if (typeof element.margin === "number") {
      classes.push(`m-[${element.margin}px]`);
    } else if (Array.isArray(element.margin) && element.margin.length === 2) {
      classes.push(
        `my-[${element.margin[0]}px]`,
        `mx-[${element.margin[1]}px]`,
      );
    } else if (Array.isArray(element.margin)) {
      classes.push(
        `mt-[${element.margin[0]}px]`,
        `mr-[${element.margin[1]}px]`,
        `mb-[${element.margin[2]}px]`,
        `ml-[${element.margin[3]}px]`,
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
  if (element.style?.opacity !== undefined) {
    classes.push(`opacity-[${element.style.opacity}]`);
  }

  // Typography
  if (element.text?.fontSize) classes.push(`text-[${element.text.fontSize}px]`);
  if (element.text?.fontWeight)
    classes.push(`font-[${element.text.fontWeight}]`);
  if (element.text?.color) classes.push(`text-[${element.text.color}]`);
  if (element.text?.textAlign) classes.push(`text-${element.text.textAlign}`);

  return classes.join(" ");
}
