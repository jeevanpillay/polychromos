---
date: 2026-02-01T02:48:53Z
researcher: Claude
git_commit: a10cb37e5e73117a972a5c8140c337de774eda9f
branch: main
repository: x
topic: "Paper Design WebGL Renderer Migration - Replacing Three.js"
tags: [research, codebase, webgl, paper-design, three.js, performance, bundle-size]
status: complete
last_updated: 2026-02-01
last_updated_by: Claude
last_updated_note: "Added Effect Composer pattern analysis and migration options for grain effect"
---

# Research: Paper Design WebGL Renderer Migration

**Date**: 2026-02-01T02:48:53Z
**Researcher**: Claude
**Git Commit**: a10cb37e5e73117a972a5c8140c337de774eda9f
**Branch**: main
**Repository**: x

## Research Question

How can we replace our Three.js-based WebGL implementation with Paper Design's lightweight WebGL renderer to reduce package size?

## Summary

Paper Design's `@paper-design/shaders` package provides a **zero-dependency, standalone WebGL2 renderer** that can replace Three.js for simple shader-based backgrounds. The core renderer (`ShaderMount` class) is only **~762 lines of TypeScript** and handles all WebGL context management, shader compilation, uniform management, resize handling, and animation loops.

**Current State (Three.js)**:
- Bundle size: **~457KB** for webgl-background chunk
- Three.js node_modules: **~29MB**
- Dependencies: Three.js, texture loader, shader material, geometry, mesh

**Potential State (Paper Design)**:
- Estimated bundle size: **~10-15KB** for equivalent functionality
- Zero dependencies
- Simpler API focused on shader-first development

## Detailed Findings

### Current Implementation (Three.js)

**Component**: `apps/www/src/components/webgl-background.tsx:21-157`

The current implementation uses Three.js to:
1. Create a WebGL renderer, scene, and orthographic camera
2. Load a noise texture using TextureLoader
3. Create a ShaderMaterial with custom vertex/fragment shaders
4. Render a fullscreen PlaneGeometry
5. Animate via requestAnimationFrame

**Fragment Shader**: `apps/www/src/shaders/background.frag`
- Samples a seamless noise texture at multiple UV positions
- Blends noise samples for animated effect
- Creates 4-color gradient based on noise value

**Vertex Shader**: `apps/www/src/shaders/background.vert`
- Passes UV coordinates to fragment shader
- Uses Three.js built-in uniforms (projectionMatrix, viewMatrix, modelMatrix)

### Paper Design's ShaderMount (Replacement Candidate)

**Location**: `/tmp/paper-design-shaders/packages/shaders/src/shader-mount.ts`

The `ShaderMount` class is a self-contained WebGL2 renderer that:

1. **Creates and manages WebGL2 context** (lines 90-94)
2. **Compiles vertex and fragment shaders** (lines 582-641)
3. **Sets up fullscreen quad geometry** (lines 126-134)
4. **Manages uniforms automatically** (lines 136-156, 393-471)
   - Supports: numbers, booleans, arrays, vec2/3/4, mat3/mat4, textures
5. **Handles resize via ResizeObserver** (lines 172-269)
6. **Manages animation loop with rAF** (lines 271-318)
7. **Handles visibility changes** (pauses when tab hidden)
8. **Properly disposes resources** (lines 535-579)

**Key Features**:
- Uses WebGL2 (`#version 300 es` shaders)
- Built-in uniforms: `u_time`, `u_resolution`, `u_pixelRatio`
- Automatic texture uniform handling with aspect ratio
- Safari zoom detection and handling
- Max pixel count limiting for performance
- Min pixel ratio for quality control

### React Wrapper

**Location**: `/tmp/paper-design-shaders/packages/shaders-react/src/shader-mount.tsx`

The React wrapper provides:
- Ref forwarding to parent element
- Automatic uniform updates via useEffect
- Speed/frame control
- Image URL to HTMLImageElement conversion
- Proper cleanup on unmount

### Example Shader Implementation (Dithering)

**Vanilla**: `/tmp/paper-design-shaders/packages/shaders/src/shaders/dithering.ts`
**React**: `/tmp/paper-design-shaders/packages/shaders-react/src/shaders/dithering.tsx`

Pattern for creating a new shader:
1. Export fragment shader as template literal string
2. Define TypeScript interfaces for uniforms and params
3. Create React component that wraps ShaderMount with specific uniforms

### Migration Path

To migrate our noise gradient background:

1. **Convert Vertex Shader** to WebGL2 format:
```glsl
#version 300 es
precision mediump float;
layout(location = 0) in vec4 a_position;
// Paper uses a_position for fullscreen quad, no UV needed from vertex
```

2. **Convert Fragment Shader** to WebGL2 format:
```glsl
#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform sampler2D u_noiseTexture;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform vec4 u_color4;
uniform float u_size;
uniform vec2 u_offset;
uniform float u_speed;
out vec4 fragColor;

void main() {
    // UV from gl_FragCoord instead of varying
    vec2 uv = gl_FragCoord.xy / u_resolution;
    // ... rest of shader logic
    fragColor = vec4(color, 1.0);
}
```

3. **Create React Component**:
```tsx
import { ShaderMount } from '@paper-design/shaders-react';
import { noiseGradientFragmentShader } from './noise-gradient-shader';

export function NoiseGradientBackground({ colors, speed, ...props }) {
  const uniforms = {
    u_noiseTexture: '/textures/seamless-noise.png', // Auto-loaded as image
    u_color1: getShaderColorFromString(colors[0]),
    u_color2: getShaderColorFromString(colors[1]),
    u_color3: getShaderColorFromString(colors[2]),
    u_color4: getShaderColorFromString(colors[3]),
    u_size: 0.2,
    u_offset: [0.42, 0.6],
    u_speed: 0.02,
  };

  return (
    <ShaderMount
      fragmentShader={noiseGradientFragmentShader}
      uniforms={uniforms}
      speed={speed}
      {...props}
    />
  );
}
```

## Code References

| File | Description |
|------|-------------|
| `apps/www/src/components/webgl-background.tsx` | Current Three.js + EffectComposer implementation |
| `apps/www/src/shaders/background.frag` | Current gradient fragment shader (GLSL 1.0) |
| `apps/www/src/shaders/background.vert` | Current vertex shader (GLSL 1.0) |
| `apps/www/src/effects/grain-effect.ts` | Custom grain post-processing effect |
| `apps/www/src/shaders/grain.frag` | Grain fragment shader (soft light blend) |
| `/tmp/paper-design-shaders/packages/shaders/src/shader-mount.ts` | Paper Design's core WebGL renderer |
| `/tmp/paper-design-shaders/packages/shaders-react/src/shader-mount.tsx` | React wrapper |
| `/tmp/paper-design-shaders/packages/shaders/src/shaders/dithering.ts` | Example shader definition |
| `/tmp/paper-design-shaders/packages/shaders/src/shaders/grain-gradient.ts` | Paper's grain gradient with built-in noise |
| `/tmp/paper-design-shaders/packages/shaders/src/shaders/paper-texture.ts` | Example image filter shader |

## Architecture Documentation

### Paper Design Package Structure

```
@paper-design/shaders (vanilla, zero deps)
├── ShaderMount class (core renderer)
├── vertex-shader.ts (shared vertex shader)
├── shader-utils.ts (noise functions, helpers)
├── shaders/ (individual shader definitions)
└── utilities (color parsing, texture generation)

@paper-design/shaders-react
├── ShaderMount component (React wrapper)
├── shaders/ (React components for each shader)
└── hooks (useMergeRefs, etc.)
```

### Key Differences from Three.js

| Aspect | Three.js | Paper Design |
|--------|----------|--------------|
| Bundle Size | ~457KB (chunk) | ~10-15KB estimated |
| Dependencies | Many | Zero |
| API | Scene/Camera/Mesh | Shader-first |
| WebGL Version | WebGL 1 | WebGL 2 |
| Shader Format | GLSL 1.0 | GLSL 3.0 ES |
| Geometry | PlaneGeometry | Built-in fullscreen quad |
| Uniforms | THREE.Uniform | Plain objects |
| Textures | TextureLoader | HTMLImageElement or URL string |

## Implementation Considerations

1. **Shader Conversion**: Fragment shader needs WebGL2 syntax (`out vec4` instead of `gl_FragColor`, `texture()` instead of `texture2D()`)

2. **UV Calculation**: Paper Design uses `gl_FragCoord.xy / u_resolution` instead of varying UVs from vertex shader

3. **Texture Loading**: Pass image URL as string uniform - React wrapper auto-loads it

4. **Colors**: Use Paper's `getShaderColorFromString()` for hex-to-vec4 conversion

5. **Reduced Motion**: Add speed multiplier logic (already in our current implementation)

6. **Mobile Detection**: Keep existing mobile bailout, Paper renders `null` on server

## Effect Composer Pattern Analysis

### Current Setup (Multi-Pass Rendering)

Our current implementation uses the `postprocessing` library's EffectComposer pattern:

```
Three.js Renderer
    └── EffectComposer
            ├── RenderPass (renders scene to texture)
            └── EffectPass (GrainEffect applied on top)
```

**Files involved:**
- `apps/www/src/components/webgl-background.tsx:83-92` - Composer setup
- `apps/www/src/effects/grain-effect.ts` - Custom grain post-processing effect
- `apps/www/src/shaders/grain.frag` - Grain fragment shader with soft light blending

The grain effect uses:
- `mainImage(inputColor, uv, outputColor)` function signature (postprocessing convention)
- Accesses `resolution` and `time` built-in uniforms
- Applies stepped animation for film-like grain feel

### Paper Design's Approach (Single-Pass, Baked Effects)

**Paper Design does NOT have an EffectComposer/multi-pass pattern.** All effects are:

1. **Baked directly into fragment shaders** - e.g., `grain-gradient.ts` has `u_noise` uniform for grainy overlay
2. **Applied as image filters** - shaders can accept `u_image` input (see `paper-texture.ts`)

Example from `grain-gradient.ts`:
```glsl
// Grain/noise is calculated and applied within the same shader
float rawNoise = .75 * baseNoise - fbmVals.w - fbmVals.z;
shape += u_noise * 10. / u_colorsCount * noise;
```

### Migration Options for Grain Effect

#### Option 1: Bake Grain into Gradient Shader (Recommended)

Combine our noise gradient + grain into a single fragment shader:

```glsl
#version 300 es
precision mediump float;

// ... existing gradient uniforms ...
uniform float u_grainIntensity;
uniform float u_grainSize;
uniform float u_grainSpeed;

// Pseudo-random for grain
float random2d(vec2 coord) {
    return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Soft light blend
float blendSoftLight(float base, float blend) {
    return (blend < 0.5)
        ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
        : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

void main() {
    // ... compute gradient color ...

    // Apply grain (same logic as our grain.frag)
    float grainCells = u_resolution.x / (u_grainSize * u_pixelRatio);
    float gridX = floor(uv.x * grainCells) / grainCells;
    float gridY = 1.0 - floor(uv.y * grainCells) / grainCells;
    float timeSpeed = floor(mod(u_time, 1.0) * u_grainSpeed);
    float grain = random2d(vec2(gridX + timeSpeed, gridY));
    grain = (grain - 0.5) * 0.1;

    // Soft light blend
    color.r = blendSoftLight(color.r, color.r + grain);
    color.g = blendSoftLight(color.g, color.g + grain);
    color.b = blendSoftLight(color.b, color.b + grain);
    color = mix(gradientColor, color, u_grainIntensity);

    fragColor = vec4(color, 1.0);
}
```

**Pros:**
- Single pass rendering (better performance)
- Matches Paper Design's architecture
- Simpler implementation
- No need for render targets

**Cons:**
- Less modular (can't swap effects independently)
- Grain logic duplicated if used elsewhere

#### Option 2: Manual Two-Pass System

Implement our own render-to-texture pipeline:

```tsx
// Would require WebGL framebuffer management
// NOT recommended - defeats simplicity of Paper Design
```

**Pros:**
- Keeps effects separate and reusable

**Cons:**
- Adds complexity Paper Design specifically avoids
- Need to manage framebuffers, render targets
- Larger bundle size

#### Option 3: Use Paper Design's Grain Gradient

Paper Design already has `grain-gradient.ts` with built-in noise/grain:

```tsx
import { GrainGradient } from '@paper-design/shaders-react';

<GrainGradient
  colors={['#414249', '#242733', '#3167a0', '#7599f5']}
  noise={0.3}  // Built-in grain!
  intensity={0.5}
  shape="wave"
  speed={1}
/>
```

**Pros:**
- Zero custom code needed
- Battle-tested implementation
- Matches their visual quality standards

**Cons:**
- May not match our exact visual style
- Less control over grain animation timing

### Recommendation

**Option 1 (Bake grain into gradient shader)** is recommended because:
1. Maintains our custom visual style
2. Single-pass is more performant
3. Aligns with Paper Design's architecture
4. Keeps bundle size minimal
5. We can precisely match our current grain effect's parameters

## Open Questions

1. Should we use `@paper-design/shaders-react` directly or copy just the `ShaderMount` class?
2. Do we need the full React wrapper or just the vanilla class?
3. Browser support for WebGL2 vs our current WebGL1?
4. License implications (PolyForm Shield - free for non-competing use)
5. **NEW**: Should we adopt Paper Design's `grain-gradient` shader or bake our custom grain into the gradient shader?

## Related Research

- `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md` - Previous shader extraction research
- `thoughts/shared/plans/2026-01-31-leeroy-webgl-animated-background.md` - Original WebGL background plan
