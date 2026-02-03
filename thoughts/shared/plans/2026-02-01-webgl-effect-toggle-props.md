# WebGL Effect Toggle Props Implementation Plan

## Overview

Add props-based control for individual WebGL effects (grain and displacement/mouse) in the `WebGLBackground` component. Effects will be conditionally initialized based on props, with grain enabled by default and displacement disabled by default.

## Current State Analysis

**File**: `apps/www/src/components/webgl-background.tsx`

The component currently:
- Has no props interface (line 41)
- Always initializes both effects when mounted on desktop
- Uses hardcoded settings constants for configuration
- Already has conditional rendering for mobile/SSR

**Key Discoveries:**
- Grain effect uses `postprocessing` library's `EffectPass` (lines 112-118)
- Displacement effect uses `GPUComputationRenderer` (lines 120-180)
- Effects are independent - grain is post-processing, displacement is inline shader
- Existing patterns in codebase use props with TypeScript interfaces and default values

## Desired End State

The `WebGLBackground` component accepts optional props to enable/disable individual effects:

```tsx
<WebGLBackground enableGrain={true} enableDisplacement={false} />
```

**Verification:**
- Passing `enableGrain={false}` results in no `GrainEffect` instantiation (no console log from effect constructor, no grain visible)
- Passing `enableDisplacement={true}` initializes GPGPU and mouse tracking produces visible displacement
- Default behavior (no props): grain enabled, displacement disabled
- TypeScript enforces correct prop types

## What We're NOT Doing

- No debug UI or development panel
- No URL query parameter support
- No runtime toggling after mount (requires remount to change effects)
- No changes to effect settings/configuration values
- No changes to mobile detection or SSR behavior

## Implementation Approach

Add a TypeScript props interface with optional boolean flags, each defaulting to the specified value. Wrap effect initialization code in conditionals that check these props. Skip mouse tracking useEffect entirely when displacement is disabled.

## Phase 1: Add Props Interface and Conditional Grain

### Overview
Add props interface and conditionally initialize the grain effect based on `enableGrain` prop.

### Changes Required:

#### 1. Add Props Interface
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Before component definition (around line 40)

```tsx
interface WebGLBackgroundProps {
  /** Enable film grain post-processing effect. Defaults to true. */
  enableGrain?: boolean;
  /** Enable GPGPU mouse displacement effect. Defaults to false. */
  enableDisplacement?: boolean;
}
```

#### 2. Update Component Signature
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Line 41

**Before:**
```tsx
export function WebGLBackground() {
```

**After:**
```tsx
export function WebGLBackground({
  enableGrain = true,
  enableDisplacement = false,
}: WebGLBackgroundProps = {}) {
```

#### 3. Conditionally Add Grain Effect
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Lines 112-118

**Before:**
```tsx
// Add grain effect
const grainEffect = new GrainEffect({
  intensity: GRAIN_SETTINGS.intensity,
  size: GRAIN_SETTINGS.size,
  speed: GRAIN_SETTINGS.speed,
});
composer.addPass(new EffectPass(camera, grainEffect));
```

**After:**
```tsx
// Add grain effect (conditionally)
let grainEffect: GrainEffect | null = null;
if (enableGrain) {
  grainEffect = new GrainEffect({
    intensity: GRAIN_SETTINGS.intensity,
    size: GRAIN_SETTINGS.size,
    speed: GRAIN_SETTINGS.speed,
  });
  composer.addPass(new EffectPass(camera, grainEffect));
}
```

#### 4. Update Cleanup to Handle Optional Grain
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Cleanup section (lines 274-291)

No change needed - `GrainEffect` is disposed via `composer.dispose()`.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] `<WebGLBackground />` shows grain effect (default)
- [ ] `<WebGLBackground enableGrain={false} />` shows no grain
- [ ] No console errors in either case
- [ ] Visual grain appearance unchanged when enabled

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Conditional Displacement Effect

### Overview
Conditionally initialize GPGPU displacement based on `enableDisplacement` prop. When disabled, skip all GPGPU setup and provide neutral shader uniforms.

### Changes Required:

#### 1. Wrap GPGPU Setup in Conditional
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Lines 120-180

**Before:**
```tsx
// Setup GPGPU for mouse displacement simulation
// ... ~60 lines of GPGPU initialization
```

**After:**
```tsx
// Setup GPGPU for mouse displacement simulation (conditionally)
let gpuCompute: GPUComputationRenderer | null = null;
let simVariable: ReturnType<GPUComputationRenderer['addVariable']> | null = null;
let simUniforms: {
  uMouse: { value: THREE.Vector2 };
  uPrevMouse: { value: THREE.Vector2 };
  uDelta: { value: number };
  uMouseFactor: { value: number };
} | null = null;

if (enableDisplacement) {
  // Exact leeroy formula: Math.floor(dimension / 40)
  const gpuWidth = Math.floor(
    window.innerWidth / DISPLACEMENT_SETTINGS.resolutionDivisor,
  );
  const gpuHeight = Math.floor(
    window.innerHeight / DISPLACEMENT_SETTINGS.resolutionDivisor,
  );
  gpuCompute = new GPUComputationRenderer(
    gpuWidth,
    gpuHeight,
    renderer,
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
  simVariable = gpuCompute.addVariable(
    "tPrevious",
    simulationShader,
    initialTexture,
  );

  // Set simulation uniforms
  simUniforms = {
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uPrevMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uDelta: { value: 16.67 },
    uMouseFactor: { value: DISPLACEMENT_SETTINGS.mouseFactor },
  };
  simVariable.material.uniforms.uMouse = simUniforms.uMouse;
  simVariable.material.uniforms.uPrevMouse = simUniforms.uPrevMouse;
  simVariable.material.uniforms.uDelta = simUniforms.uDelta;
  simVariable.material.uniforms.uMouseFactor = simUniforms.uMouseFactor;

  // Self-dependency (reads previous frame)
  gpuCompute.setVariableDependencies(simVariable, [simVariable]);

  // Initialize
  const gpuError = gpuCompute.init();
  if (gpuError !== null) {
    console.error("GPUComputationRenderer error:", gpuError);
  }

  // Run initial compute pass to have a valid texture
  gpuCompute.compute();
}
```

#### 2. Update Shader Material Uniforms
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Lines 205-217

**Before:**
```tsx
// Displacement uniforms - initialize with GPGPU texture
// Exact leeroy values
uSimulationTexture: {
  value: gpuCompute.getCurrentRenderTarget(simVariable).texture,
},
uDisplacementStrength: {
  value: new THREE.Vector2(
    DISPLACEMENT_SETTINGS.displacementStrength,
    DISPLACEMENT_SETTINGS.displacementStrength,
  ),
},
uCursorColoring: { value: DISPLACEMENT_SETTINGS.cursorColoring },
```

**After:**
```tsx
// Displacement uniforms - use GPGPU texture if enabled, otherwise neutral values
uSimulationTexture: {
  value: gpuCompute && simVariable
    ? gpuCompute.getCurrentRenderTarget(simVariable).texture
    : null,
},
uDisplacementStrength: {
  value: enableDisplacement
    ? new THREE.Vector2(
        DISPLACEMENT_SETTINGS.displacementStrength,
        DISPLACEMENT_SETTINGS.displacementStrength,
      )
    : new THREE.Vector2(0, 0),
},
uCursorColoring: { value: enableDisplacement ? DISPLACEMENT_SETTINGS.cursorColoring : 0 },
```

#### 3. Update Animation Loop
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Lines 253-264

**Before:**
```tsx
// === GPGPU Simulation ===
// Update simulation uniforms
simUniforms.uMouse.value.copy(mouseRef.current);
simUniforms.uPrevMouse.value.copy(prevMouseRef.current);
simUniforms.uDelta.value = Math.min(delta, 50); // Cap at 50ms

// Run GPGPU simulation
gpuCompute.compute();

// Pass simulation texture to background shader
uSimulationTexture.value =
  gpuCompute.getCurrentRenderTarget(simVariable).texture;
```

**After:**
```tsx
// === GPGPU Simulation (if enabled) ===
if (gpuCompute && simVariable && simUniforms) {
  // Update simulation uniforms
  simUniforms.uMouse.value.copy(mouseRef.current);
  simUniforms.uPrevMouse.value.copy(prevMouseRef.current);
  simUniforms.uDelta.value = Math.min(delta, 50); // Cap at 50ms

  // Run GPGPU simulation
  gpuCompute.compute();

  // Pass simulation texture to background shader
  uSimulationTexture.value =
    gpuCompute.getCurrentRenderTarget(simVariable).texture;
}
```

#### 4. Update Cleanup
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Line 283

**Before:**
```tsx
gpuCompute.dispose();
```

**After:**
```tsx
gpuCompute?.dispose();
```

#### 5. Add enableDisplacement to useEffect Dependencies
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Line 292

**Before:**
```tsx
}, [isMounted, isMobile]);
```

**After:**
```tsx
}, [isMounted, isMobile, enableGrain, enableDisplacement]);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] `<WebGLBackground />` shows grain only (displacement disabled by default)
- [ ] `<WebGLBackground enableDisplacement={true} />` shows displacement effect on mouse move
- [ ] `<WebGLBackground enableGrain={false} enableDisplacement={true} />` shows only displacement
- [ ] `<WebGLBackground enableGrain={false} enableDisplacement={false} />` shows plain gradient
- [ ] No console errors in any configuration
- [ ] Memory usage lower when displacement disabled (check DevTools Performance tab)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Optimize Mouse Tracking

### Overview
Skip mouse tracking useEffect entirely when displacement is disabled, reducing unnecessary event listeners.

### Changes Required:

#### 1. Guard Mouse Tracking Effect
**File**: `apps/www/src/components/webgl-background.tsx`
**Location**: Lines 59-83

**Before:**
```tsx
// Track mouse position
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    // Store previous position
    prevMouseRef.current.copy(mouseRef.current);
    // Update current position (normalized 0-1)
    mouseRef.current.set(
      e.clientX / window.innerWidth,
      1.0 - e.clientY / window.innerHeight, // Flip Y for WebGL coordinates
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

**After:**
```tsx
// Track mouse position (only if displacement enabled)
useEffect(() => {
  if (!enableDisplacement) return;

  const handleMouseMove = (e: MouseEvent) => {
    // Store previous position
    prevMouseRef.current.copy(mouseRef.current);
    // Update current position (normalized 0-1)
    mouseRef.current.set(
      e.clientX / window.innerWidth,
      1.0 - e.clientY / window.innerHeight, // Flip Y for WebGL coordinates
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
}, [enableDisplacement]);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] When `enableDisplacement={false}`, no mousemove listeners attached (verify in DevTools Event Listeners)
- [ ] When `enableDisplacement={true}`, mouse movement causes visible displacement
- [ ] Performance unchanged from Phase 2

---

## Phase 4: Update Homepage Usage

### Overview
Update the homepage to explicitly pass props for documentation purposes and future configurability.

### Changes Required:

#### 1. Update Homepage WebGLBackground Usage
**File**: `apps/www/src/routes/index.tsx`

Find the `<WebGLBackground />` usage and update to be explicit about defaults:

```tsx
<WebGLBackground enableGrain={true} enableDisplacement={false} />
```

This makes the configuration explicit and serves as documentation for future developers.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] ESLint passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Homepage displays same as before (grain visible, no displacement)
- [ ] Changing props to `enableDisplacement={true}` shows displacement effect

---

## Testing Strategy

### Unit Tests:
- No unit tests needed - this is a visual component
- TypeScript provides compile-time validation of prop types

### Integration Tests:
- Manual verification covers all integration scenarios

### Manual Testing Steps:
1. Visit homepage, verify grain is visible
2. Hover over background, verify no displacement effect (default disabled)
3. Temporarily change props to enable displacement, verify mouse movement causes distortion
4. Test all 4 combinations: (grain+displacement), (grain only), (displacement only), (neither)
5. Check console for any errors in each configuration
6. Verify memory usage in DevTools when displacement is disabled

## Performance Considerations

- Skipping GPGPU initialization saves ~60 lines of setup code and GPU memory allocation
- Removing mouse event listeners when not needed reduces main thread overhead
- No impact on grain-only rendering performance

## Migration Notes

No migration needed - current component behavior changes:
- **Before**: Both effects always enabled
- **After**: Grain enabled by default, displacement disabled by default

This is a breaking change in behavior but matches the stated default preference. Any code that relies on displacement being enabled by default will need to pass `enableDisplacement={true}`.

## References

- Research document: `thoughts/shared/research/2026-02-01-webgl-effect-toggle-mechanisms.md`
- Component file: `apps/www/src/components/webgl-background.tsx`
- Grain effect: `apps/www/src/effects/grain-effect.ts`
- Simulation shader: `apps/www/src/shaders/simulation.frag`
