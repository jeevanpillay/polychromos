/**
 * HTML to SVG Converter Utility
 * Converts HTML text to SVG with customizable fonts and styling
 */

export interface HtmlToSvgOptions {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  letterSpacing?: number;
  textAnchor?: "start" | "middle" | "end";
  fill?: string;
  width?: number;
  height?: number;
  padding?: number;
  viewBox?: string;
  preserveAspectRatio?: string;
}

/**
 * Converts HTML text to an SVG string
 * @param options Configuration for SVG generation
 * @returns SVG string
 */
export function htmlToSvg(options: HtmlToSvgOptions): string {
  const {
    text,
    fontSize = 48,
    fontFamily = "Arial, sans-serif",
    fontWeight = "bold",
    letterSpacing = -1,
    textAnchor = "start",
    fill = "currentColor",
    width = 800,
    height = 200,
    padding = 20,
    viewBox = `0 0 ${width} ${height}`,
    preserveAspectRatio = "xMidYMid meet",
  } = options;

  const x =
    textAnchor === "middle"
      ? width / 2
      : textAnchor === "end"
        ? width - padding
        : padding;
  const y = height / 2 + fontSize / 3;

  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" preserveAspectRatio="${preserveAspectRatio}">
  <text
    x="${x}"
    y="${y}"
    font-size="${fontSize}"
    font-family="${fontFamily}"
    font-weight="${fontWeight}"
    letter-spacing="${letterSpacing}"
    text-anchor="${textAnchor}"
    fill="${fill}"
    dominant-baseline="central"
  >
    ${escapedText}
  </text>
</svg>`;
}

/**
 * Converts HTML to SVG and returns as data URL
 */
export function htmlToSvgDataUrl(options: HtmlToSvgOptions): string {
  const svg = htmlToSvg(options);
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

/**
 * Creates a responsive SVG that stretches text to fill width
 * Uses textLength to stretch characters
 */
export function createResponsiveSvgText(options: {
  text: string;
  fontFamily?: string;
  fontWeight?: string | number;
  fill?: string;
  className?: string;
}): string {
  const {
    text,
    fontFamily = "Arial, sans-serif",
    fontWeight = "bold",
    fill = "currentColor",
  } = options;

  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none">
  <text
    x="0"
    y="50"
    textLength="1000"
    font-family="${fontFamily}"
    font-weight="${fontWeight}"
    font-size="100"
    fill="${fill}"
    dominant-baseline="central"
  >
    ${escapedText}
  </text>
</svg>`;
}

/**
 * Converts HTML to SVG blob
 */
export function htmlToSvgBlob(options: HtmlToSvgOptions): Blob {
  const svg = htmlToSvg(options);
  return new Blob([svg], { type: "image/svg+xml" });
}

/**
 * Downloads SVG as a file
 */
export function downloadSvg(
  options: HtmlToSvgOptions & { filename?: string },
): void {
  const { filename = "exported.svg", ...svgOptions } = options;
  const blob = htmlToSvgBlob(svgOptions);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies SVG to clipboard
 */
export async function copySvgToClipboard(
  options: HtmlToSvgOptions,
): Promise<void> {
  const svg = htmlToSvg(options);
  await navigator.clipboard.writeText(svg);
}
