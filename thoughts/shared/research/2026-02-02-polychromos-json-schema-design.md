---
date: 2026-02-02T09:57:00+08:00
researcher: Claude
git_commit: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
branch: main
repository: jeevanpillaystudio/x
topic: "Polychromos JSON Schema Design - Code-Driven Design Platform V1"
tags: [research, json-schema, design-tools, code-generation, webgl, convex]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
last_updated_note: "Finalized V1 specification - simplified to 4 element types, path-based WebGL, removed complexity"
---

# Research: Polychromos JSON Schema Design

**Date**: 2026-02-02T09:57:00+08:00
**Researcher**: Claude
**Git Commit**: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
**Branch**: main
**Repository**: jeevanpillaystudio/x

## Research Question

Design a JSON schema for a code-driven design platform (Polychromos) that supports:
1. Workspace and component definitions with dimensions
2. Drawing primitives (flex, grid, fonts, positioning)
3. Future WebGL shader integration
4. Code export (HTML/CSS) and embeddable React component

**Context from User**:
- V1: Single-user, no authentication
- Users draw directly in JSON (code-driven, not visual editor)
- WebGL support is future scope but schema should accommodate it
- Export as copy-paste HTML/CSS or embed via React component

## Summary

Based on comprehensive research of design tool JSON schemas (Puck, Builder.io, GrapesJS, Figma), export patterns (canvas-kit), embedding patterns, and code generation approaches, Polychromos V1 uses a **simple, focused schema**:

1. **Recursive element structure** for unlimited nesting (Builder.io pattern)
2. **CSS-native properties** for styling (flex, grid, padding, margin, colors)
3. **4 element types** (box, text, image, webgl) - no extra complexity
4. **Path-based WebGL** shaders for simplicity and Paper Design integration

---

## Detailed Findings

### 1. Recommended JSON Schema Structure

#### 1.1 Top-Level Workspace Schema

```typescript
interface PolychromosWorkspace {
  // Metadata
  id: string;                    // Workspace ID (e.g., "ws_abc123")
  version: "1.0";                // Schema version
  name: string;                  // Human-readable name

  // Global settings
  settings?: {
    defaultUnits?: "px" | "rem";
    rootFontSize?: number;       // For rem calculations (default: 16)
  };

  // Design tokens (for consistency across components)
  tokens?: {
    colors?: Record<string, string>;
    spacing?: Record<string, string>;
    fonts?: Record<string, { family: string }>;
  };

  // Components in this workspace
  components: Record<string, PolychromosComponent>;
}
```

#### 1.2 Component Schema (Canvas-like)

```typescript
interface PolychromosComponent {
  id: string;                    // Component ID (e.g., "button_primary")
  name: string;                  // Display name

  // Canvas dimensions
  width: number;                 // Width in pixels
  height: number;                // Height in pixels

  // Root element (background can be set on root element via style)
  root: PolychromosElement;
}
```

#### 1.3 Element Schema (Recursive Children)

```typescript
interface PolychromosElement {
  id: string;                    // Unique element ID
  type: "box" | "text" | "image" | "webgl";  // Element type (V1 scope only)

  // Position & Size
  x?: number;                    // Pixel position (absolute positioning)
  y?: number;
  width?: number | string;       // number = px, string = "%", "auto"
  height?: number | string;

  // Layout (flex/grid)
  layout?: {
    display?: "flex" | "grid" | "block";
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
    alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
    gap?: number;
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
  };

  // Spacing
  padding?: number | [number, number] | [number, number, number, number];
  margin?: number | [number, number] | [number, number, number, number];

  // Appearance (simple styling)
  style?: {
    backgroundColor?: string;
    borderRadius?: number;
    border?: string;
    opacity?: number;
  };

  // Typography (for type: "text")
  text?: {
    content: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number | string;
    lineHeight?: number | string;
    color?: string;
    textAlign?: "left" | "center" | "right";
  };

  // Image (for type: "image")
  image?: {
    src: string;
    alt?: string;
    objectFit?: "cover" | "contain" | "fill";
  };

  // WebGL (for type: "webgl")
  webgl?: {
    shaderPath: string;          // Path to fragment shader file (e.g., "/shaders/background.frag")
    uniforms?: Record<string, UniformValue>;
  };

  // Children
  children?: PolychromosElement[];
}

type UniformValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | string                       // Color hex or URL
  | boolean;
```

---

### 2. Example JSON Document

```json
{
  "id": "ws_landing_page",
  "version": "1.0",
  "name": "Landing Page Components",
  "settings": {
    "defaultUnits": "px",
    "rootFontSize": 16
  },
  "tokens": {
    "colors": {
      "primary": "#3167a0",
      "secondary": "#7599f5",
      "background": "#242733",
      "text": "#ffffff"
    },
    "spacing": {
      "sm": "8",
      "md": "16",
      "lg": "32"
    },
    "fonts": {
      "heading": {
        "family": "Inter",
        "weights": [400, 600, 700]
      }
    }
  },
  "components": {
    "hero_card": {
      "id": "hero_card",
      "name": "Hero Card",
      "width": 400,
      "height": 300,
      "root": {
        "id": "root",
        "type": "box",
        "layout": {
          "display": "flex",
          "flexDirection": "column",
          "justifyContent": "center",
          "alignItems": "center",
          "gap": 16
        },
        "padding": [32, 24],
        "style": {
          "backgroundColor": "#242733",
          "borderRadius": 12
        },
        "children": [
          {
            "id": "title",
            "type": "text",
            "text": {
              "content": "Welcome",
              "fontFamily": "Inter",
              "fontSize": 32,
              "fontWeight": 700,
              "color": "#ffffff",
              "textAlign": "center"
            }
          },
          {
            "id": "subtitle",
            "type": "text",
            "text": {
              "content": "Build beautiful designs with code",
              "fontSize": 16,
              "color": "#7599f5",
              "textAlign": "center"
            }
          },
          {
            "id": "cta_button",
            "type": "box",
            "padding": [12, 24],
            "style": {
              "backgroundColor": "#3167a0",
              "borderRadius": 8
            },
            "children": [
              {
                "id": "cta_text",
                "type": "text",
                "text": {
                  "content": "Get Started",
                  "fontSize": 14,
                  "fontWeight": 600,
                  "color": "#ffffff"
                }
              }
            ]
          }
        ]
      }
    }
  }
}
```

---

### 3. WebGL Integration Example (V1 with Path-Based Shaders)

```json
{
  "id": "ws_with_webgl",
  "version": "1.0",
  "name": "WebGL Canvas Demo",
  "components": {
    "webgl_canvas": {
      "id": "webgl_canvas",
      "name": "Animated WebGL Background",
      "width": 800,
      "height": 600,
      "root": {
        "id": "webgl_bg",
        "type": "webgl",
        "width": "100%",
        "height": "100%",
        "webgl": {
          "shaderPath": "/shaders/background.frag",
          "uniforms": {
            "u_color1": [0.255, 0.259, 0.286],
            "u_color2": [0.141, 0.153, 0.200],
            "u_color3": [0.192, 0.404, 0.627],
            "u_color4": [0.459, 0.600, 0.961],
            "u_size": 0.2,
            "u_speed": 0.02,
            "u_offset": [0.42, 0.6],
            "u_grainIntensity": 1.29,
            "u_grainSize": 2.0,
            "u_grainSpeed": 8.0
          }
        }
      }
    }
  }
}
```

**Note**: Shader files are loaded at runtime from the specified path. The renderer will use Paper Design's `ShaderMount` component to render the shader with the provided uniforms.

---

### 4. Design Rationale

#### Why Recursive Children (Builder.io pattern)?
- **Intuitive for code-driven users**: Matches how developers think about DOM structure
- **Unlimited nesting**: No artificial depth limits
- **Direct mapping to HTML output**: Tree structure mirrors final output

#### Why CSS-native Properties?
- **Zero transformation for export**: Properties map 1:1 to CSS
- **Familiar to developers**: No learning curve for web developers
- **Tailwind compatibility**: Easy to generate Tailwind classes

#### Why Path-Based WebGL Shaders?
- **Simplicity for V1**: No need for asset registry overhead
- **Familiar workflow**: Developers already manage shader files
- **Paper Design integration**: Direct compatibility with existing `ShaderMount` component
- **Future extensibility**: Can add asset registry in V2 if needed

---

### 5. Code Export Implementation

#### 5.1 HTML/CSS Export

```typescript
function exportToHTML(component: PolychromosComponent): { html: string; css: string } {
  const css: string[] = [];

  function generateHTML(el: PolychromosElement, indent = 0): string {
    const className = `poly-${el.id}`;
    const tag = el.type === "text" ? "span" : "div";
    const indentStr = "  ".repeat(indent);

    // Generate CSS for this element
    css.push(generateCSS(el, className));

    // Handle text content
    if (el.type === "text" && el.text) {
      return `${indentStr}<${tag} class="${className}">${el.text.content}</${tag}>`;
    }

    // Handle children
    if (!el.children?.length) {
      return `${indentStr}<${tag} class="${className}"></${tag}>`;
    }

    const childrenHTML = el.children
      .map(child => generateHTML(child, indent + 1))
      .join("\n");

    return [
      `${indentStr}<${tag} class="${className}">`,
      childrenHTML,
      `${indentStr}</${tag}>`
    ].join("\n");
  }

  const html = generateHTML(component.root);
  return { html, css: css.join("\n\n") };
}

function generateCSS(el: PolychromosElement, className: string): string {
  const props: string[] = [];

  // Position & Size
  if (el.position === "absolute") {
    props.push("position: absolute");
    if (el.x !== undefined) props.push(`left: ${el.x}px`);
    if (el.y !== undefined) props.push(`top: ${el.y}px`);
  }
  if (el.width !== undefined) {
    props.push(`width: ${typeof el.width === "number" ? `${el.width}px` : el.width}`);
  }

  // Layout
  if (el.layout) {
    if (el.layout.display) props.push(`display: ${el.layout.display}`);
    if (el.layout.flexDirection) props.push(`flex-direction: ${el.layout.flexDirection}`);
    if (el.layout.justifyContent) props.push(`justify-content: ${el.layout.justifyContent}`);
    if (el.layout.alignItems) props.push(`align-items: ${el.layout.alignItems}`);
    if (el.layout.gap !== undefined) props.push(`gap: ${el.layout.gap}px`);
  }

  // Padding
  if (el.padding !== undefined) {
    props.push(`padding: ${formatSpacing(el.padding)}`);
  }

  // Style
  if (el.style) {
    if (el.style.backgroundColor) props.push(`background-color: ${resolveToken(el.style.backgroundColor)}`);
    if (el.style.borderRadius !== undefined) props.push(`border-radius: ${el.style.borderRadius}px`);
  }

  // Typography
  if (el.text) {
    if (el.text.fontSize) props.push(`font-size: ${el.text.fontSize}px`);
    if (el.text.fontWeight) props.push(`font-weight: ${el.text.fontWeight}`);
    if (el.text.color) props.push(`color: ${resolveToken(el.text.color)}`);
    if (el.text.textAlign) props.push(`text-align: ${el.text.textAlign}`);
  }

  return `.${className} {\n  ${props.join(";\n  ")};\n}`;
}
```

#### 5.2 Tailwind Export

```typescript
function exportToTailwind(el: PolychromosElement): string {
  const classes: string[] = [];

  // Layout
  if (el.layout?.display === "flex") classes.push("flex");
  if (el.layout?.flexDirection === "column") classes.push("flex-col");
  if (el.layout?.justifyContent === "center") classes.push("justify-center");
  if (el.layout?.alignItems === "center") classes.push("items-center");
  if (el.layout?.gap) classes.push(`gap-[${el.layout.gap}px]`);

  // Spacing
  if (el.padding) {
    if (typeof el.padding === "number") {
      classes.push(`p-[${el.padding}px]`);
    } else if (el.padding.length === 2) {
      classes.push(`py-[${el.padding[0]}px]`, `px-[${el.padding[1]}px]`);
    }
  }

  // Style
  if (el.style?.backgroundColor) {
    classes.push(`bg-[${el.style.backgroundColor}]`);
  }
  if (el.style?.borderRadius) {
    classes.push(`rounded-[${el.style.borderRadius}px]`);
  }

  // Typography
  if (el.text) {
    if (el.text.fontSize) classes.push(`text-[${el.text.fontSize}px]`);
    if (el.text.fontWeight) classes.push(`font-[${el.text.fontWeight}]`);
    if (el.text.color) classes.push(`text-[${el.text.color}]`);
    if (el.text.textAlign) classes.push(`text-${el.text.textAlign}`);
  }

  return classes.join(" ");
}
```

---

### 6. React Embedding Component

#### 6.1 NPM Package Structure

```
@polychromos/react/
├── src/
│   ├── index.ts
│   ├── Polychromos.tsx        # Main embeddable component
│   ├── Renderer.tsx           # JSON-to-React renderer
│   ├── elements/              # Element type renderers
│   │   ├── Box.tsx
│   │   ├── Text.tsx
│   │   ├── Image.tsx
│   │   └── WebGL.tsx
│   └── hooks/
│       └── usePolychromos.ts  # Convex query hook
├── convex/
│   └── _generated/            # Convex client types
└── package.json
```

#### 6.2 Embeddable Component API

```tsx
// User's app
import { Polychromos } from "@polychromos/react";

function MyApp() {
  return (
    <Polychromos
      workspaceId="ws_abc123"
      componentId="hero_card"
      convexUrl="https://your-deployment.convex.cloud"
    />
  );
}
```

#### 6.3 Component Implementation

```tsx
// @polychromos/react/src/Polychromos.tsx
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import { api } from "./convex/_generated/api";
import { Renderer } from "./Renderer";

interface PolychromosProps {
  workspaceId: string;
  componentId: string;
  convexUrl: string;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

export function Polychromos({
  workspaceId,
  componentId,
  convexUrl,
  fallback = null,
  onError,
}: PolychromosProps) {
  const convex = useMemo(
    () => new ConvexReactClient(convexUrl),
    [convexUrl]
  );

  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <ConvexProvider client={convex}>
        <Suspense fallback={fallback}>
          <PolychromosInner
            workspaceId={workspaceId}
            componentId={componentId}
          />
        </Suspense>
      </ConvexProvider>
    </ErrorBoundary>
  );
}

function PolychromosInner({ workspaceId, componentId }) {
  const data = useQuery(api.designs.getPublished, {
    workspaceId,
    componentId,
  });

  if (!data) return null;

  return (
    <div
      style={{
        width: data.component.width,
        height: data.component.height,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Renderer
        element={data.component.root}
        tokens={data.workspace.tokens}
      />
    </div>
  );
}
```

---

### 7. Schema Comparison Matrix

| Feature | Polychromos V1 | Puck | Builder.io | Figma |
|---------|----------------|------|------------|-------|
| Nested children | ✅ Recursive | ✅ Zones | ✅ Recursive | ✅ Recursive |
| Dimensions | Explicit W/H | Implicit | CSS-based | Absolute bounds |
| Layout | flex/grid | Props | CSS | Auto-layout |
| Element types | 4 types | Many | Many | Many |
| Design tokens | ✅ Simple | ❌ | ❌ | ✅ Variables |
| WebGL support | ✅ Path-based | ❌ | ❌ | ❌ |
| Code export | ✅ HTML/CSS/Tailwind | ❌ | ❌ | ✅ Dev Mode |
| React embed | ✅ NPM package | ✅ Render | ✅ Content | ❌ |

---

### 8. Implementation Phases

#### Phase 1: V1 Core (No Auth, Single User, WebGL-Ready)
1. Define TypeScript types for schema
2. Implement JSON-to-CSS generator
3. Implement JSON-to-HTML generator
4. WebGL element renderer (using Paper Design `ShaderMount`)
5. Basic Convex mutations for CRUD
6. CLI file watcher with chokidar
7. Web preview with real-time sync

#### Phase 2: Embeddable Component & Export
1. Implement HTML/CSS code generator
2. Implement Tailwind code generator
3. Create `@polychromos/react` npm package
4. Implement Renderer component
5. Publish to npm with documentation

#### Phase 3: Advanced Features (V2+)
1. Asset registry and shader bundling
2. GPGPU effects for mouse interactions
3. Multi-user support with CRDTs
4. Component library sharing

---

## Code References

- `apps/www/src/components/webgl-background.tsx:2` - ShaderMount import from Paper Design
- `apps/www/src/components/webgl-background.tsx:289-295` - ShaderMount usage pattern
- `apps/www/src/components/webgl-background.tsx:246-280` - Uniforms construction pattern
- `packages/tools/canvas-kit/src/lib/export.ts:61-86` - WebP export implementation
- `packages/tools/canvas-kit/src/lib/export.ts:91-98` - SVG export implementation

---

## Historical Context

- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - Initial feasibility study confirming Convex real-time sync viability

---

## Open Questions (Resolved)

| Original Question | Resolution |
|-------------------|------------|
| JSON Schema Design | Hybrid: Builder.io recursive structure + CSS-native properties |
| Element Types | V1: `box`, `text`, `image`, `webgl` only (no extra complexity) |
| Multi-User Support | Deferred to V2; single-user for V1 |
| Authentication | None for V1; treat as single-user single-app |
| WebGL in JSON | Path-based only: `webgl.shaderPath` points to fragment shader file |
| Component Export | HTML/CSS generator + Tailwind generator + React embed via npm |

---

## V1 Specification Summary

### Core Scope
- **JSON Schema**: 4 element types (box, text, image, webgl)
- **Drawing System**: Code-driven (edit JSON directly, no visual editor)
- **Styling**: CSS-native properties (flex, grid, padding, margin, basic colors/radius)
- **WebGL**: Path-based shader references with uniform configuration
- **Persistence**: Convex database
- **Sync**: CLI file watcher (chokidar) → Convex → Web preview
- **Export**: Copy-paste HTML/CSS + Tailwind + React embed via npm

### Explicitly Out of Scope (V2+)
- Visual editor
- Multi-user editing
- Authentication
- Asset registry / shader bundling
- GPGPU effects
- Animations (beyond WebGL)
- Responsive breakpoints
- Component constraints (Figma-style)

### Key Constraints
- Users edit JSON directly in code editor
- Shaders loaded from public paths at runtime
- Design tokens referenced via string (resolved at export time)
- All dimensions in pixels (V1)
- No inline styles optimization needed (V1)

---

## Conclusion

The Polychromos V1 schema is intentionally simple and focused:

1. **Minimal abstraction**: 4 element types, CSS-native properties
2. **Code-first workflow**: JSON is the source of truth
3. **WebGL-ready**: Path-based shaders work with Paper Design's existing renderer
4. **Multi-target export**: Same JSON exports to HTML/CSS, Tailwind, and React
5. **Extensible foundation**: Clear upgrade path to V2 features

**Implementation Priority**:
1. Define TypeScript types (enforce schema)
2. Implement JSON-to-CSS generator (export foundation)
3. Implement JSON-to-HTML generator
4. Build WebGL element renderer (ShaderMount integration)
5. Set up Convex backend
6. Implement CLI file watcher
7. Wire up web preview

---

## Sources

### Design Tool Schemas
- [Puck Data Model](https://puckeditor.com/docs/api-reference/data-model/data)
- [Builder.io Write API](https://www.builder.io/c/docs/write-api)
- [BuilderBlock TypeScript Interface](https://github.com/BuilderIO/builder/blob/main/packages/sdks/src/types/builder-block.ts)
- [GrapesJS Components](https://grapesjs.com/docs/modules/Components.html)
- [Figma REST API](https://developers.figma.com/docs/rest-api/)
- [W3C Design Tokens Format](https://www.designtokens.org/tr/drafts/format/)

### Code Generation
- [Figma Dev Mode](https://www.figma.com/dev-mode/)
- [Style Dictionary](https://github.com/amzn/style-dictionary)
- [Emotion Serialize](https://github.com/emotion-js/emotion/tree/main/packages/serialize)
- [Tailwind 4 @theme](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)

### React Embedding
- [Convex React](https://docs.convex.dev/client/react)
- [Builder.io Content Component](https://www.builder.io/c/docs/content-component)
- [Puck Render](https://github.com/measuredco/puck)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)
