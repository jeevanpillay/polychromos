---
date: 2026-02-01T11:30:00+11:00
researcher: Claude Opus 4.5
topic: "GPGPU Mouse Displacement Effect for WebGL Background"
tags: [research, webgl, gpgpu, shader, mouse-interaction, displacement, three.js]
status: complete
created_at: 2026-02-01
confidence: high
sources_count: 1
---

# GPGPU Mouse Displacement Effect for WebGL Background

**Date**: 2026-02-01T11:30:00+11:00
**Topic**: Implementation of mouse-following displacement/warping effect on WebGL background
**Confidence**: High - Extracted from Leeroy.ca production code

## Research Question

How to implement the fluid background warping effect that follows mouse movement on Leeroy.ca?

## Executive Summary

The effect uses **GPGPU (General-Purpose GPU) computing** to simulate mouse influence across the screen. A separate render target stores displacement data that decays over time, creating a fluid trail effect. The main background shader then reads this data to distort its UV coordinates, creating the warping visual.

**Key Characteristics:**
- Mouse movement creates displacement in the direction of travel
- Effect spreads outward from mouse path with soft falloff
- Decays smoothly back to neutral when mouse stops
- Adds subtle brightness boost to displaced areas
- Creates organic, fluid-feeling interaction

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Each Frame                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Mouse Position Update                                       │
│      ├─ Track current mouse (normalized 0-1)                     │
│      └─ Store previous mouse position                            │
│                                                                  │
│   2. GPGPU Simulation Pass (renders to texture)                  │
│      ├─ Read previous frame's simulation texture                 │
│      ├─ Decay existing values toward neutral                     │
│      ├─ Calculate distance from each pixel to mouse trail        │
│      ├─ Add displacement in mouse movement direction             │
│      └─ Output: RGB texture where:                               │
│          R = X displacement (-0.5 to +0.5, stored as 0-1)        │
│          G = Y displacement (-0.5 to +0.5, stored as 0-1)        │
│          B = Intensity (0-1)                                     │
│                                                                  │
│   3. Main Render Pass                                            │
│      ├─ Background shader samples simulation texture             │
│      ├─ Displaces UV coordinates based on R,G values             │
│      ├─ Scales displacement by B (intensity)                     │
│      └─ Adds brightness boost based on intensity                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The Simulation Texture

The GPGPU pass outputs a texture where each pixel stores:

| Channel | Range | Meaning |
|---------|-------|---------|
| **R** | 0.0 - 1.0 | X displacement (0.5 = neutral, <0.5 = left, >0.5 = right) |
| **G** | 0.0 - 1.0 | Y displacement (0.5 = neutral, <0.5 = down, >0.5 = up) |
| **B** | 0.0 - 1.0 | Intensity/strength of displacement |
| **A** | 1.0 | Unused |

**Neutral state**: `rgba(0.5, 0.5, 0.0, 1.0)` = no displacement

---

## Extracted Shaders

### GPGPU Simulation Shader

This shader runs on a render target (e.g., 256x256 or 512x512) and tracks mouse influence:

```glsl
// Resolution defined by GPUComputationRenderer
// uniform vec2 resolution;

uniform vec2 uMouse;         // Current mouse position (0-1)
uniform vec2 uPrevMouse;     // Previous frame mouse position (0-1)
uniform float uDelta;        // Delta time in milliseconds
uniform float uMouseFactor;  // Strength multiplier (default: 1.0)

uniform sampler2D tPrevious; // Previous frame's simulation data

// Calculate minimum distance from point to line segment
float distanceToSegment(vec2 point, vec2 start, vec2 end) {
    vec2 lineVec = end - start;
    vec2 pointVec = point - start;
    float lineLen = length(lineVec);

    // Handle zero-length line (mouse didn't move)
    if (lineLen < 0.0001) {
        return length(pointVec);
    }

    vec2 lineUnitVec = lineVec / lineLen;
    float projLength = dot(pointVec, lineUnitVec);
    projLength = clamp(projLength, 0.0, lineLen);
    vec2 projPoint = start + lineUnitVec * projLength;

    return length(point - projPoint);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read previous frame's data
    vec4 data = texture2D(tPrevious, uv);

    // === DECAY ===
    // Gradually return to neutral (0.5 for R/G, 0.0 for B)
    // Decay rate: ~0.002 per ms = returns to neutral in ~250ms
    data.r = mix(data.r, 0.5, uDelta * 0.002);
    data.g = mix(data.g, 0.5, uDelta * 0.002);
    data.b = mix(data.b, 0.0, uDelta * 0.001);

    // === MOUSE INFLUENCE ===
    // Calculate mouse velocity
    float mouseVelocity = distance(uMouse, uPrevMouse);

    // Ignore large jumps (e.g., mouse entering canvas)
    mouseVelocity *= 1.0 - step(0.2, mouseVelocity);

    // Direction of mouse movement
    vec2 direction = vec2(0.0);
    if (mouseVelocity > 0.0001) {
        direction = normalize(uMouse - uPrevMouse);
    }

    // Distance from this pixel to the mouse trail (line segment)
    float distToTrail = distanceToSegment(uv, uPrevMouse, uMouse);

    // === INFLUENCE FALLOFF ===
    // Radius of influence: ~0.15 = 15% of screen width
    float radius = 0.15;
    float influence = 1.0 - smoothstep(0.0, radius, distToTrail);

    // Soften the falloff curve
    influence = pow(influence, 0.5);

    // Scale by mouse velocity and factor
    influence *= mouseVelocity * uMouseFactor;

    // === APPLY DISPLACEMENT ===
    // Add displacement in direction of mouse movement
    // Multiply by 2.0 to get range of -1 to +1, then stored as 0-1
    data.r += direction.x * 2.0 * influence;
    data.g += direction.y * 2.0 * influence;
    data.b += influence; // Intensity

    // Clamp to valid range
    data.r = clamp(data.r, 0.0, 1.0);
    data.g = clamp(data.g, 0.0, 1.0);
    data.b = clamp(data.b, 0.0, 1.0);

    gl_FragColor = data;
}
```

### Displacement Application (in Background Fragment Shader)

Add this to your existing `background.frag`:

```glsl
// Add these uniforms
uniform sampler2D uSimulationTexture;
uniform vec2 uDisplacementStrength;  // e.g., vec2(0.08, 0.08)
uniform float uCursorBrightness;     // e.g., 0.3

// In main(), after calculating base color but before gl_FragColor:

// Sample simulation texture
vec4 simData = texture2D(uSimulationTexture, vUv);

// Convert R,G from 0-1 to -0.5 to +0.5
vec2 displacement = simData.rg - 0.5;

// We need to displace the UV we use to sample the noise texture
// This creates the warping effect
// Note: Apply displacement BEFORE sampling noise, not after

// ... your existing noise sampling code, but with displaced UVs ...

// Add brightness boost based on displacement intensity
color.rgb += color.rgb * simData.b * uCursorBrightness;
```

---

## Integration with Current Implementation

### Current State

Your `webgl-background.tsx` currently:
- Creates a single fullscreen plane
- Uses ShaderMaterial with noise-based gradient
- Single render pass directly to screen

### Required Changes

1. **Add GPGPU system** for mouse simulation
2. **Track mouse position** with previous frame storage
3. **Modify fragment shader** to sample simulation texture and displace
4. **Two render passes** per frame (simulation + main)

---

## Implementation Options

### Option A: GPUComputationRenderer (Recommended)

Uses Three.js's built-in GPGPU helper from examples:

```typescript
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

// In component setup:
const gpuCompute = new GPUComputationRenderer(256, 256, renderer);

// Create initial texture (neutral state)
const initialTexture = gpuCompute.createTexture();
fillWithNeutral(initialTexture); // R=0.5, G=0.5, B=0, A=1

// Add simulation variable
const simVariable = gpuCompute.addVariable(
  'tPrevious',
  simulationShaderCode,
  initialTexture
);

// Set uniforms
simVariable.material.uniforms.uMouse = { value: new THREE.Vector2(0.5, 0.5) };
simVariable.material.uniforms.uPrevMouse = { value: new THREE.Vector2(0.5, 0.5) };
simVariable.material.uniforms.uDelta = { value: 16.67 };
simVariable.material.uniforms.uMouseFactor = { value: 1.0 };

// Self-dependency (reads previous frame)
gpuCompute.setVariableDependencies(simVariable, [simVariable]);

gpuCompute.init();

// In animation loop:
gpuCompute.compute();
const simTexture = gpuCompute.getCurrentRenderTarget(simVariable).texture;
backgroundMaterial.uniforms.uSimulationTexture.value = simTexture;
```

### Option B: Manual Ping-Pong Buffers

More control but more code:

```typescript
// Create two render targets for ping-pong
const rtA = new THREE.WebGLRenderTarget(256, 256, {
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
const rtB = rtA.clone();

let currentRT = rtA;
let previousRT = rtB;

// Simulation scene (separate from main)
const simScene = new THREE.Scene();
const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const simMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tPrevious: { value: null },
    uMouse: { value: new THREE.Vector2() },
    uPrevMouse: { value: new THREE.Vector2() },
    uDelta: { value: 16.67 },
    uMouseFactor: { value: 1.0 },
    resolution: { value: new THREE.Vector2(256, 256) },
  },
  vertexShader: simVertexShader,
  fragmentShader: simulationShaderCode,
});
const simPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
simScene.add(simPlane);

// In animation loop:
// 1. Update uniforms
simMaterial.uniforms.tPrevious.value = previousRT.texture;
simMaterial.uniforms.uMouse.value.copy(mouse);
simMaterial.uniforms.uPrevMouse.value.copy(prevMouse);

// 2. Render simulation to current RT
renderer.setRenderTarget(currentRT);
renderer.render(simScene, simCamera);
renderer.setRenderTarget(null);

// 3. Use in main shader
backgroundMaterial.uniforms.uSimulationTexture.value = currentRT.texture;

// 4. Swap buffers
[currentRT, previousRT] = [previousRT, currentRT];
```

---

## Modified Background Fragment Shader

Complete updated `background.frag` with displacement:

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

// Displacement uniforms
uniform sampler2D uSimulationTexture;
uniform vec2 uDisplacementStrength;
uniform float uCursorBrightness;

void main() {
    // === DISPLACEMENT ===
    // Sample simulation texture at current UV
    vec4 simData = texture2D(uSimulationTexture, vUv);

    // Convert from 0-1 to displacement offset
    vec2 displacement = (simData.rg - 0.5) * uDisplacementStrength * simData.b;

    // Apply displacement to UV for all subsequent sampling
    vec2 displacedUv = vUv + displacement;

    // === ASPECT RATIO CORRECTION ===
    vec2 nUv = (-.5 + displacedUv) * 2.;
    if (uResolution.x < uResolution.y) {
        nUv.x *= uResolution.x / uResolution.y;
    } else {
        nUv.y *= uResolution.y / uResolution.x;
    }
    nUv = nUv / 2. + .5;

    // === NOISE SAMPLING ===
    vec2 bUv = nUv * (uSize * 2.) + uOffset;
    vec2 nUv1 = bUv + uOffset + uTime * uSpeed;
    bUv.y -= .5;
    vec2 nUv2 = bUv + uOffset - uTime * uSpeed;

    float noise1 = texture2D(uNoiseTexture, nUv1).r;
    float noise2 = texture2D(uNoiseTexture, nUv2).r;
    float noise = clamp((noise1 + noise2) / 2., 0., 1.);

    vec2 nUv3 = bUv + noise * .5;
    noise = texture2D(uNoiseTexture, nUv3).r;

    // === COLOR GRADIENT ===
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

    // === CURSOR BRIGHTNESS BOOST ===
    color.rgb += color.rgb * simData.b * uCursorBrightness;

    gl_FragColor = vec4(color, 1.);
}
```

---

## Uniform Reference

### Simulation Shader Uniforms

| Uniform | Type | Default | Description |
|---------|------|---------|-------------|
| `uMouse` | `vec2` | `(0.5, 0.5)` | Current mouse position (normalized 0-1) |
| `uPrevMouse` | `vec2` | `(0.5, 0.5)` | Previous frame mouse position |
| `uDelta` | `float` | `16.67` | Delta time in milliseconds |
| `uMouseFactor` | `float` | `1.0` | Strength multiplier |
| `tPrevious` | `sampler2D` | - | Previous frame's simulation texture |
| `resolution` | `vec2` | `(256, 256)` | Simulation texture resolution |

### Background Shader Uniforms (New)

| Uniform | Type | Default | Description |
|---------|------|---------|-------------|
| `uSimulationTexture` | `sampler2D` | - | GPGPU simulation output |
| `uDisplacementStrength` | `vec2` | `(0.08, 0.08)` | How far UVs are displaced |
| `uCursorBrightness` | `float` | `0.3` | Brightness boost on displacement |

---

## Tuning Parameters

### Displacement Strength

```javascript
uDisplacementStrength: new THREE.Vector2(0.08, 0.08)
```

| Value | Effect |
|-------|--------|
| `0.02` | Very subtle, barely noticeable |
| `0.05` | Gentle displacement |
| `0.08` | **Default** - noticeable but not distracting |
| `0.15` | Strong displacement |
| `0.25` | Very dramatic warping |

### Influence Radius

In simulation shader:
```glsl
float radius = 0.15; // 15% of screen width
```

| Value | Effect |
|-------|--------|
| `0.05` | Tight cursor-sized effect |
| `0.10` | Small area of influence |
| `0.15` | **Default** - medium spread |
| `0.25` | Large, softer spread |
| `0.40` | Very large, ambient effect |

### Decay Rate

```glsl
data.r = mix(data.r, 0.5, uDelta * 0.002);
```

| Multiplier | Effect |
|------------|--------|
| `0.001` | Slow decay (~500ms to neutral) |
| `0.002` | **Default** (~250ms to neutral) |
| `0.004` | Fast decay (~125ms to neutral) |
| `0.008` | Very fast, snappy |

### Cursor Brightness

```javascript
uCursorBrightness: 0.3
```

| Value | Effect |
|-------|--------|
| `0.0` | No brightness boost |
| `0.2` | Subtle glow |
| `0.3` | **Default** - noticeable highlight |
| `0.5` | Strong glow |
| `1.0` | Very bright |

---

## Performance Considerations

### Simulation Resolution

| Resolution | Performance | Quality |
|------------|-------------|---------|
| `128x128` | Best | Slightly blocky displacement |
| `256x256` | Good | **Recommended** - smooth |
| `512x512` | Medium | Very smooth |
| `1024x1024` | Heavy | Unnecessary for this effect |

### Mobile Handling

The GPGPU system should be **disabled on mobile**:
- Touch interactions don't map well to this effect
- Extra render pass impacts battery life
- Current implementation already disables WebGL on mobile

---

## Files to Modify

1. **`apps/www/src/shaders/simulation.frag`** (new file)
   - GPGPU simulation shader

2. **`apps/www/src/shaders/background.frag`**
   - Add displacement uniforms
   - Apply displacement to UV sampling
   - Add brightness boost

3. **`apps/www/src/components/webgl-background.tsx`**
   - Add GPGPU system setup
   - Track mouse position
   - Add new uniforms
   - Update animation loop

---

## References

### Primary Source
- [Leeroy.ca](https://www.leeroy.ca/) - `app-b672fe9e.js`

### Three.js Resources
- [GPUComputationRenderer](https://threejs.org/examples/?q=gpgpu#webgl_gpgpu_birds)
- [WebGLRenderTarget](https://threejs.org/docs/#api/en/renderers/WebGLRenderTarget)

### Related Research
- `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md`

---

**Last Updated**: 2026-02-01
**Confidence Level**: High - Direct extraction from production code
**Next Steps**: Implement GPGPU system in webgl-background.tsx
