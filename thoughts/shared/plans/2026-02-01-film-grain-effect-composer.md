# Film Grain Effect Composer Pipeline Implementation Plan

## Overview

Integrate a film grain post-processing effect into the existing WebGL background using the `postprocessing` library's EffectComposer pattern. This provides a modular, extensible post-processing pipeline that can accommodate future effects (blur, bloom, vignette, etc.).

## Current State Analysis

**File**: `apps/www/src/components/webgl-background.tsx`

The current implementation:
- Uses `THREE.ShaderMaterial` with custom vertex/fragment shaders
- Renders a fullscreen plane with orthographic camera
- Single render pass directly to screen via `renderer.render(scene, camera)`
- No post-processing pipeline
- Respects `prefers-reduced-motion` preference

### Key Discoveries:
- Renderer initialized at `webgl-background.tsx:64-71`
- Animation loop at `webgl-background.tsx:119-128` calls `renderer.render()` directly
- Reduced motion handled via `speedMultiplier` applied to `uTime`
- Cleanup properly disposes all Three.js resources at `webgl-background.tsx:131-146`
- `postprocessing` library is NOT currently installed

## Desired End State

After implementation:
1. Film grain effect is applied as a post-processing pass
2. Grain intensity, size, and animation speed are configurable via settings
3. Reduced motion preference disables grain animation (static grain or no grain)
4. Performance remains acceptable (<5% additional GPU overhead)
5. Effect can be easily toggled on/off or extended with additional effects

### Verification:
- Visual: Subtle animated grain texture visible over the gradient background
- Performance: No noticeable frame drops on target devices
- Accessibility: Grain respects `prefers-reduced-motion` setting

## What We're NOT Doing

- Not modifying the base gradient shader logic
- Not adding other effects (bloom, blur, vignette) in this implementation
- Not creating a debug UI for effect parameters
- Not adding SSR support for post-processing (client-only)

## Implementation Approach

Use the `postprocessing` library by pmndrs which provides:
- Optimized `EffectComposer` with automatic render target management
- `Effect` base class for custom shader effects
- Built-in time uniform injection
- TypeScript support

The pattern:
1. Install `postprocessing` library
2. Create custom `GrainEffect` class extending `Effect`
3. Replace `renderer.render()` with `composer.render()`
4. Add proper cleanup for composer resources

---

## Phase 1: Install Dependencies

### Overview
Add the `postprocessing` library to the www app.

### Changes Required:

#### 1. Package Installation
**File**: `apps/www/package.json`

Run command:
```bash
pnpm add postprocessing --filter @polychromos/www
```

This adds:
```json
{
  "dependencies": {
    "postprocessing": "^6.36.7"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] Package installs without errors: `pnpm install`
- [x] TypeScript recognizes postprocessing types: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] No runtime errors when loading the site

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Create Grain Effect Shader

### Overview
Create a new shader file for the film grain effect that will be used by the custom Effect class.

### Changes Required:

#### 1. Create Grain Shader File
**File**: `apps/www/src/shaders/grain.frag` (new file)

```glsl
// Film grain effect shader
// Adapted from Leeroy.ca grain post-processing

uniform float uGrainIntensity;
uniform float uGrainSize;
uniform float uGrainSpeed;

// Pseudo-random function
float random2d(vec2 coord) {
    return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Soft light blend mode (film-accurate)
float blendSoftLight(float base, float blend) {
    return (blend < 0.5)
        ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
        : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
    vec3 result = vec3(
        blendSoftLight(base.r, blend.r),
        blendSoftLight(base.g, blend.g),
        blendSoftLight(base.b, blend.b)
    );
    return mix(base, result, opacity);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate grain cell coordinates (blocky/retro look)
    float grainCells = resolution.x / uGrainSize;
    float gridX = floor(uv.x * grainCells) / grainCells;
    float gridY = 1.0 - floor(uv.y * grainCells) / grainCells;

    // Stepped animation at configurable fps for film-like feel
    // uGrainSpeed controls updates per second (8 = ~8fps feel)
    float timeSpeed = floor(mod(time, 1.0) * uGrainSpeed);

    // Generate grain value
    float grain = random2d(vec2(gridX + timeSpeed, gridY));
    grain -= 0.5; // Center around 0
    grain *= 0.1; // Reduce intensity

    // Apply soft light blend
    vec3 resultColor = blendSoftLight(inputColor.rgb, inputColor.rgb + grain, uGrainIntensity);

    outputColor = vec4(resultColor, inputColor.a);
}
```

**Notes**:
- Uses `mainImage` signature required by postprocessing library's Effect class
- `time` and `resolution` are automatically injected by postprocessing
- Grid-based grain creates a blocky/retro film look
- Stepped animation simulates lower frame rate film grain
- Soft light blend is film-accurate

### Success Criteria:

#### Automated Verification:
- [x] File exists: `apps/www/src/shaders/grain.frag`
- [x] TypeScript/build doesn't complain: `pnpm typecheck && pnpm build:www`

#### Manual Verification:
- [ ] N/A - shader is not yet integrated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Create GrainEffect Class

### Overview
Create a custom Effect class that wraps the grain shader for use with EffectComposer.

### Changes Required:

#### 1. Create GrainEffect Module
**File**: `apps/www/src/effects/grain-effect.ts` (new file)

```typescript
import { Effect, EffectAttribute } from "postprocessing";
import * as THREE from "three";
import grainFragmentShader from "~/shaders/grain.frag?raw";

export interface GrainEffectOptions {
  /** Grain blend intensity (0-2, default: 1.29) */
  intensity?: number;
  /** Grain cell size in pixels (default: 2) */
  size?: number;
  /** Animation speed - updates per second (default: 8 for film-like feel) */
  speed?: number;
}

const DEFAULT_OPTIONS: Required<GrainEffectOptions> = {
  intensity: 1.29,
  size: 2.0,
  speed: 8.0,
};

/**
 * Film grain post-processing effect.
 * Creates a subtle animated noise texture overlay using soft light blending.
 */
export class GrainEffect extends Effect {
  constructor(options: GrainEffectOptions = {}) {
    const { intensity, size, speed } = { ...DEFAULT_OPTIONS, ...options };

    super("GrainEffect", grainFragmentShader, {
      attributes: EffectAttribute.NONE,
      uniforms: new Map<string, THREE.Uniform>([
        ["uGrainIntensity", new THREE.Uniform(intensity)],
        ["uGrainSize", new THREE.Uniform(size)],
        ["uGrainSpeed", new THREE.Uniform(speed)],
      ]),
    });
  }

  /**
   * Update grain intensity at runtime.
   */
  set intensity(value: number) {
    this.uniforms.get("uGrainIntensity")!.value = value;
  }

  get intensity(): number {
    return this.uniforms.get("uGrainIntensity")!.value as number;
  }

  /**
   * Update grain size at runtime.
   */
  set size(value: number) {
    this.uniforms.get("uGrainSize")!.value = value;
  }

  get size(): number {
    return this.uniforms.get("uGrainSize")!.value as number;
  }

  /**
   * Update animation speed at runtime.
   * Set to 0 for static grain (useful for reduced motion).
   */
  set speed(value: number) {
    this.uniforms.get("uGrainSpeed")!.value = value;
  }

  get speed(): number {
    return this.uniforms.get("uGrainSpeed")!.value as number;
  }
}
```

**Notes**:
- Extends postprocessing's `Effect` class
- Exposes getters/setters for runtime adjustment
- Speed can be set to 0 for reduced motion preference

### Success Criteria:

#### Automated Verification:
- [x] File exists: `apps/www/src/effects/grain-effect.ts`
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] N/A - effect is not yet integrated

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integrate EffectComposer

### Overview
Refactor the WebGL background component to use EffectComposer with the grain effect.

### Changes Required:

#### 1. Update WebGL Background Component
**File**: `apps/www/src/components/webgl-background.tsx`

**Changes**:

1. Add imports for postprocessing:
```typescript
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { GrainEffect } from "~/effects/grain-effect";
```

2. Add grain settings constant after SETTINGS:
```typescript
// Grain effect settings
const GRAIN_SETTINGS = {
  intensity: 1.29, // How strong the grain effect is (0-2)
  size: 2.0,       // Grain cell size in pixels (higher = blockier)
  speed: 8.0,      // Animation updates per second
};
```

3. Replace renderer.render() with EffectComposer:

**After creating renderer (around line 71)**, add:
```typescript
// Setup post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

// Add grain effect
const grainEffect = new GrainEffect({
  intensity: GRAIN_SETTINGS.intensity,
  size: GRAIN_SETTINGS.size,
  speed: GRAIN_SETTINGS.speed,
});
composer.addPass(new EffectPass(camera, grainEffect));
```

4. Update animation loop to use composer and handle reduced motion:

**Replace the animate function (lines 119-128)** with:
```typescript
// Animation loop
const clock = new THREE.Clock();
const animate = () => {
  if (isDisposed) return;

  // Handle reduced motion for both gradient and grain
  const prefersReduced = prefersReducedMotionRef.current;
  const speedMultiplier = prefersReduced ? 0.1 : 1;

  // Slow gradient animation
  uTime.value = clock.getElapsedTime() * speedMultiplier;

  // Freeze grain animation when reduced motion preferred
  grainEffect.speed = prefersReduced ? 0 : GRAIN_SETTINGS.speed;

  // Use composer instead of renderer
  composer.render();

  animationId = requestAnimationFrame(animate);
};
animate();
```

5. Update handleResize to update composer:

**Add after renderer.setSize (around line 113)**:
```typescript
composer.setSize(width, height);
```

6. Update cleanup to dispose composer:

**Add to cleanup return (around line 137)**:
```typescript
composer.dispose();
```

### Full Updated Component

```typescript
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import vertexShader from "~/shaders/background.vert?raw";
import fragmentShader from "~/shaders/background.frag?raw";
import { GrainEffect } from "~/effects/grain-effect";

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

// Grain effect settings
const GRAIN_SETTINGS = {
  intensity: 1.29, // How strong the grain effect is (0-2)
  size: 2.0,       // Grain cell size in pixels (higher = blockier)
  speed: 8.0,      // Animation updates per second
};

export function WebGLBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotionRef = useRef(false);
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

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mediaQuery.matches;

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
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

    // Setup post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Add grain effect
    const grainEffect = new GrainEffect({
      intensity: GRAIN_SETTINGS.intensity,
      size: GRAIN_SETTINGS.size,
      speed: GRAIN_SETTINGS.speed,
    });
    composer.addPass(new EffectPass(camera, grainEffect));

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

    // Get references to uniforms for type safety
    const uResolution = material.uniforms.uResolution as THREE.IUniform<THREE.Vector2>;
    const uTime = material.uniforms.uTime as THREE.IUniform<number>;

    // Handle resize
    const handleResize = () => {
      if (isDisposed) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      composer.setSize(width, height);
      uResolution.value.set(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      if (isDisposed) return;

      // Handle reduced motion for both gradient and grain
      const prefersReduced = prefersReducedMotionRef.current;
      const speedMultiplier = prefersReduced ? 0.1 : 1;

      // Slow gradient animation
      uTime.value = clock.getElapsedTime() * speedMultiplier;

      // Freeze grain animation when reduced motion preferred
      grainEffect.speed = prefersReduced ? 0 : GRAIN_SETTINGS.speed;

      // Use composer instead of renderer
      composer.render();

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
      composer.dispose();
      renderer.dispose();

      // Remove canvas from DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isMounted, isMobile]);

  // Don't render anything on server or mobile
  // Mobile shows bg-background from body, desktop shows WebGL overlay
  if (!isMounted || isMobile) {
    return null;
  }

  // Desktop: WebGL canvas container (z-0 sits above body bg-background, below content z-10)
  return <div ref={containerRef} className="fixed inset-0 z-0" />;
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (for modified files)
- [x] Build succeeds: `pnpm build:www`
- [x] Dev server starts without errors: `pnpm dev:www`

#### Manual Verification:
- [x] WebGL background still displays the animated gradient
- [x] Subtle grain texture is visible over the gradient
- [x] Grain animates with a stepped/film-like feel
- [x] Resizing browser window doesn't break the effect
- [x] No console errors in browser developer tools
- [x] With `prefers-reduced-motion: reduce`, grain animation freezes but gradient still animates slowly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Performance Optimization (Optional)

### Overview
If performance testing reveals issues, apply these optimizations.

### Potential Optimizations:

#### 1. Reduce Render Target Resolution
If the grain effect causes performance issues on low-end devices, render at lower resolution:

```typescript
const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType,
  multisampling: 0,
});
```

#### 2. Disable on Low-Power Devices
Add detection for low-power mode or low-end GPUs:

```typescript
// In webgl-background.tsx
const isLowPower = navigator.hardwareConcurrency <= 2;
if (isLowPower) {
  grainEffect.intensity = 0; // Disable grain
}
```

#### 3. Lower Grain Resolution
Increase grain size for fewer calculations:

```typescript
const GRAIN_SETTINGS = {
  size: 4.0, // Larger cells = fewer calculations
};
```

### Success Criteria:

#### Automated Verification:
- [ ] Build succeeds after optimizations: `pnpm build:www`

#### Manual Verification:
- [ ] Performance is acceptable on target devices
- [ ] No visible quality degradation (or acceptable trade-off)

---

## Testing Strategy

### Unit Tests:
- N/A - Visual effects are difficult to unit test meaningfully

### Integration Tests:
- N/A - WebGL effects require browser environment

### Manual Testing Steps:
1. Open site in Chrome, Firefox, Safari on desktop
2. Verify grain effect is visible and animating
3. Resize window to various sizes - effect should adapt
4. Open DevTools > Rendering > Enable "Prefer reduced motion" - grain should freeze
5. Check console for WebGL errors or warnings
6. Check Performance tab for frame drops (should maintain 60fps)
7. Test on a low-end device if available

## Performance Considerations

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Additional render pass | +1 GPU draw call | Minimal impact for fullscreen effects |
| Render target memory | ~4MB at 1080p | Acceptable for desktop-only feature |
| Fragment shader complexity | +~10 ops per pixel | Trivial for modern GPUs |
| Bundle size | +~20KB gzipped | Lazy loaded, acceptable |

**Expected overhead**: <5% additional GPU usage on modern hardware.

## Migration Notes

- No data migration required
- No API changes
- Backwards compatible - simply adds a visual effect
- Mobile users unaffected (WebGL background disabled on mobile)

## References

- Research document: `thoughts/shared/research/2026-02-01-film-grain-effect-integration.md`
- Original shader extraction: `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md`
- postprocessing library: https://github.com/pmndrs/postprocessing
- Three.js docs: https://threejs.org/docs/#api/en/materials/ShaderMaterial

---

**Last Updated**: 2026-02-01
**Status**: Implemented
**Files Changed**: 4 (1 modified, 3 new)
