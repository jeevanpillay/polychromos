# GPGPU Displacement Black Screen Fix Implementation Plan

## Overview

Fix the black screen issue when `enableDisplacement={true}` in the Paper Design WebGL background. The root cause is a React state mutation pattern that bypasses React's dependency system, preventing Paper Design's ShaderMount from receiving updated GPGPU simulation textures.

## Current State Analysis

### Root Causes (from research)

1. **React State Mutation Without Re-render**: `simulationImage.src = dataUrl` mutates the Image object directly without changing its reference, so React's `useMemo` never recomputes `uniforms`
2. **Image Loading Race Condition**: Setting `img.src` triggers async decode, but no `onload` handler waits for completion
3. **Separate WebGL Contexts**: GPGPU uses its own context, requiring canvas-to-image conversion (this is architectural and won't change)

### Key Code Locations

- `apps/www/src/components/webgl-background.tsx:225-229` - Current broken mutation pattern
- `apps/www/src/components/webgl-background.tsx:249-283` - uniforms useMemo that never recomputes
- `apps/www/src/components/webgl-background.tsx:181-184` - simulationImage creation

### Paper Design Behavior

- React ShaderMount's `useEffect` only triggers when `uniformsProp` **reference** changes
- Texture cache uses `src + dimensions` as key, so new src WOULD trigger upload if React effect ran
- The React layer is blocking the update, not the cache layer

## Desired End State

- GPGPU mouse displacement effect renders correctly when `enableDisplacement={true}`
- Each frame's simulation texture is properly passed to Paper Design's shader
- Code includes comments documenting future optimization opportunities
- Visual verification at `/test/paper-design` shows mouse interaction affecting the background

## What We're NOT Doing

- Changing the GPGPU renderer architecture
- Modifying Paper Design's ShaderMount internals
- Implementing shared WebGL context (would require significant refactor)
- Implementing `createImageBitmap()` optimization (noted for future)

## Implementation Approach

Replace the mutable `simulationImage.src` pattern with a proper React state update that:
1. Creates a new `HTMLImageElement` for each GPGPU frame output
2. Waits for the image to decode via `onload`
3. Updates React state with the new image reference
4. Triggers `useMemo` recomputation via changed dependency

---

## Phase 1: Fix React State Update Pattern

### Overview

Replace the direct mutation of `simulationImage.src` with a pattern that creates new Image objects and properly updates React state after decode completes.

### Changes Required:

#### 1. Update the `runGPGPU` callback

**File**: `apps/www/src/components/webgl-background.tsx`

**Current code (lines 195-233)**:
```typescript
const runGPGPU = useCallback(() => {
  // ... compute logic ...

  // Update simulation image from canvas
  const dataUrl = canvas.toDataURL();
  if (simulationImage) {
    simulationImage.src = dataUrl;  // BROKEN: mutation without re-render
  }

  animationFrameRef.current = requestAnimationFrame(runGPGPU);
}, [enableDisplacement, simulationImage]);
```

**New code**:
```typescript
const runGPGPU = useCallback(() => {
  const gpgpu = gpgpuRef.current;
  const canvas = gpgpuCanvasRef.current;
  const gl = gpgpuGlRef.current;

  if (!gpgpu || !canvas || !gl || !enableDisplacement) return;

  const now = performance.now();
  const delta =
    lastTimeRef.current === 0
      ? 16.67
      : Math.min(now - lastTimeRef.current, 50);
  lastTimeRef.current = now;

  const uniforms: GPGPUUniforms = {
    u_mouse: mouseRef.current,
    u_prevMouse: prevMouseRef.current,
    u_delta: delta,
    u_mouseFactor: DISPLACEMENT_SETTINGS.mouseFactor,
  };

  gpgpu.compute(uniforms);

  // Read GPGPU result to canvas for Paper Design to use
  const texture = gpgpu.getCurrentTexture();
  if (texture) {
    renderTextureToCanvas(gl, texture, canvas.width, canvas.height);

    // PERF NOTE: Creating a new Image per frame is not optimal.
    // Future optimizations to consider:
    // 1. Use createImageBitmap() for faster async decode
    // 2. Implement shared WebGL context between GPGPU and Paper Design
    // 3. Extend Paper Design to accept WebGLTexture directly
    // 4. Use OffscreenCanvas with transferToImageBitmap()
    //
    // Current approach creates ~60 Image objects/second which will be GC'd.
    // This is acceptable for the small texture size (typically 48x27 pixels).
    const dataUrl = canvas.toDataURL();
    const newImage = new Image();
    newImage.onload = () => {
      // Only update state if component is still mounted and displacement enabled
      // This prevents stale updates after unmount or toggle
      if (gpgpuRef.current && enableDisplacement) {
        setSimulationImage(newImage);
      }
    };
    newImage.src = dataUrl;
  }

  animationFrameRef.current = requestAnimationFrame(runGPGPU);
}, [enableDisplacement]);
```

**Key changes**:
1. Create new `Image()` for each frame instead of mutating existing
2. Use `onload` to wait for decode before updating state
3. Call `setSimulationImage(newImage)` to trigger React re-render
4. Remove `simulationImage` from dependencies (prevents stale closure issues)
5. Add guard check before state update to prevent updates after unmount
6. Add detailed comments about performance optimization opportunities

#### 2. Remove unnecessary initial image creation

**File**: `apps/www/src/components/webgl-background.tsx`

**Current code (lines 180-184)**:
```typescript
// Create initial simulation image
const simImg = new Image();
simImg.width = gpuWidth;
simImg.height = gpuHeight;
setSimulationImage(simImg);
```

**New code**:
```typescript
// Initial simulation image will be created by first runGPGPU frame
// No need to pre-create an empty image - neutralImage handles the
// initial state until first GPGPU output is ready
```

This simplifies initialization - the first `runGPGPU` call will create and set the first valid simulation image.

#### 3. Update the GPGPU loop start effect

**File**: `apps/www/src/components/webgl-background.tsx`

**Current code (lines 236-246)**:
```typescript
useEffect(() => {
  if (enableDisplacement && gpgpuRef.current && simulationImage) {
    animationFrameRef.current = requestAnimationFrame(runGPGPU);
  }

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [enableDisplacement, runGPGPU, simulationImage]);
```

**New code**:
```typescript
useEffect(() => {
  // Start GPGPU loop when renderer is ready
  // Note: We don't depend on simulationImage anymore since runGPGPU
  // creates new images and updates state independently
  if (enableDisplacement && gpgpuRef.current) {
    animationFrameRef.current = requestAnimationFrame(runGPGPU);
  }

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [enableDisplacement, runGPGPU]);
```

**Key change**: Remove `simulationImage` dependency since loop no longer needs to wait for initial image.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Navigate to `http://localhost:3000/test/paper-design` with `enableDisplacement={true}`
- [ ] Background renders (not black screen)
- [ ] Moving mouse creates visible displacement/ripple effect on background
- [ ] Displacement effect fades/decays when mouse stops
- [ ] No console errors related to WebGL or image loading
- [ ] Performance is acceptable (no significant frame drops)

**Implementation Note**: After completing this phase and all automated verification passes, open the browser to `/test/paper-design` and manually verify the displacement effect works. Iterate on fixes if needed before considering this phase complete.

---

## Phase 2: Enable Displacement in Test Page

### Overview

Update the test page to enable displacement for testing.

### Changes Required:

**File**: `apps/www/src/routes/test/paper-design.tsx`

**Current code (line 18)**:
```typescript
<WebGLBackground enableGrain={true} enableDisplacement={false} />
```

**New code**:
```typescript
<WebGLBackground enableGrain={true} enableDisplacement={true} />
```

### Success Criteria:

#### Manual Verification:
- [ ] Page loads without black screen
- [ ] Grain effect visible
- [ ] Mouse displacement effect visible when moving cursor
- [ ] Effect responds smoothly to mouse movement
- [ ] Effect decays smoothly when mouse stops

---

## Phase 3: Browser-Based Iterative Testing

### Overview

Verify the fix works correctly through iterative browser testing. If issues are found, debug and fix before finalizing.

### Testing Checklist:

1. **Initial Load Test**
   - [ ] Page loads without black screen
   - [ ] No WebGL errors in console
   - [ ] Background gradient visible immediately

2. **Displacement Effect Test**
   - [ ] Move mouse slowly - displacement follows cursor
   - [ ] Move mouse quickly - displacement trail visible
   - [ ] Stop mouse - effect fades gradually
   - [ ] Move mouse to edge of screen - no artifacts

3. **Performance Test**
   - [ ] Open DevTools Performance tab
   - [ ] Record 5 seconds of mouse movement
   - [ ] Verify frame rate stays above 30fps
   - [ ] Check for excessive GC pauses (expected but should be minimal)

4. **Toggle Test**
   - [ ] If displacement can be toggled at runtime, verify:
     - Enabling shows effect
     - Disabling removes effect cleanly
     - Re-enabling works correctly

5. **Mobile/Resize Test**
   - [ ] Resize window - no crashes or artifacts
   - [ ] Narrow window (< 768px) - displacement should be disabled (mobile check)

### Debugging Steps (if issues found):

1. **If still black screen**:
   - Check console for image decode errors
   - Verify `setSimulationImage` is being called (add console.log)
   - Check if `uniforms` useMemo is recomputing (React DevTools)
   - Verify Paper Design receives new uniform (check network of texture uploads)

2. **If displacement not visible but not black**:
   - Check `u_displacementStrength` uniform value
   - Verify simulation shader is running (check GPGPU canvas with toDataURL)
   - Check if displacement UVs are being applied in background.frag

3. **If performance issues**:
   - Profile with Chrome DevTools
   - Check GC frequency and duration
   - Consider reducing GPGPU resolution divisor
   - Consider implementing `createImageBitmap()` optimization

---

## Performance Optimization Notes (For Future Reference)

The current implementation creates a new `HTMLImageElement` per frame (~60/second). This works but has overhead:

### Current Bottlenecks:
1. `canvas.toDataURL()` - Synchronous, blocks main thread
2. `new Image()` + base64 decode - Creates garbage, triggers GC
3. React state update per frame - Potential for batching issues

### Future Optimization Options:

#### Option 1: createImageBitmap (Recommended First Step)
```typescript
// Replace onload pattern with createImageBitmap
const blob = await new Promise<Blob>((resolve) =>
  canvas.toBlob((b) => resolve(b!), 'image/png')
);
const bitmap = await createImageBitmap(blob);
// Note: Paper Design may need modification to accept ImageBitmap
```

#### Option 2: OffscreenCanvas + transferToImageBitmap
```typescript
// Use OffscreenCanvas for GPGPU (requires worker or main thread support)
const offscreen = canvas.transferControlToOffscreen();
// Render to offscreen, then transfer bitmap
```

#### Option 3: Shared WebGL Context
- Have Paper Design expose its WebGL context
- Create GPGPU renderer using same context
- Pass texture directly without image conversion

#### Option 4: Custom Paper Design Extension
- Extend ShaderMount to accept `WebGLTexture` uniform type
- Skip image conversion entirely
- Most performant but requires Paper Design modifications

---

## Testing Strategy

### Unit Tests:
- Not applicable - this is a rendering fix best verified visually

### Integration Tests:
- Could add Playwright test to verify page loads without black screen
- Screenshot comparison before/after mouse movement

### Manual Testing Steps:
1. Run `pnpm dev:www`
2. Navigate to `http://localhost:3000/test/paper-design`
3. Verify background is visible (not black)
4. Move mouse around - verify displacement effect
5. Check console for errors
6. Check performance in DevTools

---

## References

- Research document: `thoughts/shared/research/2026-02-01-gpgpu-displacement-black-screen-analysis.md`
- GPGPU renderer: `apps/www/src/lib/gpgpu-renderer.ts`
- Background shader: `apps/www/src/shaders/background.frag`
- Simulation shader: `apps/www/src/shaders/simulation.frag`
- Paper Design docs: `node_modules/@paper-design/shaders-react/`
