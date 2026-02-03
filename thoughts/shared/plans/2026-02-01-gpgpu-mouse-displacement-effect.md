# GPGPU Mouse Displacement Effect Implementation Plan

## Overview

Implement a fluid background warping effect that follows mouse movement on the WebGL background. The effect uses GPGPU computing to simulate mouse influence across the screen, creating a displacement trail that decays smoothly when the mouse stops moving.

## Current State Analysis

**Existing Implementation** (`apps/www/src/components/webgl-background.tsx`):
- Single fullscreen plane with animated noise gradient
- Post-processing pipeline: RenderPass → GrainEffect via EffectComposer
- No mouse tracking or interaction
- Mobile disabled, respects reduced motion preference
- Uses vanilla Three.js with `postprocessing` library

### Key Discoveries:
- Post-processing already uses EffectComposer (`webgl-background.tsx:83-92`)
- Animation loop with Clock for delta time (`webgl-background.tsx:142-161`)
- Comprehensive cleanup pattern for Three.js resources (`webgl-background.tsx:164-180`)
- Reduced motion handling already implemented (`webgl-background.tsx:147-154`)

## Desired End State

After implementation:
1. Moving the mouse over the WebGL background creates a fluid warping/displacement effect
2. The effect spreads outward from the mouse path with soft falloff
3. Displacement decays smoothly back to neutral when mouse stops (~250ms)
4. Subtle brightness boost appears in displaced areas
5. Effect respects reduced motion preference (disabled or significantly reduced)
6. No visual or performance regression on existing gradient/grain effects

### Verification:
- Desktop: Mouse movement creates visible UV displacement in background gradient
- Mobile: No change (WebGL remains disabled)
- Reduced motion: Displacement effect disabled or minimal
- Performance: Maintains 60fps on mid-range hardware

## What We're NOT Doing

- Touch/mobile interaction (current implementation disables WebGL on mobile)
- Configurable displacement via props (hardcoded settings like grain effect)
- Click or gesture interactions (mouse movement only)
- Changes to the grain post-processing effect

## Implementation Approach

Use **GPUComputationRenderer** from Three.js examples to handle the GPGPU simulation. This provides:
- Automatic ping-pong buffer management
- Clean API for adding simulation variables
- Built-in texture management

**Architecture**:
```
Each Frame:
1. Update mouse uniforms (current + previous position)
2. GPUComputationRenderer.compute() → simulation texture
3. Pass simulation texture to background shader
4. Background shader displaces UVs based on simulation data
5. EffectComposer renders with grain post-processing
```

---

## Phase 1: Add GPGPU Simulation Infrastructure

### Overview
Set up GPUComputationRenderer and create the simulation shader that tracks mouse influence over time.

### Changes Required:

#### 1. Create Simulation Fragment Shader
**File**: `apps/www/src/shaders/simulation.frag` (new file)

```glsl
// GPGPU simulation shader for mouse displacement tracking
// Output texture: R=X displacement, G=Y displacement, B=intensity

uniform vec2 uMouse;         // Current mouse position (0-1)
uniform vec2 uPrevMouse;     // Previous frame mouse position (0-1)
uniform float uDelta;        // Delta time in milliseconds
uniform float uMouseFactor;  // Strength multiplier (default: 1.0)

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

#### 2. Update TypeScript Declarations
**File**: `apps/www/src/vite-env.d.ts`
**Changes**: Verify `*.frag?raw` declaration exists (should already be present)

No changes needed - already declares:
```typescript
declare module "*.frag?raw" {
  const content: string;
  export default content;
}
```

### Success Criteria:

#### Automated Verification:
- [x] New shader file exists: `ls apps/www/src/shaders/simulation.frag`
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files unrelated to this change)

#### Manual Verification:
- [x] N/A - shader not yet integrated

---

## Phase 2: Integrate GPUComputationRenderer

### Overview
Add GPUComputationRenderer to the WebGL background component, initialize the simulation texture, and set up mouse tracking.

### Changes Required:

#### 1. Update WebGL Background Component
**File**: `apps/www/src/components/webgl-background.tsx`

**Add imports** (after line 6):
```typescript
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import simulationShader from "~/shaders/simulation.frag?raw";
```

**Add displacement settings** (after GRAIN_SETTINGS, ~line 28):
```typescript
// Mouse displacement settings
const DISPLACEMENT_SETTINGS = {
  simulationResolution: 256,      // GPGPU texture resolution
  displacementStrength: 0.08,     // How far UVs are displaced
  cursorBrightness: 0.3,          // Brightness boost on displacement
  mouseFactor: 1.0,               // Mouse influence multiplier
};
```

**Add mouse refs** (after prefersReducedMotionRef, ~line 32):
```typescript
const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
const prevMouseRef = useRef(new THREE.Vector2(0.5, 0.5));
```

**Add mouse event handler** (new useEffect after reduced motion effect, ~line 58):
```typescript
// Track mouse position
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    // Store previous position
    prevMouseRef.current.copy(mouseRef.current);
    // Update current position (normalized 0-1)
    mouseRef.current.set(
      e.clientX / window.innerWidth,
      1.0 - e.clientY / window.innerHeight // Flip Y for WebGL coordinates
    );
  };

  window.addEventListener("mousemove", handleMouseMove);
  return () => window.removeEventListener("mousemove", handleMouseMove);
}, []);
```

**Initialize GPUComputationRenderer** (after composer setup, ~line 92):
```typescript
// Setup GPGPU for mouse displacement simulation
const gpuCompute = new GPUComputationRenderer(
  DISPLACEMENT_SETTINGS.simulationResolution,
  DISPLACEMENT_SETTINGS.simulationResolution,
  renderer
);

// Check for float texture support
if (renderer.capabilities.isWebGL2 === false) {
  if (renderer.extensions.get("OES_texture_float") === null) {
    console.warn("Float textures not supported, displacement disabled");
  }
}

// Create initial texture (neutral state: R=0.5, G=0.5, B=0, A=1)
const initialTexture = gpuCompute.createTexture();
const textureData = initialTexture.image.data as Float32Array;
for (let i = 0; i < textureData.length; i += 4) {
  textureData[i + 0] = 0.5; // R: X displacement (neutral)
  textureData[i + 1] = 0.5; // G: Y displacement (neutral)
  textureData[i + 2] = 0.0; // B: Intensity
  textureData[i + 3] = 1.0; // A: Unused
}

// Add simulation variable
const simVariable = gpuCompute.addVariable(
  "tPrevious",
  simulationShader,
  initialTexture
);

// Set uniforms
simVariable.material.uniforms.uMouse = { value: new THREE.Vector2(0.5, 0.5) };
simVariable.material.uniforms.uPrevMouse = { value: new THREE.Vector2(0.5, 0.5) };
simVariable.material.uniforms.uDelta = { value: 16.67 };
simVariable.material.uniforms.uMouseFactor = { value: DISPLACEMENT_SETTINGS.mouseFactor };

// Self-dependency (reads previous frame)
gpuCompute.setVariableDependencies(simVariable, [simVariable]);

// Initialize
const gpuError = gpuCompute.init();
if (gpuError !== null) {
  console.error("GPUComputationRenderer error:", gpuError);
}
```

**Add displacement uniforms to material** (modify uniforms object, ~line 104-117):
```typescript
uniforms: {
  // ... existing uniforms ...
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
  // New displacement uniforms
  uSimulationTexture: { value: null },
  uDisplacementStrength: {
    value: new THREE.Vector2(
      DISPLACEMENT_SETTINGS.displacementStrength,
      DISPLACEMENT_SETTINGS.displacementStrength
    )
  },
  uCursorBrightness: { value: DISPLACEMENT_SETTINGS.cursorBrightness },
},
```

**Update animation loop** (modify animate function, ~line 143-160):
```typescript
const animate = () => {
  if (isDisposed) return;

  // Handle reduced motion for both gradient and grain
  const prefersReduced = prefersReducedMotionRef.current;
  const speedMultiplier = prefersReduced ? 0.1 : 1;

  // Slow gradient animation
  uTime.value = clock.getElapsedTime() * speedMultiplier;

  // Freeze grain animation when reduced motion preferred
  grainEffect.speed = prefersReduced ? 0 : GRAIN_SETTINGS.speed;

  // === GPGPU Simulation ===
  if (!prefersReduced) {
    // Update simulation uniforms
    const delta = clock.getDelta() * 1000; // Convert to milliseconds
    simVariable.material.uniforms.uMouse.value.copy(mouseRef.current);
    simVariable.material.uniforms.uPrevMouse.value.copy(prevMouseRef.current);
    simVariable.material.uniforms.uDelta.value = Math.min(delta, 50); // Cap at 50ms

    // Run GPGPU simulation
    gpuCompute.compute();

    // Pass simulation texture to background shader
    material.uniforms.uSimulationTexture.value =
      gpuCompute.getCurrentRenderTarget(simVariable).texture;
  }

  // Use composer instead of renderer
  composer.render();

  animationId = requestAnimationFrame(animate);
};
```

**Update cleanup** (add to cleanup function, ~line 164-180):
```typescript
return () => {
  isDisposed = true;
  cancelAnimationFrame(animationId);
  window.removeEventListener("resize", handleResize);

  // Dispose Three.js resources
  geometry.dispose();
  material.dispose();
  noiseTexture.dispose();
  gpuCompute.dispose(); // Add this line
  composer.dispose();
  renderer.dispose();

  // Remove canvas from DOM
  if (container.contains(renderer.domElement)) {
    container.removeChild(renderer.domElement);
  }
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Page loads without console errors
- [ ] Background gradient still animates correctly
- [ ] Grain effect still works
- [ ] No performance degradation (maintains 60fps)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the integration works before proceeding to Phase 3.

---

## Phase 3: Update Background Shader for Displacement

### Overview
Modify the background fragment shader to sample the simulation texture and apply UV displacement.

### Changes Required:

#### 1. Update Background Fragment Shader
**File**: `apps/www/src/shaders/background.frag`

**Replace entire file with**:
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
    // R,G store displacement as 0-1 where 0.5 = neutral
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

    // Sample noise texture at two different UV positions
    vec4 noiseColor1 = texture2D(uNoiseTexture, nUv1);
    float noise1 = noiseColor1.r;

    vec4 noiseColor2 = texture2D(uNoiseTexture, nUv2);
    float noise2 = noiseColor2.r;

    // Blend the two noise samples
    float noise = clamp((noise1 + noise2) / 2., 0., 1.);

    // Third noise sample for additional variation
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

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Build succeeds: `pnpm build:www`
- [ ] Dev server starts: `pnpm dev:www`

#### Manual Verification:
- [ ] Background gradient displays correctly
- [ ] Moving mouse creates visible displacement/warping effect
- [ ] Displacement follows mouse movement direction
- [ ] Effect spreads outward with soft falloff
- [ ] Brightness boost visible in displaced areas
- [ ] Effect decays smoothly when mouse stops (~250ms)
- [ ] Grain effect still works on top of displaced background

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the displacement effect works correctly before proceeding to Phase 4.

---

## Phase 4: Polish and Edge Cases

### Overview
Handle edge cases, add reduced motion support for displacement, and optimize performance.

### Changes Required:

#### 1. Handle Reduced Motion for Displacement
**File**: `apps/www/src/components/webgl-background.tsx`

The Phase 2 implementation already includes reduced motion handling in the animation loop:
```typescript
if (!prefersReduced) {
  // GPGPU simulation only runs when reduced motion is NOT preferred
}
```

When reduced motion is preferred:
- Simulation doesn't run
- `uSimulationTexture` remains at initial neutral state (no displacement)
- Background renders normally without warping

#### 2. Handle Mouse Leave/Enter
**File**: `apps/www/src/components/webgl-background.tsx`

**Update mouse tracking effect** to reset on mouse leave:
```typescript
// Track mouse position
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    prevMouseRef.current.copy(mouseRef.current);
    mouseRef.current.set(
      e.clientX / window.innerWidth,
      1.0 - e.clientY / window.innerHeight
    );
  };

  const handleMouseLeave = () => {
    // Reset to center to prevent stuck displacement at edges
    prevMouseRef.current.copy(mouseRef.current);
  };

  window.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseleave", handleMouseLeave);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseleave", handleMouseLeave);
  };
}, []);
```

#### 3. Ensure Clock Delta is Correct
**File**: `apps/www/src/components/webgl-background.tsx`

Note: `clock.getDelta()` must be called every frame to work correctly. The current implementation calls it inside the `if (!prefersReduced)` block, which means it won't be called when reduced motion is preferred. Move it outside:

```typescript
const animate = () => {
  if (isDisposed) return;

  const prefersReduced = prefersReducedMotionRef.current;
  const speedMultiplier = prefersReduced ? 0.1 : 1;
  const delta = clock.getDelta() * 1000; // Always call getDelta()

  uTime.value = clock.getElapsedTime() * speedMultiplier;
  grainEffect.speed = prefersReduced ? 0 : GRAIN_SETTINGS.speed;

  if (!prefersReduced) {
    simVariable.material.uniforms.uMouse.value.copy(mouseRef.current);
    simVariable.material.uniforms.uPrevMouse.value.copy(prevMouseRef.current);
    simVariable.material.uniforms.uDelta.value = Math.min(delta, 50);

    gpuCompute.compute();
    material.uniforms.uSimulationTexture.value =
      gpuCompute.getCurrentRenderTarget(simVariable).texture;
  }

  composer.render();
  animationId = requestAnimationFrame(animate);
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files)
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Reduced motion: No displacement effect when preference enabled
- [ ] Mouse leave: Displacement decays normally when mouse leaves window
- [ ] Mouse enter: No jarring jump when mouse re-enters window
- [ ] Performance: Maintains 60fps during rapid mouse movement
- [ ] Memory: No memory leaks after extended use (check DevTools)

---

## Testing Strategy

### Unit Tests:
- N/A - WebGL effects are difficult to unit test

### Integration Tests:
- N/A - Visual effects require manual verification

### Manual Testing Steps:
1. **Basic functionality**: Move mouse across background, verify warping follows
2. **Direction test**: Move mouse left - gradient should warp left
3. **Decay test**: Stop mouse, verify effect fades in ~250ms
4. **Speed test**: Fast mouse movement creates stronger displacement
5. **Edge test**: Move mouse to screen edges, no artifacts
6. **Resize test**: Resize browser, effect continues working
7. **Reduced motion**: Enable OS reduced motion, verify no displacement
8. **Tab switching**: Switch tabs and back, effect resumes correctly
9. **Long duration**: Leave page open 5+ minutes, check for memory growth

## Performance Considerations

1. **Simulation Resolution**: 256x256 is a good balance. Lower (128) for weaker devices, higher (512) not recommended.

2. **Frame Budget**: GPGPU pass adds ~1-2ms per frame on mid-range GPU.

3. **Memory**: GPUComputationRenderer creates 2 render targets internally for ping-pong. At 256x256 RGBA Float, that's ~1MB total.

4. **Mobile**: Already disabled via existing `isMobile` check.

## References

- Research document: `thoughts/shared/research/2026-02-01-gpgpu-mouse-displacement-effect.md`
- Leeroy.ca shader extraction: `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md`
- Three.js GPUComputationRenderer: https://threejs.org/examples/?q=gpgpu#webgl_gpgpu_birds

---

**Created**: 2026-02-01
**Status**: Ready for implementation
