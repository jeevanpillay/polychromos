---
date: 2026-02-01T15:30:00+11:00
researcher: Claude
git_commit: 1dd6c3d9e043f9cb03ee7575b2f0307c0fb3fe24
branch: main
repository: x
topic: "WebGL Background Effect Toggle Mechanisms"
tags: [research, codebase, webgl, effects, grain, displacement, flags]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
---

# Research: WebGL Background Effect Toggle Mechanisms

**Date**: 2026-02-01
**Researcher**: Claude
**Git Commit**: 1dd6c3d9e043f9cb03ee7575b2f0307c0fb3fe24
**Branch**: main
**Repository**: x

## Research Question

How are effects currently configured in the WebGL background component, and what mechanisms exist for toggling individual effects (grain, displacement/mouse effect)?

## Summary

The WebGL background component (`webgl-background.tsx`) currently has **two distinct effects** implemented:

1. **Film Grain Effect** - A post-processing pass applied via the `postprocessing` library
2. **Mouse Displacement Effect** - A GPGPU-based simulation that distorts the gradient based on mouse movement

Both effects are currently **always enabled** when the component renders. There are no existing toggle flags or conditional rendering for individual effects. However, both effects have **configurable settings** via constants that control their intensity/behavior, which provides a built-in mechanism for effectively disabling them.

## Detailed Findings

### Effect 1: Film Grain Post-Processing

**Location**: `apps/www/src/components/webgl-background.tsx:112-118`

The grain effect is added as a post-processing pass in the render pipeline:

```tsx
// Add grain effect (lines 112-118)
const grainEffect = new GrainEffect({
  intensity: GRAIN_SETTINGS.intensity,
  size: GRAIN_SETTINGS.size,
  speed: GRAIN_SETTINGS.speed,
});
composer.addPass(new EffectPass(camera, grainEffect));
```

**Configuration Constants** (`webgl-background.tsx:25-30`):

```tsx
const GRAIN_SETTINGS = {
  intensity: 1.29, // How strong the grain effect is (0-2)
  size: 2.0,       // Grain cell size in pixels
  speed: 8.0,      // Animation updates per second
};
```

**GrainEffect Class** (`apps/www/src/effects/grain-effect.ts`):

The `GrainEffect` class extends `Effect` from the `postprocessing` library and exposes runtime setters:
- `intensity` (getter/setter) - Controls blend strength
- `size` (getter/setter) - Controls grain cell size
- `speed` (getter/setter) - Controls animation speed (set to 0 for static)

**Shader Implementation** (`apps/www/src/shaders/grain.frag`):

The grain shader uses three uniforms:
- `uGrainIntensity` - Blend opacity (0 = invisible)
- `uGrainSize` - Cell size in pixels
- `uGrainSpeed` - Animation frame rate

**Existing Disable Mechanism**: Setting `intensity: 0` effectively disables the grain effect visually.

### Effect 2: Mouse Displacement (GPGPU)

**Location**: `apps/www/src/components/webgl-background.tsx:120-180`

The displacement effect uses `GPUComputationRenderer` to simulate mouse-driven distortion:

```tsx
// Setup GPGPU for mouse displacement simulation (lines 120-132)
const gpuWidth = Math.floor(window.innerWidth / DISPLACEMENT_SETTINGS.resolutionDivisor);
const gpuHeight = Math.floor(window.innerHeight / DISPLACEMENT_SETTINGS.resolutionDivisor);
const gpuCompute = new GPUComputationRenderer(gpuWidth, gpuHeight, renderer);
```

**Configuration Constants** (`webgl-background.tsx:32-39`):

```tsx
const DISPLACEMENT_SETTINGS = {
  resolutionDivisor: 40,
  displacementStrength: 1.0,  // Controls distortion amount
  cursorColoring: 1.5,        // Brightens area under cursor
  mouseFactor: 1.0,           // Master toggle (0-1)
};
```

**Simulation Shader** (`apps/www/src/shaders/simulation.frag`):

Key uniform for toggling:
- `uMouseFactor` - Multiplier for mouse influence (0 = no effect)

```glsl
float influence = lineInfluence * velocityFactor * uMouseFactor;
```

**Fragment Shader Integration** (`apps/www/src/shaders/background.frag:20-29`):

```glsl
// Displacement from GPGPU simulation
vec4 simData = texture2D(uSimulationTexture, vUv);
vec2 displacement = (simData.rg - 0.5) * uDisplacementStrength * simData.b;
vec2 displacedUv = vUv + displacement;
```

**Existing Disable Mechanism**: Setting `mouseFactor: 0` or `displacementStrength: 0` effectively disables the displacement effect.

### Current Rendering Pipeline

1. **Scene Setup** (lines 93-106): WebGLRenderer with orthographic camera
2. **Post-Processing** (lines 108-118): EffectComposer with RenderPass + grain EffectPass
3. **GPGPU Setup** (lines 120-180): GPUComputationRenderer for displacement simulation
4. **Animation Loop** (lines 244-270):
   - Updates simulation uniforms from mouse position
   - Runs GPGPU compute pass
   - Passes simulation texture to main shader
   - Renders through composer (applies grain)

### Mouse Tracking System

**Location**: `webgl-background.tsx:59-83`

Mouse position is tracked via refs:
- `mouseRef` - Current normalized position (0-1)
- `prevMouseRef` - Previous frame position

```tsx
const handleMouseMove = (e: MouseEvent) => {
  prevMouseRef.current.copy(mouseRef.current);
  mouseRef.current.set(
    e.clientX / window.innerWidth,
    1.0 - e.clientY / window.innerHeight,
  );
};
```

### Conditional Rendering Already Present

The component already has conditional logic:

1. **Mobile Detection** (lines 48-57): Returns `null` on viewports < 768px
2. **Mount State** (lines 45-50): Only renders after client-side hydration
3. **WebGL2 Check** (lines 135-139): Warns if float textures unsupported

```tsx
// Don't render anything on server or mobile (lines 294-298)
if (!isMounted || isMobile) {
  return null;
}
```

## Code References

- `apps/www/src/components/webgl-background.tsx:25-30` - Grain settings constants
- `apps/www/src/components/webgl-background.tsx:32-39` - Displacement settings constants
- `apps/www/src/components/webgl-background.tsx:112-118` - Grain effect instantiation
- `apps/www/src/components/webgl-background.tsx:120-180` - GPGPU displacement setup
- `apps/www/src/effects/grain-effect.ts:24-77` - GrainEffect class with runtime setters
- `apps/www/src/shaders/grain.frag:29-48` - Grain shader implementation
- `apps/www/src/shaders/simulation.frag:38-42` - Mouse factor in simulation
- `apps/www/src/shaders/background.frag:20-29` - Displacement sampling in fragment shader

## Architecture Documentation

### Effect Configuration Pattern

Both effects follow a similar pattern:
1. **Constants Object** - Defines default values at module level
2. **Uniforms** - Pass values to shaders
3. **Intensity Control** - Setting to 0 effectively disables

### Post-Processing vs Inline Effects

| Effect | Type | Pipeline Stage | Disable Method |
|--------|------|----------------|----------------|
| Grain | Post-processing | After main render | `intensity: 0` |
| Displacement | Inline (shader) | During main render | `mouseFactor: 0` or `displacementStrength: 0` |

### Current Limitations

1. Effects cannot be toggled at runtime via props
2. No React state controls effect visibility
3. Settings are hardcoded constants, not configurable

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2026-02-01-webgl-background-restructure.md` - Documents the component's positioning and z-index layering
- `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md` - Original shader extraction from leeroy.ca

## Open Questions

1. Should effect toggles be exposed as component props?
2. Should there be a debug UI or query params for testing different effect combinations?
3. Should effects be conditionally compiled (skip GPGPU setup entirely) or just set to 0 intensity?
