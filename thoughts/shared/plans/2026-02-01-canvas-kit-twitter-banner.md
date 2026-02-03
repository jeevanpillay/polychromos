# Canvas Kit & Twitter Banner Generator Implementation Plan

## Overview

Create a code-first image generation toolkit (`@repo/canvas-kit`) that allows developers to define canvas dimensions programmatically, render React/HTML/CSS content inside, and export to WebP or SVG formats. The first use case is a Twitter banner generator featuring the layered "I" effect from the homepage.

## Current State Analysis

- **Existing patterns**: `packages/ui` provides the model for package structure with explicit exports
- **Export utilities**: `packages/ui/src/lib/html-to-svg.ts` exists but only handles simple text
- **Layered effect**: Lives in `apps/www/src/routes/index.tsx:230-293` - needs extraction
- **No tools routes**: No `/tools/` directory exists under routes
- **Workspace config**: `pnpm-workspace.yaml` includes `packages/*` but not `packages/tools/*`

### Key Discoveries:
- Package exports use explicit path mapping (`./components/*`, `./lib/*`)
- TypeScript extends `@repo/typescript-config/react-library.json`
- React 19 is used across the monorepo
- `html-to-image` is not installed - needs to be added

## Desired End State

1. **New package** at `packages/tools/canvas-kit` with:
   - `<ImageCanvas>` component for wrapping drawable content
   - `<ExportControls>` component for format/resolution UI
   - Export utilities for WebP and SVG

2. **New route** at `/tools/twitter-banner` with:
   - Live preview of the Twitter banner (1500×500)
   - Layered "I" effect positioned on the right
   - Export controls for downloading

3. **Verification**:
   - `pnpm build` succeeds
   - `pnpm typecheck` passes
   - Route accessible at `http://localhost:3000/tools/twitter-banner`
   - Export produces valid WebP/SVG files

## What We're NOT Doing

- Complex UI-based canvas editors (no drag-and-drop, no resize handles)
- Multiple preset templates
- Server-side rendering/generation
- JPEG or PNG export (WebP and SVG only for now)
- Cloud storage or sharing functionality

## Implementation Approach

The canvas-kit package provides two main pieces:
1. **ImageCanvas**: A container component that renders children at exact pixel dimensions and exposes an export ref
2. **ExportControls**: UI for selecting format and resolution multiplier, triggering download

The Twitter banner route demonstrates usage by defining the canvas content in code and wiring up the export controls.

---

## Phase 1: Package Setup

### Overview
Create the `canvas-kit` package structure with TypeScript configuration and workspace integration.

### Changes Required:

#### 1. Update Workspace Configuration
**File**: `pnpm-workspace.yaml`
**Changes**: Add `packages/tools/*` to workspace packages

```yaml
packages:
  - apps/*
  - packages/*
  - packages/tools/*
  - internal/*
```

#### 2. Create Package Directory Structure
**Directory**: `packages/tools/canvas-kit/`

```
packages/tools/canvas-kit/
├── package.json
├── tsconfig.json
└── src/
    ├── components/
    │   ├── image-canvas.tsx
    │   └── export-controls.tsx
    ├── lib/
    │   └── export.ts
    └── index.ts
```

#### 3. Package Configuration
**File**: `packages/tools/canvas-kit/package.json`

```json
{
  "name": "@repo/canvas-kit",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts"
  },
  "peerDependencies": {
    "react": "^19"
  },
  "scripts": {
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --check . --ignore-path ../../../.gitignore"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/react": "catalog:react19",
    "@types/react-dom": "catalog:react19",
    "eslint": "catalog:",
    "typescript": "catalog:"
  },
  "dependencies": {
    "html-to-image": "^1.11.11",
    "react": "catalog:react19",
    "react-dom": "catalog:react19"
  },
  "prettier": "@repo/prettier-config"
}
```

#### 4. TypeScript Configuration
**File**: `packages/tools/canvas-kit/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@repo/canvas-kit/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] `pnpm typecheck` passes for the new package

#### Manual Verification:
- [ ] Package appears in `node_modules/@repo/canvas-kit`

**Implementation Note**: After completing this phase, run `pnpm install` to bootstrap the new package before proceeding.

---

## Phase 2: Core Export Utilities

### Overview
Implement the export functions that convert DOM elements to WebP and SVG formats.

### Changes Required:

#### 1. Export Utilities
**File**: `packages/tools/canvas-kit/src/lib/export.ts`

```typescript
import { toCanvas, toSvg } from "html-to-image";

export type ExportFormat = "webp" | "svg";
export type ResolutionMultiplier = 1 | 2 | 3 | 4;

export interface ExportOptions {
  format: ExportFormat;
  multiplier: ResolutionMultiplier;
  filename?: string;
}

/**
 * Export a DOM element to WebP format
 */
export async function exportToWebP(
  element: HTMLElement,
  multiplier: ResolutionMultiplier = 2
): Promise<Blob> {
  const canvas = await toCanvas(element, {
    pixelRatio: multiplier,
    cacheBust: true,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create WebP blob"));
        }
      },
      "image/webp",
      0.95
    );
  });
}

/**
 * Export a DOM element to SVG format (foreignObject wrapper)
 */
export async function exportToSVG(element: HTMLElement): Promise<string> {
  return toSvg(element, {
    cacheBust: true,
  });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Download an SVG string as a file
 */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  downloadBlob(blob, filename);
}

/**
 * Main export function - handles format selection
 */
export async function exportElement(
  element: HTMLElement,
  options: ExportOptions
): Promise<void> {
  const { format, multiplier, filename = "export" } = options;

  if (format === "webp") {
    const blob = await exportToWebP(element, multiplier);
    downloadBlob(blob, `${filename}.webp`);
  } else {
    const svg = await exportToSVG(element);
    downloadSVG(svg, `${filename}.svg`);
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes for canvas-kit package

#### Manual Verification:
- [x] N/A - utilities tested in Phase 4

---

## Phase 3: React Components

### Overview
Create the `ImageCanvas` and `ExportControls` React components.

### Changes Required:

#### 1. ImageCanvas Component
**File**: `packages/tools/canvas-kit/src/components/image-canvas.tsx`

```tsx
"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from "react";
import {
  exportElement,
  type ExportFormat,
  type ResolutionMultiplier,
} from "../lib/export";

export interface ImageCanvasProps {
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Content to render inside the canvas */
  children: ReactNode;
  /** Additional CSS classes for the canvas container */
  className?: string;
}

export interface ImageCanvasRef {
  /** Export the canvas content */
  export: (options: {
    format: ExportFormat;
    multiplier: ResolutionMultiplier;
    filename?: string;
  }) => Promise<void>;
  /** Get the underlying DOM element */
  getElement: () => HTMLDivElement | null;
}

/**
 * A fixed-dimension canvas for rendering exportable content.
 * Children are rendered at exact pixel dimensions with bg-background.
 */
export const ImageCanvas = forwardRef<ImageCanvasRef, ImageCanvasProps>(
  function ImageCanvas({ width, height, children, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      export: async (options) => {
        if (!containerRef.current) {
          throw new Error("Canvas element not mounted");
        }
        await exportElement(containerRef.current, options);
      },
      getElement: () => containerRef.current,
    }));

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--background)",
        }}
      >
        {children}
      </div>
    );
  }
);
```

#### 2. ExportControls Component
**File**: `packages/tools/canvas-kit/src/components/export-controls.tsx`

```tsx
"use client";

import { useState, type RefObject } from "react";
import type { ImageCanvasRef } from "./image-canvas";
import type { ExportFormat, ResolutionMultiplier } from "../lib/export";

export interface ExportControlsProps {
  /** Reference to the ImageCanvas */
  canvasRef: RefObject<ImageCanvasRef | null>;
  /** Default filename for exports (without extension) */
  defaultFilename?: string;
  /** Callback when export starts */
  onExportStart?: () => void;
  /** Callback when export completes */
  onExportComplete?: () => void;
  /** Callback when export fails */
  onExportError?: (error: Error) => void;
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "webp", label: "WebP" },
  { value: "svg", label: "SVG" },
];

const MULTIPLIERS: { value: ResolutionMultiplier; label: string }[] = [
  { value: 1, label: "1×" },
  { value: 2, label: "2×" },
  { value: 3, label: "3×" },
  { value: 4, label: "4×" },
];

/**
 * Export controls for an ImageCanvas.
 * Provides format selection, resolution multiplier, and download button.
 */
export function ExportControls({
  canvasRef,
  defaultFilename = "export",
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportControlsProps) {
  const [format, setFormat] = useState<ExportFormat>("webp");
  const [multiplier, setMultiplier] = useState<ResolutionMultiplier>(2);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!canvasRef.current) return;

    setIsExporting(true);
    onExportStart?.();

    try {
      await canvasRef.current.export({
        format,
        multiplier,
        filename: defaultFilename,
      });
      onExportComplete?.();
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Format Selection */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Format:</span>
        <div className="flex gap-1">
          {FORMATS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFormat(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                format === value
                  ? "bg-foreground text-background"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution Multiplier (only for WebP) */}
      {format === "webp" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Resolution:</span>
          <div className="flex gap-1">
            {MULTIPLIERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMultiplier(value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  multiplier === value
                    ? "bg-foreground text-background"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="px-4 py-1.5 text-sm bg-brand-red text-white rounded-md hover:bg-brand-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? "Exporting..." : "Download"}
      </button>
    </div>
  );
}
```

#### 3. Package Index
**File**: `packages/tools/canvas-kit/src/index.ts`

```typescript
// Components
export { ImageCanvas, type ImageCanvasProps, type ImageCanvasRef } from "./components/image-canvas";
export { ExportControls, type ExportControlsProps } from "./components/export-controls";

// Utilities
export {
  exportElement,
  exportToWebP,
  exportToSVG,
  downloadBlob,
  downloadSVG,
  type ExportFormat,
  type ResolutionMultiplier,
  type ExportOptions,
} from "./lib/export";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes for canvas-kit package
- [x] `pnpm lint` passes

#### Manual Verification:
- [x] N/A - components tested in Phase 4

---

## Phase 4: Twitter Banner Route

### Overview
Create the Twitter banner generator route with the layered "I" effect as a demonstration.

### Changes Required:

#### 1. Add canvas-kit Dependency to www
**File**: `apps/www/package.json`
**Changes**: Add `@repo/canvas-kit` to dependencies

```json
{
  "dependencies": {
    "@repo/canvas-kit": "workspace:*",
    // ... existing deps
  }
}
```

#### 2. Create Layered I Component
**File**: `apps/www/src/components/layered-i.tsx`

```tsx
"use client";

interface LayeredIProps {
  /** Font size for the "I" character in pixels */
  fontSize?: number;
  /** Clip ratios for each layer (default: 50%, 60%, 100%) */
  clipRatios?: [number, number, number];
}

/**
 * Layered "I" effect - three stacked I letters with progressive reveal.
 * Extracted from homepage for reuse in Twitter banner generator.
 */
export function LayeredI({
  fontSize = 120,
  clipRatios = [0.5, 0.6, 1],
}: LayeredIProps) {
  return (
    <div className="flex flex-col">
      {clipRatios.map((ratio, index) => (
        <div
          key={index}
          style={{
            overflow: ratio < 1 ? "hidden" : undefined,
            height: ratio < 1 ? `${fontSize * ratio}px` : undefined,
          }}
        >
          <span
            className="text-brand-red leading-none block"
            style={{
              fontFamily: "JoyrideALT, sans-serif",
              fontSize: `${fontSize}px`,
              lineHeight: 1,
            }}
          >
            I
          </span>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Create Twitter Banner Route
**File**: `apps/www/src/routes/tools/twitter-banner.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import {
  ImageCanvas,
  ExportControls,
  type ImageCanvasRef,
} from "@repo/canvas-kit/components/image-canvas";
import { LayeredI } from "~/components/layered-i";

export const Route = createFileRoute("/tools/twitter-banner")({
  head: () => ({
    meta: [
      { title: "Twitter Banner Generator | Jeevan Pillay" },
      {
        name: "description",
        content: "Generate Twitter banners with the layered I effect",
      },
    ],
  }),
  component: TwitterBannerPage,
});

// Twitter banner dimensions
const BANNER_WIDTH = 1500;
const BANNER_HEIGHT = 500;

function TwitterBannerPage() {
  const canvasRef = useRef<ImageCanvasRef>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Twitter Banner Generator</h1>
          <p className="text-muted-foreground">
            {BANNER_WIDTH}×{BANNER_HEIGHT}px canvas with the layered I effect
          </p>
        </div>

        {/* Export Controls */}
        <div className="mb-6">
          <ExportControls
            canvasRef={canvasRef}
            defaultFilename="twitter-banner"
          />
        </div>

        {/* Canvas Preview */}
        <div className="border border-border rounded-lg overflow-hidden inline-block">
          <ImageCanvas
            ref={canvasRef}
            width={BANNER_WIDTH}
            height={BANNER_HEIGHT}
          >
            {/*
              Developer draws here - this is the "code-based" part.
              The content below is pure React/HTML/CSS.
            */}
            <div className="w-full h-full flex items-center justify-end pr-24">
              <LayeredI fontSize={140} />
            </div>
          </ImageCanvas>
        </div>

        {/* Info */}
        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            <strong>Tip:</strong> The canvas uses{" "}
            <code className="bg-muted px-1 py-0.5 rounded">bg-background</code>{" "}
            by default. Overlay your content on top.
          </p>
          <p className="mt-2">
            WebP export at 2× = {BANNER_WIDTH * 2}×{BANNER_HEIGHT * 2}px
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### 4. Fix Import Path Issue
**File**: `apps/www/src/routes/tools/twitter-banner.tsx`

The import for `ExportControls` needs adjustment since it's in a separate file. Update the imports:

```tsx
import {
  ImageCanvas,
  type ImageCanvasRef,
} from "@repo/canvas-kit/components/image-canvas";
import { ExportControls } from "@repo/canvas-kit/components/export-controls";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds
- [x] `pnpm build` succeeds
- [x] `pnpm typecheck` passes

#### Manual Verification:
- [ ] Navigate to `http://localhost:3000/tools/twitter-banner`
- [ ] Canvas displays with layered I effect on the right
- [ ] Clicking "Download" with WebP selected produces a `.webp` file
- [ ] Clicking "Download" with SVG selected produces an `.svg` file
- [ ] Resolution multiplier changes actual output dimensions
- [ ] Exported files display correctly when opened

**Implementation Note**: After completing this phase and all automated verification passes, test the full flow manually to confirm exports work correctly.

---

## Phase 5: Refinements

### Overview
Polish the implementation with proper scaling preview, theme support, and consistent styling.

### Changes Required:

#### 1. Add Scale Transform for Large Canvases
**File**: `apps/www/src/routes/tools/twitter-banner.tsx`
**Changes**: Add scaling for the preview when canvas is wider than viewport

```tsx
function TwitterBannerPage() {
  const canvasRef = useRef<ImageCanvasRef>(null);
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Calculate scale to fit canvas in viewport
  useEffect(() => {
    const updateScale = () => {
      if (wrapperRef.current) {
        const availableWidth = wrapperRef.current.clientWidth - 48; // padding
        const newScale = Math.min(1, availableWidth / BANNER_WIDTH);
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div className="min-h-screen bg-background" ref={wrapperRef}>
      {/* ... */}

      {/* Canvas Preview with scaling */}
      <div
        className="border border-border rounded-lg overflow-hidden inline-block origin-top-left"
        style={{ transform: `scale(${scale})` }}
      >
        <ImageCanvas
          ref={canvasRef}
          width={BANNER_WIDTH}
          height={BANNER_HEIGHT}
        >
          {/* content */}
        </ImageCanvas>
      </div>

      {/* ... */}
    </div>
  );
}
```

#### 2. Add Theme Toggle Support
Ensure the canvas respects light/dark mode by using CSS variables that are already defined in globals.css.

The `bg-background` mapping already handles this via:
- Light: `--background: oklch(1 0 0)` (white)
- Dark: `--background: oklch(0 0 0)` (black)

No additional changes needed - the ImageCanvas uses `var(--background)` inline.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes
- [x] `pnpm build` succeeds

#### Manual Verification:
- [ ] Preview scales down on narrow viewports
- [ ] Exported image is always full resolution (not scaled)
- [ ] Theme toggle changes canvas background in preview and export

---

## Testing Strategy

### Unit Tests:
- Export utilities correctly generate WebP blobs
- Export utilities correctly generate SVG strings
- ImageCanvas exposes correct ref API

### Integration Tests:
- Full export flow from canvas to downloaded file

### Manual Testing Steps:
1. Navigate to `/tools/twitter-banner`
2. Verify the layered I effect displays correctly
3. Select WebP format, 2× resolution, click Download
4. Open downloaded file - verify dimensions are 3000×1000px
5. Select SVG format, click Download
6. Open downloaded SVG in browser - verify it renders correctly
7. Toggle dark mode - verify canvas background changes
8. Export in dark mode - verify exported file has dark background

## Performance Considerations

- `html-to-image` renders to canvas first, which can be memory-intensive for large multipliers
- 4× multiplier on 1500×500 = 6000×2000 = 12 million pixels (manageable)
- SVG export with `foreignObject` may have font embedding issues in some viewers

## Migration Notes

N/A - This is a new feature with no existing data to migrate.

## References

- Original research: `thoughts/shared/research/2026-01-31-twitter-banner-layered-i-effect.md`
- Layered effect source: `apps/www/src/routes/index.tsx:230-293`
- Package pattern: `packages/ui/package.json`
- html-to-image docs: https://github.com/bubkoo/html-to-image
