import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";
import { useMemo } from "react";

interface ImageProps {
  element: PolychromosElement;
  _tokens?: PolychromosWorkspace["tokens"];
}

export function Image({ element, _tokens }: ImageProps) {
  const style = useMemo(() => {
    const s: React.CSSProperties = {};

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

    // Image
    if (element.image?.objectFit) s.objectFit = element.image.objectFit;

    return s;
  }, [element]);

  if (!element.image) return null;

  return (
    <img
      style={style}
      src={element.image.src}
      alt={element.image.alt ?? ""}
      data-element-id={element.id}
    />
  );
}
