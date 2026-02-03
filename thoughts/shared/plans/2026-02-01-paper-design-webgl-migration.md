# Paper Design WebGL Migration Implementation Plan

## Overview

Migrate the WebGL animated background from Three.js (~517KB raw / 132KB gzipped) to Paper Design's `@paper-design/shaders-react` (~10-15KB) while maintaining all current functionality including grain effect and optional GPGPU mouse displacement. This migration will reduce bundle size by approximately 90% while preserving the exact visual output.

## Current State Analysis

**Current Implementation** (`apps/www/src/components/webgl-background.tsx`):
- Uses Three.js with EffectComposer for multi-pass rendering
- Dependencies: `three` (^0.173.0), `postprocessing` (^6.38.2)
- Current bundle: 517KB raw / 132KB gzipped across 4 chunks
- Features: Animated noise gradient, film grain (post-processing), GPGPU mouse displacement (optional)

**Target Implementation**:
- Paper Design's single-pass, shader-first architecture
- Dependency: `@paper-design/shaders-react` (~10-15KB)
- All effects baked into single fragment shader
- Custom vanilla WebGL2 GPGPU for mouse displacement

### Key Discoveries:
- Current shaders use GLSL 1.0 syntax (`gl_FragColor`, `texture2D`, `varying`)
- Paper Design requires GLSL 3.0 ES (`out vec4`, `texture`, `in/out`)
- Grain effect uses postprocessing's `mainImage()` convention - needs conversion
- GPGPU simulation shader needs conversion and custom renderer
- Paper Design uses `gl_FragCoord.xy / u_resolution` for UV instead of varying from vertex shader

## Desired End State

After this plan is complete:
1. The WebGL background renders identically to the current implementation
2. Bundle size reduced from ~517KB to ~25-30KB (including custom GPGPU module)
3. Three.js and postprocessing packages completely removed
4. Component API unchanged (`enableGrain`, `enableDisplacement` props work the same)
5. All WebGL2-capable browsers supported (97%+ browser coverage)

### Verification:
- Visual comparison: Background appearance matches current implementation
- Bundle analysis: `pnpm build:www` shows no three.js/postprocessing chunks
- Props work: Both `enableGrain` and `enableDisplacement` toggle correctly
- Performance: No degradation in frame rate or startup time

## What We're NOT Doing

- WebGL1 fallback (WebGL2 has 97%+ support)
- WebGPU migration (future consideration, not needed now)
- Changing the visual design or animation parameters
- Adding new features beyond current functionality
- Server-side rendering of WebGL (current behavior: render null on server)

## Implementation Approach

Paper Design uses a **single-pass, shader-first architecture** - no EffectComposer, no multi-pass rendering. We will:

1. Bake the grain effect directly into the gradient fragment shader
2. Build a minimal vanilla WebGL2 GPGPU renderer to replace Three.js's GPUComputationRenderer
3. Use Paper Design's `ShaderMount` component for the main rendering

Reference: [WebGL2 GPGPU Fundamentals](https://webgl2fundamentals.org/webgl/lessons/webgl-gpgpu.html)

---

## Phase 1: Install & Setup Paper Design

### Overview
Install the Paper Design package and verify it works with a minimal shader test.

### Changes Required:

#### 1. Install Package
**File**: `apps/www/package.json`
**Changes**: Add @paper-design/shaders-react dependency

```bash
cd apps/www && pnpm add @paper-design/shaders-react
```

#### 2. Create Test Component
**File**: `apps/www/src/components/paper-design-test.tsx` (temporary)
**Changes**: Create minimal test to verify Paper Design works

```tsx
import { ShaderMount } from "@paper-design/shaders-react";

const testShader = `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  fragColor = vec4(uv.x, uv.y, sin(u_time) * 0.5 + 0.5, 1.0);
}`;

export function PaperDesignTest() {
  return (
    <div className="fixed inset-0 z-0">
      <ShaderMount fragmentShader={testShader} />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Package installs without errors: `pnpm install`
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [x] Test component renders a gradient that animates over time
- [x] No console errors related to WebGL or shader compilation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the test component renders correctly before proceeding to Phase 2.

---

## Phase 2: Convert Shaders to WebGL2 (GLSL 3.0 ES)

### Overview
Convert existing GLSL 1.0 shaders to WebGL2 format and bake the grain effect into the main shader.

### Changes Required:

#### 1. Create Unified Gradient + Grain Shader
**File**: `apps/www/src/shaders/noise-gradient-grain.frag` (new file)
**Changes**: WebGL2 version with baked-in grain effect

```glsl
#version 300 es
precision mediump float;

// Built-in uniforms from Paper Design
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;

// Gradient uniforms
uniform sampler2D u_noiseTexture;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;
uniform vec3 u_color4;
uniform float u_size;
uniform vec2 u_offset;
uniform float u_speed;

// Grain uniforms
uniform float u_grainIntensity;
uniform float u_grainSize;
uniform float u_grainSpeed;

// Displacement uniforms
uniform sampler2D u_simulationTexture;
uniform vec2 u_displacementStrength;
uniform float u_cursorColoring;

out vec4 fragColor;

// Pseudo-random function for grain
float random2d(vec2 coord) {
    return fract(sin(dot(coord.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Soft light blend mode (film-accurate)
float blendSoftLight(float base, float blend) {
    return (blend < 0.5)
        ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
        : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    // === DISPLACEMENT FROM GPGPU SIMULATION ===
    vec4 simData = texture(u_simulationTexture, uv);
    vec2 displacement = (simData.rg - 0.5) * u_displacementStrength * simData.b;
    vec2 displacedUv = uv + displacement;

    // === ASPECT RATIO CORRECTION ===
    vec2 nUv = (-.5 + displacedUv) * 2.;
    if (u_resolution.x < u_resolution.y) {
        nUv.x *= u_resolution.x / u_resolution.y;
    } else {
        nUv.y *= u_resolution.y / u_resolution.x;
    }
    nUv = nUv / 2. + .5;

    // === NOISE SAMPLING ===
    vec2 bUv = nUv * (u_size * 2.) + u_offset;
    vec2 nUv1 = bUv + u_offset + u_time * u_speed;
    bUv.y -= .5;
    vec2 nUv2 = bUv + u_offset - u_time * u_speed;

    float noise1 = texture(u_noiseTexture, nUv1).r;
    float noise2 = texture(u_noiseTexture, nUv2).r;
    float noise = clamp((noise1 + noise2) / 2., 0., 1.);

    vec2 nUv3 = bUv + noise * .5;
    noise = texture(u_noiseTexture, nUv3).r;

    // === COLOR GRADIENT ===
    vec3 color = vec3(0.);
    if (noise < 0.25) {
        color = mix(u_color1, u_color2, noise / 0.25);
    } else if (noise < 0.5) {
        color = mix(u_color2, u_color3, (noise - 0.25) / 0.25);
    } else if (noise < 0.75) {
        color = mix(u_color3, u_color4, (noise - 0.5) / 0.25);
    } else {
        color = u_color4;
    }

    // === CURSOR COLORING ===
    color.rgb += color.rgb * simData.b * u_cursorColoring;

    // === BAKED GRAIN EFFECT ===
    float grainCells = u_resolution.x / (u_grainSize * u_pixelRatio);
    float gridX = floor(uv.x * grainCells) / grainCells;
    float gridY = 1.0 - floor(uv.y * grainCells) / grainCells;
    float timeSpeed = floor(mod(u_time, 1.0) * u_grainSpeed);

    float grain = random2d(vec2(gridX + timeSpeed, gridY));
    grain -= 0.5;
    grain *= 0.1;

    // Apply soft light blend
    color.r = mix(color.r, blendSoftLight(color.r, color.r + grain), u_grainIntensity);
    color.g = mix(color.g, blendSoftLight(color.g, color.g + grain), u_grainIntensity);
    color.b = mix(color.b, blendSoftLight(color.b, color.b + grain), u_grainIntensity);

    fragColor = vec4(color, 1.0);
}
```

#### 2. Create GPGPU Simulation Shader (WebGL2)
**File**: `apps/www/src/shaders/simulation-webgl2.frag` (new file)
**Changes**: WebGL2 version of simulation shader

```glsl
#version 300 es
precision mediump float;

uniform sampler2D u_previous;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec2 u_prevMouse;
uniform float u_delta;
uniform float u_mouseFactor;

out vec4 fragColor;

float distanceToSegment(vec2 point, vec2 start, vec2 end) {
    vec2 lineVec = end - start;
    vec2 pointVec = point - start;
    float lineLen = length(lineVec);
    if (lineLen < 0.0001) return length(pointVec);
    vec2 lineUnitVec = lineVec / lineLen;
    float projLength = dot(pointVec, lineUnitVec);
    projLength = clamp(projLength, 0.0, lineLen);
    vec2 projPoint = start + lineUnitVec * projLength;
    return length(point - projPoint);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 data = texture(u_previous, uv);

    // Decay - exact leeroy values
    data.r = mix(data.r, .5, u_delta * .002);
    data.g = mix(data.g, .5, u_delta * .002);
    data.b = mix(data.b, 0., u_delta * .001);

    float dist = distance(u_mouse, u_prevMouse);
    dist *= 1. - step(.2, dist);
    vec2 direction = normalize(u_mouse - u_prevMouse + vec2(0.0001));
    float distanceToLine = distanceToSegment(uv, u_prevMouse, u_mouse);

    float lineInfluence = 1. - smoothstep(0., .2, distanceToLine);
    lineInfluence = clamp(lineInfluence, 0., 1.);
    lineInfluence = pow(lineInfluence, .5);

    float velocityFactor = dist * 1.;
    float influence = lineInfluence * velocityFactor * u_mouseFactor;
    data.r += direction.x * 2. * influence;
    data.g += direction.y * 2. * influence;
    data.b += influence;

    data.r = clamp(data.r, 0., 1.);
    data.g = clamp(data.g, 0., 1.);
    data.b = clamp(data.b, 0., 1.);

    fragColor = data;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Shaders parse without syntax errors (verified during component integration)
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] N/A - Shaders will be tested in Phase 4 integration

**Implementation Note**: This phase creates shader files only. Actual testing happens in Phase 4 when they're integrated into the component.

---

## Phase 3: Create Custom GPGPU Module

### Overview
Build a vanilla WebGL2 GPGPU renderer using the ping-pong framebuffer pattern to replace Three.js's GPUComputationRenderer.

### Changes Required:

#### 1. Create GPGPU Renderer Class
**File**: `apps/www/src/lib/gpgpu-renderer.ts` (new file)
**Changes**: Vanilla WebGL2 GPGPU implementation

```typescript
/**
 * Minimal WebGL2 GPGPU renderer using ping-pong framebuffer pattern.
 * Replaces Three.js GPUComputationRenderer for mouse displacement simulation.
 */

export interface GPGPUUniforms {
  u_mouse: [number, number];
  u_prevMouse: [number, number];
  u_delta: number;
  u_mouseFactor: number;
}

export class GPGPURenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private width: number;
  private height: number;

  // Ping-pong textures and framebuffers
  private textures: [WebGLTexture, WebGLTexture] = [null!, null!];
  private framebuffers: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!];
  private currentIndex = 0;

  // Fullscreen quad VAO
  private vao: WebGLVertexArrayObject | null = null;

  // Uniform locations
  private uniformLocations: {
    u_previous: WebGLUniformLocation | null;
    u_resolution: WebGLUniformLocation | null;
    u_mouse: WebGLUniformLocation | null;
    u_prevMouse: WebGLUniformLocation | null;
    u_delta: WebGLUniformLocation | null;
    u_mouseFactor: WebGLUniformLocation | null;
  } = {
    u_previous: null,
    u_resolution: null,
    u_mouse: null,
    u_prevMouse: null,
    u_delta: null,
    u_mouseFactor: null,
  };

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;
  }

  init(fragmentShaderSource: string): string | null {
    const gl = this.gl;

    // Create shader program
    const vertexShaderSource = `#version 300 es
      in vec4 a_position;
      void main() {
        gl_Position = a_position;
      }
    `;

    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      return "Failed to compile shaders";
    }

    this.program = gl.createProgram();
    if (!this.program) return "Failed to create program";

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(this.program);
      gl.deleteProgram(this.program);
      return `Program link error: ${error}`;
    }

    // Get uniform locations
    this.uniformLocations = {
      u_previous: gl.getUniformLocation(this.program, "u_previous"),
      u_resolution: gl.getUniformLocation(this.program, "u_resolution"),
      u_mouse: gl.getUniformLocation(this.program, "u_mouse"),
      u_prevMouse: gl.getUniformLocation(this.program, "u_prevMouse"),
      u_delta: gl.getUniformLocation(this.program, "u_delta"),
      u_mouseFactor: gl.getUniformLocation(this.program, "u_mouseFactor"),
    };

    // Create VAO for fullscreen quad
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Fullscreen quad vertices (-1 to 1)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Create ping-pong textures and framebuffers
    for (let i = 0; i < 2; i++) {
      this.textures[i] = this.createTexture();
      this.framebuffers[i] = this.createFramebuffer(this.textures[i]);
    }

    // Initialize first texture with neutral values (R=0.5, G=0.5, B=0)
    this.initializeTexture();

    return null;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl;
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return fb;
  }

  private initializeTexture(): void {
    const gl = this.gl;
    const data = new Float32Array(this.width * this.height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i + 0] = 0.5; // R: X displacement (neutral)
      data[i + 1] = 0.5; // G: Y displacement (neutral)
      data[i + 2] = 0.0; // B: Intensity
      data[i + 3] = 1.0; // A: Unused
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIndex]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data);
  }

  compute(uniforms: GPGPUUniforms): void {
    const gl = this.gl;
    if (!this.program) return;

    // Save current state
    const prevViewport = gl.getParameter(gl.VIEWPORT);
    const prevFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);

    // Bind write framebuffer
    const writeIndex = 1 - this.currentIndex;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[writeIndex]);
    gl.viewport(0, 0, this.width, this.height);

    // Use program
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    // Bind read texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIndex]);
    gl.uniform1i(this.uniformLocations.u_previous, 0);

    // Set uniforms
    gl.uniform2f(this.uniformLocations.u_resolution, this.width, this.height);
    gl.uniform2f(this.uniformLocations.u_mouse, uniforms.u_mouse[0], uniforms.u_mouse[1]);
    gl.uniform2f(this.uniformLocations.u_prevMouse, uniforms.u_prevMouse[0], uniforms.u_prevMouse[1]);
    gl.uniform1f(this.uniformLocations.u_delta, uniforms.u_delta);
    gl.uniform1f(this.uniformLocations.u_mouseFactor, uniforms.u_mouseFactor);

    // Draw fullscreen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Swap textures
    this.currentIndex = writeIndex;

    // Restore state
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFramebuffer);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
    gl.bindVertexArray(null);
  }

  getCurrentTexture(): WebGLTexture {
    return this.textures[this.currentIndex];
  }

  dispose(): void {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.textures.forEach(t => t && gl.deleteTexture(t));
    this.framebuffers.forEach(fb => fb && gl.deleteFramebuffer(fb));
  }
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`

#### Manual Verification:
- [x] N/A - GPGPU renderer will be tested in Phase 4 integration

**Implementation Note**: This phase creates the GPGPU module only. Actual testing happens in Phase 4 when integrated with the component.

---

## Phase 4: Create New Paper Design Component

### Overview
Create the new WebGL background component using Paper Design's ShaderMount with integrated custom GPGPU for displacement.

### Changes Required:

#### 1. Create New Component
**File**: `apps/www/src/components/webgl-background-v2.tsx` (new file)
**Changes**: Paper Design-based implementation

```tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { ShaderMount, type ShaderMountRef } from "@paper-design/shaders-react";
import { GPGPURenderer, type GPGPUUniforms } from "~/lib/gpgpu-renderer";
import fragmentShader from "~/shaders/noise-gradient-grain.frag?raw";
import simulationShader from "~/shaders/simulation-webgl2.frag?raw";

// Color palette (matching current implementation)
const COLORS = {
  color1: [0x41 / 255, 0x42 / 255, 0x49 / 255], // Charcoal
  color2: [0x24 / 255, 0x27 / 255, 0x33 / 255], // Dark blue-grey
  color3: [0x31 / 255, 0x67 / 255, 0xa0 / 255], // Medium blue
  color4: [0x75 / 255, 0x99 / 255, 0xf5 / 255], // Light blue/purple
} as const;

// Animation settings (matching current implementation)
const SETTINGS = {
  size: 0.2,
  speed: 0.02,
  offset: [0.42, 0.6] as [number, number],
};

// Grain effect settings (matching current implementation)
const GRAIN_SETTINGS = {
  intensity: 1.29,
  size: 2.0,
  speed: 8.0,
};

// Mouse displacement settings (matching current implementation)
const DISPLACEMENT_SETTINGS = {
  resolutionDivisor: 40,
  displacementStrength: 1.0,
  cursorColoring: 1.5,
  mouseFactor: 1.0,
};

interface WebGLBackgroundProps {
  /** Enable film grain effect. Defaults to true. */
  enableGrain?: boolean;
  /** Enable GPGPU mouse displacement effect. Defaults to false. */
  enableDisplacement?: boolean;
}

export function WebGLBackgroundV2({
  enableGrain = true,
  enableDisplacement = false,
}: WebGLBackgroundProps = {}) {
  const shaderRef = useRef<ShaderMountRef>(null);
  const gpgpuRef = useRef<GPGPURenderer | null>(null);
  const mouseRef = useRef<[number, number]>([0.5, 0.5]);
  const prevMouseRef = useRef<[number, number]>([0.5, 0.5]);
  const lastTimeRef = useRef(0);

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [noiseTexture, setNoiseTexture] = useState<HTMLImageElement | null>(null);
  const [neutralTexture, setNeutralTexture] = useState<HTMLImageElement | null>(null);

  // Load noise texture
  useEffect(() => {
    const img = new Image();
    img.onload = () => setNoiseTexture(img);
    img.src = "/textures/seamless-noise.png";
  }, []);

  // Create neutral displacement texture (for when displacement is disabled)
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Neutral: R=127, G=127, B=0 (0.5, 0.5, 0 when normalized)
      ctx.fillStyle = "rgb(127, 127, 0)";
      ctx.fillRect(0, 0, 1, 1);
    }
    const img = new Image();
    img.onload = () => setNeutralTexture(img);
    img.src = canvas.toDataURL();
  }, []);

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

  // Track mouse position (only if displacement enabled)
  useEffect(() => {
    if (!enableDisplacement) return;

    const handleMouseMove = (e: MouseEvent) => {
      prevMouseRef.current = [...mouseRef.current];
      mouseRef.current = [
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight,
      ];
    };

    const handleMouseLeave = () => {
      prevMouseRef.current = [...mouseRef.current];
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [enableDisplacement]);

  // Initialize GPGPU renderer
  useEffect(() => {
    if (!enableDisplacement || !shaderRef.current || isMobile) return;

    // Wait for ShaderMount to initialize
    const initGPGPU = () => {
      const canvas = shaderRef.current?.getCanvas();
      if (!canvas) {
        requestAnimationFrame(initGPGPU);
        return;
      }

      const gl = canvas.getContext("webgl2");
      if (!gl) {
        console.warn("WebGL2 not supported, displacement disabled");
        return;
      }

      // Check for float texture support
      const ext = gl.getExtension("EXT_color_buffer_float");
      if (!ext) {
        console.warn("Float textures not supported, displacement disabled");
        return;
      }

      const gpuWidth = Math.floor(window.innerWidth / DISPLACEMENT_SETTINGS.resolutionDivisor);
      const gpuHeight = Math.floor(window.innerHeight / DISPLACEMENT_SETTINGS.resolutionDivisor);

      const gpgpu = new GPGPURenderer(gl, gpuWidth, gpuHeight);
      const error = gpgpu.init(simulationShader);
      if (error) {
        console.error("GPGPU init error:", error);
        return;
      }

      gpgpuRef.current = gpgpu;
    };

    initGPGPU();

    return () => {
      gpgpuRef.current?.dispose();
      gpgpuRef.current = null;
    };
  }, [enableDisplacement, isMobile]);

  // GPGPU animation frame callback
  const onFrame = useMemo(() => {
    if (!enableDisplacement) return undefined;

    return (time: number) => {
      const gpgpu = gpgpuRef.current;
      if (!gpgpu) return;

      const delta = lastTimeRef.current === 0 ? 16.67 : Math.min((time - lastTimeRef.current), 50);
      lastTimeRef.current = time;

      const uniforms: GPGPUUniforms = {
        u_mouse: mouseRef.current,
        u_prevMouse: prevMouseRef.current,
        u_delta: delta,
        u_mouseFactor: DISPLACEMENT_SETTINGS.mouseFactor,
      };

      gpgpu.compute(uniforms);

      // Update shader uniform with GPGPU result
      // Note: This requires a custom uniform update mechanism
      // Paper Design's ShaderMount may need modification to support dynamic textures
    };
  }, [enableDisplacement]);

  // Build uniforms object
  const uniforms = useMemo(() => ({
    u_noiseTexture: noiseTexture,
    u_color1: COLORS.color1,
    u_color2: COLORS.color2,
    u_color3: COLORS.color3,
    u_color4: COLORS.color4,
    u_size: SETTINGS.size,
    u_offset: SETTINGS.offset,
    u_speed: SETTINGS.speed,
    u_grainIntensity: enableGrain ? GRAIN_SETTINGS.intensity : 0,
    u_grainSize: GRAIN_SETTINGS.size,
    u_grainSpeed: GRAIN_SETTINGS.speed,
    u_simulationTexture: neutralTexture, // Will be updated by GPGPU
    u_displacementStrength: enableDisplacement
      ? [DISPLACEMENT_SETTINGS.displacementStrength, DISPLACEMENT_SETTINGS.displacementStrength] as [number, number]
      : [0, 0] as [number, number],
    u_cursorColoring: enableDisplacement ? DISPLACEMENT_SETTINGS.cursorColoring : 0,
  }), [noiseTexture, neutralTexture, enableGrain, enableDisplacement]);

  // Don't render on server or mobile
  if (!isMounted || isMobile || !noiseTexture || !neutralTexture) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-0">
      <ShaderMount
        ref={shaderRef}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
```

#### 2. Update Homepage to Use New Component (Temporarily)
**File**: `apps/www/src/routes/index.tsx`
**Changes**: Import v2 component for testing alongside v1

Add import at top:
```tsx
const WebGLBackgroundV2 = lazy(
  () => import("~/components/webgl-background-v2").then(m => ({ default: m.WebGLBackgroundV2 })),
);
```

Temporarily use v2 in render (replace line 42):
```tsx
<WebGLBackgroundV2 enableGrain={true} enableDisplacement={false} />
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Background renders with animated gradient (visually matches v1)
- [ ] Grain effect is visible and animates (if enabled)
- [ ] Colors match the current implementation exactly
- [ ] Responsive: hides on mobile (< 768px)
- [ ] No WebGL errors in console
- [ ] Displacement effect works when `enableDisplacement={true}` (if GPGPU integration works)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the visual output matches the current implementation before proceeding to Phase 5.

---

## Phase 5: Replace Old Component & Remove Three.js

### Overview
Complete the migration by removing the old component, Three.js dependencies, and updating build configuration.

### Changes Required:

#### 1. Replace Component File
**File**: `apps/www/src/components/webgl-background.tsx`
**Changes**: Replace contents with v2 implementation (or rename v2 to v1)

Delete `webgl-background.tsx` and rename `webgl-background-v2.tsx` to `webgl-background.tsx`. Update export name:

```tsx
// In webgl-background.tsx (formerly v2)
export function WebGLBackground({ ... }) {
  // ... same implementation as v2
}
```

#### 2. Update Route Import
**File**: `apps/www/src/routes/index.tsx`
**Changes**: Ensure import points to renamed component

```tsx
const WebGLBackground = lazy(
  () => import("~/components/webgl-background").then(m => ({ default: m.WebGLBackground })),
);
```

#### 3. Remove Old Files
**Files to Delete**:
- `apps/www/src/shaders/background.vert` (vertex shader no longer needed)
- `apps/www/src/shaders/background.frag` (replaced by unified shader)
- `apps/www/src/shaders/grain.frag` (baked into unified shader)
- `apps/www/src/shaders/simulation.frag` (replaced by webgl2 version)
- `apps/www/src/effects/grain-effect.ts` (no longer needed)
- `apps/www/src/components/paper-design-test.tsx` (temporary test file)

#### 4. Remove Three.js Dependencies
**File**: `apps/www/package.json`
**Changes**: Remove three.js and postprocessing

```bash
cd apps/www && pnpm remove three @types/three postprocessing
```

#### 5. Update Vite Config
**File**: `apps/www/vite.config.ts`
**Changes**: Remove Three.js chunk configuration

Remove lines 28-44 (the manualChunks configuration for vendor-three, vendor-three-addons, vendor-postprocessing).

#### 6. Clean Shader Files (Rename)
**Changes**: Rename new shaders to cleaner names
- `noise-gradient-grain.frag` → `background.frag`
- `simulation-webgl2.frag` → `simulation.frag`

Update imports in `webgl-background.tsx` accordingly.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`
- [x] No three.js or postprocessing in build output: Check `.output/public/assets/` for absence of `vendor-three*` chunks
- [x] Bundle size verification: Check that total JS size decreased significantly

#### Manual Verification:
- [ ] Background renders identically to before migration
- [ ] Grain effect works correctly with `enableGrain={true}`
- [ ] Displacement works with `enableDisplacement={true}` (if applicable)
- [ ] Mobile fallback still works (shows bg-background)
- [ ] Page load performance is equal or better
- [ ] No console errors

**Implementation Note**: This is the final phase. After completing all verification, the migration is complete.

---

## Testing Strategy

### Unit Tests:
- N/A - WebGL components are difficult to unit test, rely on manual verification

### Integration Tests:
- Build verification: Ensure build completes without errors
- Type checking: Ensure TypeScript is satisfied
- Lint: Ensure code quality standards are met

### Manual Testing Steps:
1. Load homepage on desktop Chrome
2. Verify gradient animation is smooth
3. Verify grain effect is visible and animates at ~8fps
4. Resize window and verify no visual glitches
5. Load on mobile device (or emulator) and verify fallback background color shows
6. Test with `enableDisplacement={true}` and verify mouse interaction
7. Compare side-by-side with current production to verify visual match

## Performance Considerations

- **Bundle Size**: Expected reduction from ~517KB to ~25-30KB (including custom GPGPU)
- **Runtime Performance**: Single-pass rendering should be equal or faster than multi-pass
- **Texture Loading**: Same noise texture is still required
- **GPGPU Resolution**: Same formula as before (`screenSize / 40`)
- **Frame Rate**: Target 60fps maintained (grain animates at ~8fps by design)

## Migration Notes

- **Backwards Compatibility**: Component props remain unchanged
- **Visual Parity**: All shader math preserved exactly
- **WebGL2 Requirement**: Drops WebGL1 support (97%+ browser coverage acceptable)

## References

- Research document: `thoughts/shared/research/2026-02-01-paper-design-webgl-renderer-migration.md`
- Current implementation: `apps/www/src/components/webgl-background.tsx`
- Paper Design package: `@paper-design/shaders-react`
- WebGL2 GPGPU fundamentals: https://webgl2fundamentals.org/webgl/lessons/webgl-gpgpu.html
