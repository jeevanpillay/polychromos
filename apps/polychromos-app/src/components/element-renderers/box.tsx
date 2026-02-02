import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";
import { useMemo } from "react";

import { Renderer } from "../renderer";

interface BoxProps {
  element: PolychromosElement;
  tokens?: PolychromosWorkspace["tokens"];
}

export function Box({ element, tokens }: BoxProps) {
  const style = useMemo(() => {
    const s: React.CSSProperties = {};

    // Position
    if (element.x !== undefined) s.left = `${element.x}px`;
    if (element.y !== undefined) s.top = `${element.y}px`;

    // Size
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

    // Layout
    if (element.layout?.display) s.display = element.layout.display;
    if (element.layout?.flexDirection)
      s.flexDirection = element.layout.flexDirection;
    if (element.layout?.justifyContent)
      s.justifyContent = element.layout.justifyContent;
    if (element.layout?.alignItems) s.alignItems = element.layout.alignItems;
    if (element.layout?.gap) s.gap = `${element.layout.gap}px`;

    // Spacing
    if (element.padding) s.padding = formatSpacing(element.padding);
    if (element.margin) s.margin = formatSpacing(element.margin);

    // Style
    if (element.style?.backgroundColor)
      s.backgroundColor = element.style.backgroundColor;
    if (element.style?.borderRadius)
      s.borderRadius = `${element.style.borderRadius}px`;
    if (element.style?.border) s.border = element.style.border;
    if (element.style?.opacity !== undefined) s.opacity = element.style.opacity;

    return s;
  }, [element]);

  return (
    <div style={style} data-element-id={element.id}>
      {element.children?.map((child) => (
        <Renderer key={child.id} element={child} tokens={tokens} />
      ))}
    </div>
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
