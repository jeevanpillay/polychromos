import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";
import { useMemo } from "react";

interface TextProps {
  element: PolychromosElement;
  _tokens?: PolychromosWorkspace["tokens"];
}

export function Text({ element, _tokens }: TextProps) {
  const style = useMemo(() => {
    const s: React.CSSProperties = {};

    // Size & Position (same as Box)
    if (element.width !== undefined) {
      s.width =
        typeof element.width === "number"
          ? `${element.width}px`
          : element.width;
    }
    if (element.height !== undefined) {
      s.height =
        typeof element.height === "number"
          ? `${element.height}px`
          : element.height;
    }

    // Spacing
    if (element.padding) s.padding = formatSpacing(element.padding);
    if (element.margin) s.margin = formatSpacing(element.margin);

    // Typography
    if (element.text?.fontFamily) s.fontFamily = element.text.fontFamily;
    if (element.text?.fontSize) s.fontSize = `${element.text.fontSize}px`;
    if (element.text?.fontWeight) s.fontWeight = element.text.fontWeight;
    if (element.text?.color) s.color = element.text.color;
    if (element.text?.textAlign) s.textAlign = element.text.textAlign;
    if (element.text?.lineHeight) s.lineHeight = element.text.lineHeight;

    // Style
    if (element.style?.backgroundColor)
      s.backgroundColor = element.style.backgroundColor;
    if (element.style?.opacity !== undefined) s.opacity = element.style.opacity;

    return s;
  }, [element]);

  return (
    <span style={style} data-element-id={element.id}>
      {element.text?.content}
    </span>
  );
}

function formatSpacing(spacing: number | number[]): string {
  if (typeof spacing === "number") return `${spacing}px`;
  if (spacing.length === 2) return `${spacing[0]}px ${spacing[1]}px`;
  if (spacing.length === 4) {
    return `${spacing[0]}px ${spacing[1]}px ${spacing[2]}px ${spacing[3]}px`;
  }
  return "0";
}
