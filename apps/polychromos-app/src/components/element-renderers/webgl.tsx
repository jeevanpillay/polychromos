import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";
import { useMemo } from "react";
import { ShaderMount } from "@paper-design/shaders-react";

interface WebGLProps {
  element: PolychromosElement;
  _tokens?: PolychromosWorkspace["tokens"];
}

export function WebGL({ element, _tokens }: WebGLProps) {
  const style = useMemo(() => {
    const s: React.CSSProperties = {};

    // Size
    if (element.width) {
      s.width =
        typeof element.width === "number"
          ? `${element.width}px`
          : element.width;
    } else {
      s.width = "100%";
    }
    if (element.height) {
      s.height =
        typeof element.height === "number"
          ? `${element.height}px`
          : element.height;
    } else {
      s.height = "100%";
    }

    return s;
  }, [element]);

  if (!element.webgl) return null;

  return (
    <div style={style} data-element-id={element.id}>
      <ShaderMount
        fragmentShader={element.webgl.shaderPath}
        uniforms={element.webgl.uniforms ?? {}}
        speed={1}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
