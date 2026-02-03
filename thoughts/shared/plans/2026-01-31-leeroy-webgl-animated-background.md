# Leeroy WebGL Animated Background Implementation Plan

## Overview

Implement a simplified version of the Leeroy.ca animated noise gradient background for the homepage. This creates a fluid, organic-looking animated gradient using WebGL shaders without the mouse interaction (GPGPU) or film grain post-processing. The effect will be disabled on mobile devices for performance.

## Current State Analysis

- **No existing WebGL/Three.js code** in the codebase
- **TanStack Start with SSR** requires client-only rendering for WebGL
- **Homepage** at `apps/www/src/routes/index.tsx` currently has a solid `bg-background` (black in dark mode)
- **Root layout** at `apps/www/src/routes/__root.tsx` provides the document structure
- **GSAP already installed** but not Three.js or related libraries

### Key Discoveries:
- `apps/www/src/routes/__root.tsx:68-71` - Main wrapper with `relative` positioning
- `packages/ui/src/globals.css:151-152` - Dark theme uses `oklch(0 0 0)` for background
- Research document: `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md`

## Desired End State

After implementation:
1. Homepage displays an animated noise-based gradient background (4-color gradient with flowing animation)
2. WebGL effect renders behind all content via absolute positioning
3. Mobile devices show a CSS gradient fallback (no WebGL)
4. Page load performance remains excellent (lazy loading, client-only rendering)
5. No memory leaks when navigating away from homepage

### Verification:
- Desktop: Animated WebGL gradient visible behind homepage content
- Mobile (< 768px): CSS gradient fallback, no WebGL initialization
- DevTools Performance: No frame drops, smooth 60fps animation
- Navigation: Clean cleanup when leaving homepage

## What We're NOT Doing

- **NO mouse interaction** (GPGPU displacement simulation)
- **NO film grain post-processing**
- **NO global background** (homepage only)
- **NO WebGL on mobile devices**
- **NO React Three Fiber** (using vanilla Three.js for simpler shader integration)
- **NO custom WebGL context management** (using Three.js built-in)

## Implementation Approach

We'll use vanilla Three.js with a custom ShaderMaterial for maximum control over the shader uniforms and to match the extracted Leeroy shaders exactly. The component will:

1. Detect viewport size and skip WebGL on mobile
2. Lazy load Three.js to avoid impacting initial bundle
3. Render to a fullscreen canvas positioned behind content
4. Animate using requestAnimationFrame via Three.js
5. Properly dispose resources on unmount

## Phase 1: Install Dependencies and Add Noise Texture

### Overview
Add Three.js dependency and download the required noise texture asset.

### Changes Required:

#### 1. Add Three.js to www app
**File**: `apps/www/package.json`
**Changes**: Add Three.js as a dependency

```json
{
  "dependencies": {
    "three": "^0.173.0"
  },
  "devDependencies": {
    "@types/three": "^0.173.0"
  }
}
```

#### 2. Download noise texture
**File**: `apps/www/public/textures/seamless-noise.png`
**Source**: Download from `https://www.leeroy.ca/dist/assets/3seamless-7f29af5e.png`

This seamless tileable noise texture is required for the gradient animation.

### Success Criteria:

#### Automated Verification:
- [x] Dependencies install successfully: `pnpm install`
- [x] TypeScript recognizes Three.js types: `pnpm typecheck`
- [x] Noise texture exists at `apps/www/public/textures/seamless-noise.png`

#### Manual Verification:
- [x] Verify noise texture is a valid PNG image

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Create Shader Files

### Overview
Create the GLSL shader files for the animated gradient background.

### Changes Required:

#### 1. Create vertex shader
**File**: `apps/www/src/shaders/background.vert`
**Changes**: Simple UV pass-through vertex shader

```glsl
varying vec2 vUv;

void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  vUv = uv;
}
```

#### 2. Create fragment shader
**File**: `apps/www/src/shaders/background.frag`
**Changes**: Main gradient fragment shader (simplified from Leeroy - no menu mode or scroll offset)

```glsl
varying vec2 vUv;

uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform float uSize;
uniform vec2 uOffset;
uniform float uSpeed;
uniform sampler2D uNoiseTexture;
uniform vec2 uResolution;

void main() {
    // Aspect ratio correction
    vec2 nUv = (-.5 + vUv) * 2.;
    if (uResolution.x < uResolution.y) {
        nUv.x *= uResolution.x / uResolution.y;
    } else {
        nUv.y *= uResolution.y / uResolution.x;
    }
    nUv = nUv / 2. + .5;

    // UV manipulation for noise sampling
    vec2 bUv = nUv * (uSize * 2.) + uOffset;
    vec2 nUv1 = bUv + uOffset + uTime * uSpeed;
    bUv.y -= .5;
    vec2 nUv2 = bUv + uOffset - uTime * uSpeed;

    // Sample noise texture at two different UV positions (moving in opposite directions)
    vec4 noiseColor1 = texture2D(uNoiseTexture, nUv1);
    float noise1 = noiseColor1.r;

    vec4 noiseColor2 = texture2D(uNoiseTexture, nUv2);
    float noise2 = noiseColor2.r;

    // Blend the two noise samples
    float noise = clamp((noise1 + noise2) / 2., 0., 1.);

    // Third noise sample for additional variation
    vec2 nUv3 = bUv + noise * .5;
    noise = texture2D(uNoiseTexture, nUv3).r;

    // Color gradient based on noise value (4 color stops)
    vec3 color = vec3(0.);

    if (noise < 0.25) {
        color = mix(uColor1, uColor2, noise / 0.25);
    } else if (noise < 0.5) {
        color = mix(uColor2, uColor3, (noise - 0.25) / 0.25);
    } else if (noise < 0.75) {
        color = mix(uColor3, uColor4, (noise - 0.5) / 0.25);
    } else {
        color = uColor4;
    }

    gl_FragColor = vec4(color, 1.);
}
```

#### 3. Configure Vite to handle GLSL files
**File**: `apps/www/vite.config.ts`
**Changes**: Add vite-plugin-glsl or use raw imports

```typescript
// Option 1: Use ?raw import (built-in to Vite, no plugin needed)
// Shaders will be imported as: import vertexShader from './shaders/background.vert?raw'

// Option 2: If we want .glsl extension support, add vite-plugin-glsl
// For simplicity, we'll use ?raw imports which require no additional plugin
```

Since Vite supports `?raw` imports natively, no config changes are needed. We'll import shaders as raw strings.

### Success Criteria:

#### Automated Verification:
- [x] Shader files exist in correct locations
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Build completes successfully: `pnpm build:www`

#### Manual Verification:
- [x] Shader syntax looks correct (no GLSL errors will show until runtime)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Create WebGL Background Component

### Overview
Create the React component that initializes Three.js, creates the scene with the shader material, and handles animation.

### Changes Required:

#### 1. Create the WebGL background component
**File**: `apps/www/src/components/webgl-background.tsx`
**Changes**: Full component implementation

```tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import vertexShader from "~/shaders/background.vert?raw";
import fragmentShader from "~/shaders/background.frag?raw";

// Color palette from Leeroy (can be customized)
const COLORS = {
  color1: new THREE.Color(0x414249), // Charcoal
  color2: new THREE.Color(0x242733), // Dark blue-grey
  color3: new THREE.Color(0x3167a0), // Medium blue
  color4: new THREE.Color(0x7599f5), // Light blue/purple
};

// Animation settings
const SETTINGS = {
  size: 0.2,
  speed: 0.02,
  offset: new THREE.Vector2(0.42, 0.6),
};

export function WebGLBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (!isMounted || isMobile || !containerRef.current) return;

    const container = containerRef.current;
    let animationId: number;
    let isDisposed = false;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Load noise texture
    const textureLoader = new THREE.TextureLoader();
    const noiseTexture = textureLoader.load("/textures/seamless-noise.png");
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;

    // Shader material
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uNoiseTexture: { value: noiseTexture },
        uColor1: { value: COLORS.color1 },
        uColor2: { value: COLORS.color2 },
        uColor3: { value: COLORS.color3 },
        uColor4: { value: COLORS.color4 },
        uSize: { value: SETTINGS.size },
        uOffset: { value: SETTINGS.offset },
        uSpeed: { value: SETTINGS.speed },
        uResolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
      },
    });

    // Fullscreen plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Handle resize
    const handleResize = () => {
      if (isDisposed) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      material.uniforms.uResolution.value.set(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      if (isDisposed) return;
      material.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);

      // Dispose Three.js resources
      geometry.dispose();
      material.dispose();
      noiseTexture.dispose();
      renderer.dispose();

      // Remove canvas from DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isMounted, isMobile]);

  // Don't render anything on server
  if (!isMounted) {
    return null;
  }

  // Mobile fallback: CSS gradient
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(135deg,
            ${COLORS.color1.getStyle()} 0%,
            ${COLORS.color2.getStyle()} 33%,
            ${COLORS.color3.getStyle()} 66%,
            ${COLORS.color4.getStyle()} 100%)`,
        }}
      />
    );
  }

  // Desktop: WebGL canvas container
  return <div ref={containerRef} className="fixed inset-0 -z-10" />;
}
```

#### 2. Add TypeScript declaration for raw imports
**File**: `apps/www/src/vite-env.d.ts` (or create if doesn't exist)
**Changes**: Add declaration for `?raw` imports

```typescript
/// <reference types="vite/client" />

declare module "*.vert?raw" {
  const content: string;
  export default content;
}

declare module "*.frag?raw" {
  const content: string;
  export default content;
}

declare module "*.glsl?raw" {
  const content: string;
  export default content;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build completes successfully: `pnpm build:www`

#### Manual Verification:
- [x] Component file structure looks correct
- [x] Imports resolve properly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Integrate Background into Homepage

### Overview
Add the WebGL background component to the homepage with lazy loading.

### Changes Required:

#### 1. Update homepage to include WebGL background
**File**: `apps/www/src/routes/index.tsx`
**Changes**: Import and render the WebGL background component

```tsx
// Add to imports at top of file
import { lazy, Suspense, useState } from "react";

const WebGLBackground = lazy(() =>
  import("~/components/webgl-background").then((m) => ({
    default: m.WebGLBackground,
  }))
);

// Add inside HomePage component, at the start of the return JSX:
function HomePage() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* WebGL Background - Lazy loaded */}
      <Suspense fallback={null}>
        <WebGLBackground />
      </Suspense>

      {/* Rest of existing content... */}
      {/* Contact CTA Button - Desktop Only (Top Right Fixed) */}
      <Button
        // ... existing code
```

Note: The existing `bg-background` class can remain as it provides the fallback color before WebGL loads.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build completes successfully: `pnpm build:www`
- [x] Dev server starts without errors: `pnpm dev:www`

#### Manual Verification:
- [x] Desktop browser: Animated gradient background visible behind content
- [x] Animation is smooth (60fps, no stuttering)
- [x] Text remains readable over the gradient
- [ ] Mobile browser (< 768px): CSS gradient fallback visible
- [ ] Resize window: Background adapts correctly
- [ ] Navigate away and back: No memory leaks, effect restarts cleanly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Color Customization and Final Polish

### Overview
Adjust colors to better match the site's dark theme and add any performance optimizations.

### Changes Required:

#### 1. (Optional) Customize color palette
**File**: `apps/www/src/components/webgl-background.tsx`
**Changes**: Adjust COLORS object to match brand

The current colors from Leeroy work well with dark themes. Consider these alternatives if needed:

```tsx
// Option A: Keep Leeroy colors (current)
const COLORS = {
  color1: new THREE.Color(0x414249), // Charcoal
  color2: new THREE.Color(0x242733), // Dark blue-grey
  color3: new THREE.Color(0x3167a0), // Medium blue
  color4: new THREE.Color(0x7599f5), // Light blue/purple
};

// Option B: Darker, more subtle version
const COLORS = {
  color1: new THREE.Color(0x0a0a0a), // Near black
  color2: new THREE.Color(0x1a1a2e), // Dark navy
  color3: new THREE.Color(0x16213e), // Deep blue
  color4: new THREE.Color(0x0f3460), // Medium blue
};

// Option C: Match brand-red accent
const COLORS = {
  color1: new THREE.Color(0x0a0a0a), // Near black
  color2: new THREE.Color(0x1a1a1a), // Dark grey
  color3: new THREE.Color(0x2a1a1a), // Hint of red
  color4: new THREE.Color(0x3a1a1a), // Subtle red
};
```

#### 2. Add prefers-reduced-motion support
**File**: `apps/www/src/components/webgl-background.tsx`
**Changes**: Respect user's motion preferences

```tsx
// Add inside the component, after isMobile state
const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

useEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  setPrefersReducedMotion(mediaQuery.matches);

  const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}, []);

// In animation loop, slow down or pause animation
const animate = () => {
  if (isDisposed) return;
  // Reduce speed significantly if user prefers reduced motion
  const speedMultiplier = prefersReducedMotion ? 0.1 : 1;
  material.uniforms.uTime.value = clock.getElapsedTime() * speedMultiplier;
  renderer.render(scene, camera);
  animationId = requestAnimationFrame(animate);
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build completes successfully: `pnpm build:www`

#### Manual Verification:
- [x] Colors look good against text content
- [ ] Enable "Reduce Motion" in OS settings: Animation slows significantly
- [x] No accessibility complaints about contrast
- [x] Production build: Effect loads and runs correctly

**Implementation Note**: After completing this phase, the implementation is complete.

---

## Testing Strategy

### Unit Tests:
- Not applicable for this visual component (no business logic)

### Integration Tests:
- Not applicable (visual verification only)

### Manual Testing Steps:
1. **Desktop Chrome/Firefox/Safari**: Verify WebGL gradient renders and animates
2. **Mobile Safari/Chrome**: Verify CSS gradient fallback appears (no WebGL)
3. **Resize window**: Verify background adapts without glitches
4. **Navigate away**: Open DevTools Memory tab, verify no Three.js objects retained
5. **Navigate back**: Verify effect restarts cleanly
6. **Enable "Reduce Motion"**: Verify animation slows
7. **Slow network (DevTools)**: Verify page loads acceptably while texture loads

## Performance Considerations

1. **Lazy loading**: Three.js is dynamically imported, not in initial bundle
2. **Pixel ratio capped**: Max 2x to prevent performance issues on high-DPI displays
3. **No anti-aliasing**: Disabled for performance (not noticeable on gradient)
4. **Mobile disabled**: No WebGL overhead on mobile devices
5. **Cleanup on unmount**: All Three.js resources properly disposed

## Bundle Impact

Estimated additions to www app bundle:
- `three` package: ~150KB gzipped (lazy loaded, not in initial bundle)
- Shader files: ~2KB (inlined as strings)
- Component: ~3KB
- Noise texture: ~50KB (loaded on demand)

**Initial bundle impact**: Minimal (only component code loaded initially)
**Runtime impact**: ~150KB Three.js loaded when homepage mounts on desktop

## References

- Research document: `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md`
- Original site: https://www.leeroy.ca/
- Three.js documentation: https://threejs.org/docs/
- React Three.js SSR patterns: Web research (see research notes)

---

**Last Updated**: 2026-01-31
**Author**: Claude Opus 4.5
**Status**: Ready for Review
