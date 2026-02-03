---
date: 2026-01-31T23:21:00+11:00
researcher: Claude Opus 4.5
topic: "Leeroy.ca WebGL Shader Extraction and Analysis"
tags: [research, web-analysis, webgl, shader, three.js, glsl, postprocessing]
status: complete
created_at: 2026-01-31
confidence: high
sources_count: 1
---

# Web Research: Leeroy.ca WebGL Shader Extraction

**Date**: 2026-01-31T23:21:00+11:00
**Topic**: Full extraction and analysis of WebGL shaders from leeroy.ca
**Confidence**: High - Direct extraction from source code

## Research Question

Extract the WebGL shader code from https://www.leeroy.ca/ for adaptation into our application.

## Executive Summary

The Leeroy website uses a sophisticated multi-layer WebGL effect built with Three.js and postprocessing library. The effect consists of:
1. **Main Background Shader** - A noise-based animated gradient with 4 color stops
2. **GPGPU Mouse Simulation** - Tracks mouse movement and creates displacement data
3. **Displacement Effect** - Distorts the background based on mouse interaction
4. **Film Grain Effect** - Adds subtle animated grain for texture

The effect creates a fluid, organic-looking animated background that responds to mouse movement with a "push" displacement effect.

## Technology Stack

- **Three.js** (WebGL2 context)
- **postprocessing** library (for effect composer)
- **GPGPU** (General-Purpose GPU computing for mouse simulation)
- **Custom GLSL Shaders**

## Extracted Shaders

### 1. Vertex Shader (Simple UV Pass-through)

```glsl
varying vec2 vUv;

void main() {
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  vUv = uv;
}
```

### 2. Main Background Fragment Shader

This is the primary visual effect - creates the animated noise-based gradient background.

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
uniform sampler2D uSimulationTexture;
uniform vec2 uResolution;
uniform float uColorMixer;
uniform float uMenuMode;
uniform float uAdditionalZoom;
uniform vec2 uAdditionalOffset;
uniform float uScrollOffset;

void main() {
    // Aspect ratio correction
    vec2 nUv = (-.5 + vUv) * 2.;
    if( uResolution.x < uResolution.y ) {
        nUv.x *= uResolution.x / uResolution.y;
    } else {
        nUv.y *= uResolution.y / uResolution.x;
    }
    nUv = nUv / 2. + .5;

    // Calculate zoom and offset
    float additionalZoom = uAdditionalZoom * (1. - uMenuMode);
    vec2 offset = uOffset + uAdditionalOffset * (1. - uMenuMode);
    offset.y -= uScrollOffset;

    // UV manipulation for noise sampling
    vec2 bUv = nUv * (uSize * 2. + additionalZoom) + offset * uMenuMode;
    vec2 nUv1 = bUv + offset * (1. - uMenuMode) + uTime * uSpeed;
    bUv.y -= .5;
    vec2 nUv2 = bUv + offset * (1. - uMenuMode) - uTime * uSpeed;

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
    noise = mix(noise, noise * 1.25 + .15, uMenuMode);

    if (noise < 0.25) {
        color = mix(uColor1, uColor2, noise / 0.25);
    } else if (noise < 0.5) {
        color = mix(uColor2, uColor3, (noise - 0.25) / 0.25);
    } else if (noise < 0.75) {
        color = mix(uColor3, uColor4, (noise - 0.5) / 0.25);
    } else {
        color = uColor4;
    }

    // Color mixing effect (darkens colors)
    vec3 alt = pow(color, vec3(2.));
    alt = alt * 1. - step(.01, color);
    color = mix(color, alt, uColorMixer);

    gl_FragColor = vec4(color, 1.);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
```

### 3. GPGPU Mouse Simulation Shader

This shader runs on a separate render target and tracks mouse movement to create displacement data.

```glsl
// Resolution is automatically defined by GPGPU system
// #DEFINE resolution vec2( 1024.0, 1024.0 )

uniform vec2 uMouse;
uniform vec2 uPrevMouse;
uniform float uTime;
uniform float uDelta;
uniform float uMouseFactor;

// Function to calculate the minimum distance from a point to a line segment
float distanceToSegment(vec2 point, vec2 start, vec2 end) {
    vec2 lineVec = end - start;
    vec2 pointVec = point - start;
    float lineLen = length(lineVec);
    vec2 lineUnitVec = lineVec / lineLen;
    float projLength = dot(pointVec, lineUnitVec);
    projLength = clamp(projLength, 0.0, lineLen);
    vec2 projPoint = start + lineUnitVec * projLength;
    return length(point - projPoint);
}

void main()
{
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 data = texture2D(tPosition, uv);

    // Decay over time (returns to neutral .5 values)
    data.r = mix(data.r, .5, uDelta * .002);
    data.g = mix(data.g, .5, uDelta * .002);
    data.b = mix(data.b, 0., uDelta * .001);

    float dist = distance(uMouse, uPrevMouse);
    dist *= 1. - step(.2, dist); // avoid big straight lines when entering the canvas

    vec2 direction = normalize(uMouse - uPrevMouse);

    // Calculate the distance to the line segment from last mouse position to current
    float distanceToLine = distanceToSegment(uv, uPrevMouse, uMouse);

    float lineInfluence = 1. - smoothstep(0., .2, distanceToLine);
    lineInfluence = clamp(lineInfluence, 0., 1.);
    lineInfluence = pow(lineInfluence, .5);

    float velocityFactor = dist * 1.;
    float influence = lineInfluence * velocityFactor * uMouseFactor;

    // Store direction and intensity in RGB channels
    data.r += direction.x * 2. * influence;
    data.g += direction.y * 2. * influence;
    data.b += influence;

    data.r = clamp(data.r, 0., 1.);
    data.g = clamp(data.g, 0., 1.);
    data.b = clamp(data.b, 0., 1.);

    gl_FragColor = data;
}
```

### 4. Displacement Post-Processing Effect

This effect reads the GPGPU simulation texture and displaces the main image.

```glsl
uniform sampler2D uSimulationTexture;
uniform vec2 uDisplacementStrength;
uniform float uCursorColoring;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 gpgpuColor = texture2D(uSimulationTexture, vUv);

    vec2 dUv = vec2(
        uv.x - (-0.5 + gpgpuColor.r) * uDisplacementStrength.x * gpgpuColor.b,
        uv.y - (-0.5 + gpgpuColor.g) * uDisplacementStrength.y * gpgpuColor.b
    );

    vec4 color = texture2D(inputBuffer, dUv);

    // Add brightness based on mouse interaction
    color.rgb += color.rgb * gpgpuColor.b * uCursorColoring;

    outputColor = vec4(color.rgb, 1.0);
}
```

### 5. Film Grain Post-Processing Effect

Adds subtle animated grain for texture.

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

## Default Uniform Values

| Uniform | Default Value | Description |
|---------|---------------|-------------|
| `uSize` | `0.2` | Noise texture scale |
| `uSpeed` | `0.02` | Animation speed |
| `uOffset` | `vec2(0.42, 0.6)` | UV offset for noise sampling |
| `uColor1` | `rgb(65, 66, 73)` | Darkest color (charcoal) |
| `uColor2` | `rgb(36, 39, 51)` | Dark blue-grey |
| `uColor3` | `rgb(49, 103, 160)` | Medium blue |
| `uColor4` | `rgb(117, 153, 245)` | Light blue/purple |
| `uColorMixer` | `0` | Controls color darkening |
| `uMenuMode` | `0` | Menu state toggle |
| `uIntensity` (grain) | `1.29` | Grain intensity |

## Required Assets

### Noise Texture
- **URL**: `https://www.leeroy.ca/dist/assets/3seamless-7f29af5e.png`
- **Type**: Seamless tileable noise texture
- **Wrap Mode**: `RepeatWrapping` (both S and T)

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Render Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                        │
│  │  GPGPU System   │ ◄── Mouse Position Updates             │
│  │  (Simulation)   │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼ uSimulationTexture                              │
│  ┌─────────────────┐                                        │
│  │  Main Scene     │                                        │
│  │  (Background    │ ◄── uNoiseTexture, uTime, uColors      │
│  │   Shader)       │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │  Effect         │                                        │
│  │  Composer       │                                        │
│  │  ├─ RenderPass  │                                        │
│  │  ├─ Displacement│ ◄── uSimulationTexture                 │
│  │  └─ Grain       │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ▼                                                 │
│      Final Output                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Adaptation Notes for Your App

### Dependencies Required
```bash
npm install three postprocessing
# or
pnpm add three postprocessing
```

### Key Implementation Steps

1. **Setup Three.js Scene**
   - Create WebGL2 renderer
   - Create fullscreen plane geometry
   - Apply custom ShaderMaterial

2. **Setup GPGPU**
   - Create separate render target for mouse simulation
   - Update mouse position uniforms on mousemove
   - Run simulation shader each frame

3. **Setup Effect Composer**
   - Add RenderPass for main scene
   - Add custom Effect for displacement
   - Add custom Effect for grain

4. **Animation Loop**
   - Update `uTime` uniform
   - Update mouse positions for GPGPU
   - Render GPGPU simulation
   - Render main scene through effect composer

### Simplified Version (Without Mouse Interaction)

If you only want the animated gradient without mouse effects:

```javascript
// Simplified setup without GPGPU
const material = new THREE.ShaderMaterial({
  vertexShader: vertexShader,
  fragmentShader: fragmentShader, // Main background shader
  uniforms: {
    uTime: { value: 0 },
    uNoiseTexture: { value: noiseTexture },
    uColor1: { value: new THREE.Color(0x414249) },
    uColor2: { value: new THREE.Color(0x242733) },
    uColor3: { value: new THREE.Color(0x3167a0) },
    uColor4: { value: new THREE.Color(0x7599f5) },
    uSize: { value: 0.2 },
    uOffset: { value: new THREE.Vector2(0.42, 0.6) },
    uSpeed: { value: 0.02 },
    uResolution: { value: new THREE.Vector2(width, height) },
    uColorMixer: { value: 0 },
    uMenuMode: { value: 0 },
    uAdditionalZoom: { value: 0 },
    uAdditionalOffset: { value: new THREE.Vector2(0, 0) },
    uScrollOffset: { value: 0 },
    uSimulationTexture: { value: null } // Not used in simplified version
  }
});
```

## Sources

### Primary Source
- [Leeroy.ca](https://www.leeroy.ca/) - Direct shader extraction from `app-b672fe9e.js`

### Libraries Used
- [Three.js](https://threejs.org/) - WebGL renderer
- [postprocessing](https://github.com/pmndrs/postprocessing) - Effect composer

---

**Last Updated**: 2026-01-31
**Confidence Level**: High - Direct extraction from production code
**Next Steps**: Implement shaders in your TanStack Start app with Three.js
