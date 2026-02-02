// Complete TypeScript interface definitions
// See research doc: 2026-02-02-polychromos-json-schema-design.md

export interface PolychromosWorkspace {
  id: string;
  version: "1.0";
  name: string;
  settings?: {
    defaultUnits?: "px" | "rem";
    rootFontSize?: number;
  };
  tokens?: {
    colors?: Record<string, string>;
    spacing?: Record<string, string>;
    fonts?: Record<string, { family: string }>;
  };
  components: Record<string, PolychromosComponent>;
}

export interface PolychromosComponent {
  id: string;
  name: string;
  width: number;
  height: number;
  root: PolychromosElement;
}

export interface PolychromosElement {
  id: string;
  type: "box" | "text" | "image" | "webgl";
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  layout?: LayoutConfig;
  padding?: number | [number, number] | [number, number, number, number];
  margin?: number | [number, number] | [number, number, number, number];
  style?: {
    backgroundColor?: string;
    borderRadius?: number;
    border?: string;
    opacity?: number;
  };
  text?: TextConfig;
  image?: ImageConfig;
  webgl?: WebGLConfig;
  children?: PolychromosElement[];
}

export interface LayoutConfig {
  display?: "flex" | "grid" | "block";
  flexDirection?: "row" | "column";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  gap?: number;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
}

export interface TextConfig {
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  color?: string;
  textAlign?: "left" | "center" | "right";
}

export interface ImageConfig {
  src: string;
  alt?: string;
  objectFit?: "cover" | "contain" | "fill";
}

export interface WebGLConfig {
  shaderPath: string;
  uniforms?: Record<string, UniformValue>;
}

export type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | string
  | boolean;
