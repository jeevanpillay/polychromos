---
date: 2026-02-01T12:00:00+08:00
researcher: Claude
git_commit: 72f5fdf78f8dc5c369d6b0bbe81d025782e0e7eb
branch: main
repository: x
topic: "GPGPU Displacement Effect Shows Black Screen - Root Cause Analysis"
tags: [research, webgl, gpgpu, paper-design, shaders, debugging]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
---

# Research: GPGPU Displacement Effect Shows Black Screen

**Date**: 2026-02-01T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 72f5fdf78f8dc5c369d6b0bbe81d025782e0e7eb
**Branch**: main
**Repository**: x

## Research Question

After implementing the Paper Design WebGL migration plan (`thoughts/shared/plans/2026-02-01-paper-design-webgl-migration.md`), the GPGPU displacement effect shows a black screen when enabled in `/test/paper-design`. We need to identify the root causes of this issue.

## Summary

The black screen issue stems from **three interconnected problems** in the current implementation:

1. **React State Mutation Without Re-render**: The `simulationImage.src` is mutated directly without triggering React's dependency system, so Paper Design's ShaderMount never receives the updated texture.

2. **Image Loading Race Condition**: Setting `img.src = dataUrl` triggers an asynchronous decode, but the code doesn't wait for `onload` before Paper Design tries to use the image.

3. **WebGL Context Sharing Limitation**: The GPGPU renderer uses a separate WebGL context from Paper Design's ShaderMount, making direct texture sharing impossible - requiring the expensive canvas-to-image conversion path.

## Detailed Findings

### Issue 1: React State Mutation Problem

**Location**: `apps/www/src/components/webgl-background.tsx:225-227`

The current implementation mutates the `simulationImage.src` property directly:

```typescript
// Line 225-227 in webgl-background.tsx
if (simulationImage) {
  simulationImage.src = dataUrl;
}
```

However, the `uniforms` object is memoized at lines 247-275:

```typescript
const uniforms = useMemo(
  () => ({
    // ...
    u_simulationTexture:
      enableDisplacement && simulationImage
        ? simulationImage
        : neutralImage ?? undefined,
    // ...
  }),
  [noiseTexture, neutralImage, enableGrain, enableDisplacement, simulationImage],
);
```

**Why This Fails**:
- The `useMemo` dependency array includes `simulationImage` (the object reference)
- Mutating `simulationImage.src` doesn't change the object reference
- React doesn't detect the change, so `uniforms` is never recomputed
- Paper Design's ShaderMount never receives the updated texture

**Paper Design's Caching Behavior**:
The Paper Design vanilla layer caches textures by `src` + dimensions (from `node_modules/@paper-design/shaders/dist/shader-mount.js:267`):
```javascript
cacheValue = `${value.src.slice(0, 200)}|${value.naturalWidth}x${value.naturalHeight}`;
```

Even if the uniform update triggered, the cache would detect the `src` change. But since React never triggers the update effect, Paper Design never sees the new `src`.

### Issue 2: Image Loading Race Condition

**Location**: `apps/www/src/components/webgl-background.tsx:179-182, 225-227`

The simulation image is created once during initialization:

```typescript
// Lines 179-182
const simImg = new Image();
simImg.width = gpuWidth;
simImg.height = gpuHeight;
setSimulationImage(simImg);
```

Then updated every frame:

```typescript
// Lines 225-227
if (simulationImage) {
  simulationImage.src = dataUrl;
}
```

**Why This Fails**:
- Setting `img.src` to a data URL triggers async decoding
- No `onload` handler waits for the decode to complete
- Paper Design's `setTextureUniform` validates image is loaded (from `shader-mount.js:213-215`):
  ```javascript
  if (!image.complete || image.naturalWidth === 0) {
    throw new Error(`Paper Shaders: image for uniform ${uniformName} must be fully loaded`);
  }
  ```
- If ShaderMount attempts to use the image before decode completes, it either throws or uses stale data

**Note**: While data URLs for small images often decode synchronously in modern browsers, this is not guaranteed behavior.

### Issue 3: Separate WebGL Contexts

**Location**: `apps/www/src/components/webgl-background.tsx:144-153`

The GPGPU renderer creates its own WebGL context on an offscreen canvas:

```typescript
// Lines 144-153
const canvas = document.createElement("canvas");
canvas.width = gpuWidth;
canvas.height = gpuHeight;
gpgpuCanvasRef.current = canvas;

const gl = canvas.getContext("webgl2", {
  antialias: false,
  alpha: false,
  preserveDrawingBuffer: true,
});
```

Meanwhile, Paper Design's ShaderMount creates its own context internally.

**Why This Matters**:
- WebGL textures cannot be shared between different contexts
- The GPGPU texture (`gpgpu.getCurrentTexture()`) lives in the offscreen context
- Paper Design's context cannot directly sample from this texture
- The canvas-to-dataURL-to-image conversion path is the only available bridge

### Data Flow Analysis

**Current Flow** (broken):
```
GPGPU Compute → Float Texture → renderTextureToCanvas() → canvas.toDataURL()
    → simulationImage.src = dataUrl → [No React trigger] → [No ShaderMount update]
```

**Expected Flow** (if React triggered):
```
GPGPU Compute → Float Texture → renderTextureToCanvas() → canvas.toDataURL()
    → simulationImage.src = dataUrl → [Image decode] → [Wait for onload]
    → [Trigger uniforms recompute] → ShaderMount.setUniforms() → texImage2D()
```

### Float Texture to Canvas Conversion

**Location**: `apps/www/src/components/webgl-background.tsx:298-368`

The `renderTextureToCanvas()` function correctly implements a pass-through shader to render the RGBA32F texture to the canvas:

```glsl
// Fragment shader (lines 314-322)
#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 fragColor;
void main() {
  fragColor = texture(u_texture, v_texCoord);
}
```

**This part works correctly because**:
- Float values are clamped to [0,1] by the simulation shader (`simulation.frag:49-51`)
- WebGL automatically converts float to 8-bit when rendering to canvas's RGBA8 framebuffer
- `preserveDrawingBuffer: true` ensures the buffer is available for `toDataURL()`

### Paper Design Uniform Handling

**From node_modules analysis**:

The React ShaderMount wrapper uses an effect to update uniforms (lines 116-128 in `@paper-design/shaders-react/dist/shader-mount.js`):

```javascript
useEffect(() => {
  let isStale = false;
  const updateUniforms = async () => {
    const uniforms = await processUniforms(uniformsProp);
    if (!isStale) {
      shaderMountRef.current?.setUniforms(uniforms);
    }
  };
  updateUniforms();
  return () => { isStale = true; };
}, [uniformsProp, isInitialized]);
```

**Key Insight**: This effect depends on `uniformsProp`. Since the parent component's `uniforms` useMemo doesn't recompute (Issue 1), this effect never re-runs.

## Code References

- `apps/www/src/components/webgl-background.tsx:225-227` - simulationImage.src mutation
- `apps/www/src/components/webgl-background.tsx:247-275` - uniforms useMemo
- `apps/www/src/components/webgl-background.tsx:144-153` - GPGPU canvas creation
- `apps/www/src/components/webgl-background.tsx:179-182` - simulationImage creation
- `apps/www/src/components/webgl-background.tsx:298-368` - renderTextureToCanvas function
- `apps/www/src/lib/gpgpu-renderer.ts:144-163` - RGBA32F texture creation
- `apps/www/src/shaders/simulation.frag:49-51` - Float value clamping
- `apps/www/src/shaders/background.frag:47-48` - Simulation texture sampling

## Architecture Documentation

### Current Implementation

```
┌─────────────────────────────────────────────────────────────────┐
│                    webgl-background.tsx                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │  Offscreen Canvas    │    │   Paper Design ShaderMount   │   │
│  │  (WebGL2 Context A)  │    │   (WebGL2 Context B)         │   │
│  ├──────────────────────┤    ├─────────────────────────────┤   │
│  │                      │    │                              │   │
│  │  ┌───────────────┐  │    │  ┌────────────────────┐     │   │
│  │  │GPGPURenderer  │  │    │  │  background.frag   │     │   │
│  │  │               │  │    │  │                    │     │   │
│  │  │ simulation.   │  │    │  │  Samples:          │     │   │
│  │  │ frag          │  │    │  │  - u_noiseTexture  │     │   │
│  │  │               │  │    │  │  - u_simulation-   │     │   │
│  │  │ Ping-pong     │──┼────┼──│    Texture  ✗      │     │   │
│  │  │ RGBA32F       │  │    │  │                    │     │   │
│  │  │ textures      │  │    │  └────────────────────┘     │   │
│  │  └───────────────┘  │    │                              │   │
│  │         │           │    │                              │   │
│  │         ▼           │    │                              │   │
│  │  renderTextureToCanvas  │                              │   │
│  │         │           │    │                              │   │
│  │         ▼           │    │                              │   │
│  │  canvas.toDataURL() │    │                              │   │
│  │         │           │    │                              │   │
│  └─────────┼───────────┘    └─────────────────────────────┘   │
│            │                                                    │
│            ▼                                                    │
│  simulationImage.src = dataUrl  (mutation without re-render)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

✗ = Connection broken due to React state mutation issue
```

### Pipeline Timing

```
Frame N:
  1. requestAnimationFrame → runGPGPU()
  2. gpgpu.compute() → writes to RGBA32F texture
  3. renderTextureToCanvas() → renders to offscreen canvas
  4. canvas.toDataURL() → encodes PNG (~48x27 px)
  5. simulationImage.src = dataUrl → DOES NOT trigger React
  6. Paper Design renders with STALE texture

  Time: ~16ms target, actual varies with PNG encoding
```

## Historical Context

The Paper Design migration was implemented following the plan in `thoughts/shared/plans/2026-02-01-paper-design-webgl-migration.md`. The plan identified that Paper Design uses a different rendering architecture than the previous Three.js implementation:

- Three.js: Multi-pass EffectComposer with shared WebGL context
- Paper Design: Single-pass, shader-first with React-managed uniforms

The plan noted the need for "custom vanilla WebGL2 GPGPU for mouse displacement" but didn't fully address the React state management challenges when bridging vanilla WebGL with Paper Design's React wrapper.

## Related Research

- `thoughts/shared/research/2026-02-01-gpgpu-mouse-displacement-effect.md` - GPGPU implementation research
- `thoughts/shared/research/2026-02-01-webgl-background-restructure.md` - Background component architecture

## Open Questions

1. **Alternative Approaches**: Could Paper Design's ShaderMount expose its WebGL context to enable direct texture sharing?
2. **Performance Impact**: How significant is the canvas-to-image conversion overhead at 60fps?
3. **Shared Context Solution**: Could both GPGPU and Paper Design use the same canvas/context?
4. **State Management Pattern**: What's the idiomatic way to handle per-frame texture updates with Paper Design?

## Potential Solutions (For Reference)

### Solution A: Force State Update with Counter

```typescript
const [frameCount, setFrameCount] = useState(0);

// In runGPGPU:
simulationImage.src = dataUrl;
setFrameCount(c => c + 1); // Force re-render

// In uniforms memo:
const uniforms = useMemo(() => ({
  // ...
}), [/* deps */, frameCount]); // Include frameCount
```

### Solution B: Create New Image Each Frame

```typescript
// In runGPGPU:
const newImg = new Image();
newImg.onload = () => setSimulationImage(newImg);
newImg.src = dataUrl;
```

### Solution C: Custom ShaderMount with Direct Texture Support

Extend or wrap Paper Design's ShaderMount to accept WebGLTexture directly, bypassing the image conversion pipeline entirely.

### Solution D: Shared WebGL Context

Obtain Paper Design's WebGL context and use it for GPGPU, enabling direct texture sharing between the simulation and display shaders.
