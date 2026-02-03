---
date: 2026-02-01T10:00:00+11:00
researcher: Claude Opus 4.5
topic: "Film Grain Post-Processing Effect Integration"
tags: [research, webgl, shader, postprocessing, film-grain, three.js]
status: complete
created_at: 2026-02-01
confidence: high
sources_count: 3
---

# Web Research: Film Grain Post-Processing Effect Integration

**Date**: 2026-02-01T10:00:00+11:00
**Topic**: Integration of film grain shader into existing WebGL background
**Confidence**: High - Based on extracted shader and Three.js postprocessing patterns

## Research Question

How to integrate the Leeroy.ca film grain post-processing effect into the existing WebGL animated background implementation.

## Executive Summary

The film grain effect from Leeroy.ca adds subtle animated noise/grain texture to the rendered output, creating a cinematic, textured feel. There are **two viable integration approaches**:

1. **Direct shader integration** - Merge grain logic directly into the existing fragment shader (simpler, better performance)
2. **Post-processing pipeline** - Use Three.js EffectComposer with a separate grain pass (more flexible, industry standard)

For the current implementation, **direct shader integration** is recommended due to:
- Single render pass (no additional render targets)
- Simpler resource management
- Lower memory overhead
- The background is already a fullscreen 2D effect

## Current Implementation State

**File**: `apps/www/src/components/webgl-background.tsx`

The current setup:
- Uses `THREE.ShaderMaterial` with custom vertex/fragment shaders
- Renders a fullscreen plane with orthographic camera
- Single render pass directly to screen
- No post-processing pipeline currently

## Extracted Film Grain Shader (from Leeroy.ca)

### Original Shader Code

```glsl
uniform float uXCount;
uniform float uYCount;
uniform float uIntensity;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;

  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n =
      h * h * h * h *
      vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

float random2d(vec2 coord) {
  return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float blendSoftLight(float base, float blend) {
  return (blend < 0.5)
             ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
             : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
  return vec3(blendSoftLight(base.r, blend.r), blendSoftLight(base.g, blend.g),
              blendSoftLight(base.b, blend.b));
}

vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
  return (blendSoftLight(base, blend) * opacity + base * (1.0 - opacity));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float gridX = floor(uv.x * uXCount) / uXCount;
  float gridY = 1.0 - floor(uv.y * uYCount) / uYCount;
  float t = mod(time, 1.);
  float timeSpeed = floor(t * 8.); // stepped animation (8fps feel)
  float grain = random2d(vec2(gridX + timeSpeed, gridY));

  grain -= grain / 2.;
  grain *= .1;

  vec3 resultColor = blendSoftLight(inputColor.rgb, inputColor.rgb + grain, uIntensity);

  outputColor = vec4(resultColor, 1.0);
}
```

### Default Uniform Values

| Uniform | Default Value | Description |
|---------|---------------|-------------|
| `uXCount` | ~1024 (derived from resolution) | Horizontal grain cell count |
| `uYCount` | ~1024 (derived from resolution) | Vertical grain cell count |
| `uIntensity` | `1.29` | Grain blend intensity |
| `time` | elapsed time | Animation time (provided by postprocessing lib) |

### Key Characteristics

1. **Grid-based grain**: Divides screen into cells for blocky/retro grain look
2. **Stepped animation**: Updates at ~8fps for film-like feel (not smooth 60fps)
3. **Soft light blending**: Film-accurate blend mode
4. **Low intensity**: Subtle effect, not overwhelming

## Integration Approach A: Direct Shader Integration (Recommended)

### Overview

Merge the grain calculation directly into `background.frag`, applying grain as the final step before output.

### Advantages

- Single render pass (no performance overhead)
- No additional dependencies
- Simpler resource management
- No render targets or frame buffers
- Easier to maintain

### Disadvantages

- Less modular (grain tied to background shader)
- Can't easily toggle grain independently
- Harder to adjust blend mode without shader recompile

### Implementation

**Modified Fragment Shader** (`background.frag`):

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

// Grain uniforms
uniform float uGrainIntensity;
uniform float uGrainSize;

// Grain helper functions
float random2d(vec2 coord) {
    return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

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

vec3 applyGrain(vec3 color, vec2 uv, float time) {
    // Grid-based grain (blocky/retro look)
    float grainCells = uResolution.x / uGrainSize;
    float gridX = floor(uv.x * grainCells) / grainCells;
    float gridY = 1.0 - floor(uv.y * grainCells) / grainCells;

    // Stepped animation at ~8fps for film-like feel
    float timeSpeed = floor(mod(time, 1.0) * 8.0);

    // Generate grain value
    float grain = random2d(vec2(gridX + timeSpeed, gridY));
    grain -= 0.5; // Center around 0
    grain *= 0.1; // Reduce intensity

    // Apply soft light blend
    return blendSoftLight(color, color + grain, uGrainIntensity);
}

void main() {
    // === EXISTING GRADIENT CODE ===

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

    // Sample noise texture
    float noise1 = texture2D(uNoiseTexture, nUv1).r;
    float noise2 = texture2D(uNoiseTexture, nUv2).r;
    float noise = clamp((noise1 + noise2) / 2., 0., 1.);

    // Third noise sample
    vec2 nUv3 = bUv + noise * .5;
    noise = texture2D(uNoiseTexture, nUv3).r;

    // Color gradient
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

    // === APPLY GRAIN ===
    color = applyGrain(color, vUv, uTime);

    gl_FragColor = vec4(color, 1.);
}
```

### New Uniforms Required

Add to `webgl-background.tsx`:

```typescript
const GRAIN_SETTINGS = {
  intensity: 1.29,  // How strong the grain effect is (0-2)
  size: 2.0,        // Grain cell size in pixels (higher = blockier)
};

// In material uniforms:
uniforms: {
  // ... existing uniforms
  uGrainIntensity: { value: GRAIN_SETTINGS.intensity },
  uGrainSize: { value: GRAIN_SETTINGS.size },
}
```

## Integration Approach B: Post-Processing Pipeline

### Overview

Use Three.js `EffectComposer` with separate render passes. Renders background to texture, then applies grain as second pass.

### Advantages

- Modular (grain is separate effect)
- Can easily toggle/adjust grain
- Standard pattern for complex effects
- Can add more effects later (blur, bloom, etc.)

### Disadvantages

- Additional render pass (slight performance cost)
- Requires `postprocessing` library (~20KB gzipped)
- More complex setup
- Additional render targets consume GPU memory

### Implementation Outline

```typescript
import { EffectComposer, RenderPass, EffectPass, Effect } from 'postprocessing';

// Custom grain effect
class GrainEffect extends Effect {
  constructor({ intensity = 1.29, size = 2.0 } = {}) {
    super('GrainEffect', grainShader, {
      uniforms: new Map([
        ['uGrainIntensity', new THREE.Uniform(intensity)],
        ['uGrainSize', new THREE.Uniform(size)],
        ['uResolution', new THREE.Uniform(new THREE.Vector2())],
      ]),
    });
  }
}

// Setup
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new GrainEffect()));

// Animation loop
composer.render(delta);  // Instead of renderer.render()
```

### Dependencies

```json
{
  "dependencies": {
    "postprocessing": "^6.36.0"
  }
}
```

## Performance Comparison

| Approach | Render Passes | Memory | Bundle Size | Complexity |
|----------|--------------|--------|-------------|------------|
| Direct Integration | 1 | Low | +0KB | Low |
| Post-Processing | 2+ | Medium | +20KB | Medium |

For a simple grain effect on an already-fullscreen shader, **direct integration** has no downsides.

## Grain Effect Customization Options

### 1. Intensity Control

```glsl
uniform float uGrainIntensity; // 0.0 = no grain, 1.0 = normal, 2.0 = heavy
```

Typical values:
- `0.3` - Very subtle, barely noticeable
- `0.8` - Light grain, adds texture without distraction
- `1.29` - Leeroy default, noticeable but not overwhelming
- `2.0` - Heavy grain, very visible

### 2. Grain Size (Cell Size)

```glsl
uniform float uGrainSize; // Pixels per grain cell
```

Typical values:
- `1.0` - Per-pixel grain (smooth noise)
- `2.0` - 2x2 pixel cells (default, slight blockiness)
- `4.0` - 4x4 pixel cells (retro/VHS look)
- `8.0` - 8x8 pixel cells (very blocky, stylized)

### 3. Animation Speed

```glsl
float timeSpeed = floor(mod(time, 1.0) * 8.0); // 8 = updates per second
```

Values:
- `4.0` - Slower, more cinematic
- `8.0` - Default, film-like
- `15.0` - Faster, more energetic
- `30.0` - Smooth animation (less film-like)

### 4. Monochrome vs Color Grain

**Monochrome** (current): Same grain value for R, G, B
```glsl
float grain = random2d(...);
color = blendSoftLight(color, color + grain, intensity);
```

**Color grain**: Different values per channel
```glsl
vec3 grainColor = vec3(
    random2d(vec2(gridX + timeSpeed, gridY)),
    random2d(vec2(gridX + timeSpeed + 1.0, gridY)),
    random2d(vec2(gridX + timeSpeed + 2.0, gridY))
);
grainColor = (grainColor - 0.5) * 0.1;
color = blendSoftLight(color, color + grainColor, intensity);
```

## Reduced Motion Considerations

For users with `prefers-reduced-motion: reduce`:

1. **Freeze grain**: Use fixed time value instead of animated
2. **Reduce intensity**: Lower `uGrainIntensity` to 0.3
3. **Disable entirely**: Set `uGrainIntensity` to 0

```typescript
// In animation loop
const grainTime = prefersReducedMotion ? 0 : clock.getElapsedTime();
material.uniforms.uGrainTime.value = grainTime;
```

## Alternative Grain Algorithms

### 1. Smooth Simplex Noise (more organic)

```glsl
// Uses simplex noise instead of random2d
// Produces smoother, more film-like grain
float grain = snoise(vec3(uv * 100.0, time * 8.0)) * 0.1;
```

### 2. Blue Noise Dithering (higher quality)

```glsl
// Uses pre-computed blue noise texture
// More visually pleasing distribution
uniform sampler2D uBlueNoise;
float grain = texture2D(uBlueNoise, uv * 4.0 + time).r - 0.5;
```

### 3. Film Emulation (most realistic)

```glsl
// Combines multiple noise frequencies
// Mimics actual film grain characteristics
float grain = (
    random2d(uv * 512.0 + time) * 0.6 +
    random2d(uv * 256.0 + time * 0.5) * 0.3 +
    random2d(uv * 128.0 + time * 0.25) * 0.1
) - 0.5;
```

## Recommended Implementation

For the current WebGL background:

1. **Use direct shader integration** (Approach A)
2. **Start with Leeroy defaults**: intensity 1.29, size 2.0
3. **Add uniform controls** for runtime adjustment
4. **Respect reduced motion** preference

### Estimated Changes

| File | Changes |
|------|---------|
| `background.frag` | Add grain functions + apply after gradient |
| `webgl-background.tsx` | Add 2 new uniforms + handle reduced motion for grain |

### Performance Impact

- **CPU**: Negligible (uniforms only)
- **GPU**: ~2% additional fragment shader cost
- **Memory**: None (no new textures or buffers)

## Sources

### Primary Source
- [Leeroy.ca Shader Extraction](./2026-01-31-leeroy-webgl-shader-extraction.md) - Original grain shader code

### Technical References
- [Three.js ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial)
- [postprocessing library](https://github.com/pmndrs/postprocessing)
- [Film Grain in Games (GDC)](https://www.gdcvault.com/play/1023507/Technical-Art-of-Uncharted-4) - Film grain techniques

### Related Research
- [Soft Light Blend Mode](https://en.wikipedia.org/wiki/Blend_modes#Soft_Light)
- [Simplex Noise](https://en.wikipedia.org/wiki/Simplex_noise)

---

**Last Updated**: 2026-02-01
**Confidence Level**: High - Based on extracted production code
**Next Steps**: Implement direct shader integration (Approach A)
