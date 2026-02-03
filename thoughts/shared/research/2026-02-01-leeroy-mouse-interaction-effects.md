---
date: 2026-02-01T11:00:00+11:00
researcher: Claude Opus 4.5
topic: "Leeroy.ca Mouse Interaction Effects Analysis"
tags: [research, web-analysis, mouse-effects, webgl, css-animation, gpgpu, slice-effect]
status: complete
created_at: 2026-02-01
confidence: high
sources_count: 1
---

# Leeroy.ca Mouse Interaction Effects Analysis

**Date**: 2026-02-01T11:00:00+11:00
**Topic**: Complete analysis of mouse interaction effects on leeroy.ca
**Confidence**: High - Direct inspection and code extraction from live site

## Research Question

What creates the "cool squares effect overlay" on mouse movement at leeroy.ca?

## Executive Summary

Leeroy.ca uses **TWO distinct mouse interaction effects**:

| Effect | Technology | What It Does |
|--------|------------|--------------|
| **WebGL Displacement** | GPGPU + Shaders | Distorts/warps the gradient background following mouse trail |
| **CSS Slice Reveal** | CSS + GSAP | Horizontal image strips on buttons that animate with staggered offsets |

The "squares/bars effect" the user sees is the **CSS Slice Reveal** - a non-WebGL effect using stacked horizontal image strips that animate independently on hover.

## Effect 1: CSS Slice Reveal (The "Squares" Effect)

### What It Looks Like

- Horizontal bars/strips appear over CTA buttons
- Each strip shows a portion of an image
- Strips animate with staggered horizontal offsets (venetian blind effect)
- Creates a sliced/segmented image reveal on hover

### DOM Structure

```html
<div class="js-slice-wrapper">
  <a href="/agence" class="slice-link">
    <div class="js-slice-image">
      <!-- Base image (hidden or shown) -->
      <img src="image.webp" alt="" />

      <!-- Slices - 3 horizontal strips -->
      <div class="slice-image" style="background-image: url(image.webp)"></div>
      <div class="slice-image" style="background-image: url(image.webp)"></div>
      <div class="slice-image" style="background-image: url(image.webp)"></div>
    </div>

    <span class="slice-link__text-wrapper">
      <span class="slice-link__text-inner">NOUS DÉCOUVRIR</span>
    </span>
  </a>
</div>
```

### Slice Element Properties

Each `.slice-image` element:

| Property | Value | Purpose |
|----------|-------|---------|
| `position` | `absolute` | Stack on top of each other |
| `width` | `400px` or `500px` | Full button width |
| `height` | `~33px` | 1/3 of total image height (~100px total) |
| `background-image` | Same image URL | Each slice shows same image |
| `background-position` | Varies per slice | Shows different vertical portion |
| `transform` | `matrix(1,0,0,1,X,0)` | Horizontal offset animation |

### Animation Behavior

**On Hover:**
1. Slice 1: Translates left (e.g., `translateX(-128px)`)
2. Slice 2: Stays centered (no transform)
3. Slice 3: Translates right (e.g., `translateX(140px)`)

**On Mouse Leave:**
- All slices animate back to aligned position

### CSS Implementation

```css
.slice-image {
  position: absolute;
  width: 100%;
  height: 33.33%;
  background-size: 100% 300%; /* Scale to show 1/3 of image */
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.slice-image:nth-child(1) {
  top: 0;
  background-position: 0 0%; /* Top third */
}

.slice-image:nth-child(2) {
  top: 33.33%;
  background-position: 0 50%; /* Middle third */
}

.slice-image:nth-child(3) {
  top: 66.66%;
  background-position: 0 100%; /* Bottom third */
}

/* Hover state - staggered offsets */
.slice-link:hover .slice-image:nth-child(1) {
  transform: translateX(-30%);
}

.slice-link:hover .slice-image:nth-child(2) {
  transform: translateX(0);
}

.slice-link:hover .slice-image:nth-child(3) {
  transform: translateX(30%);
}
```

### GSAP Implementation (Leeroy's Approach)

Leeroy uses GSAP for more control:

```javascript
import gsap from 'gsap';

class SliceReveal {
  constructor(element) {
    this.wrapper = element;
    this.slices = element.querySelectorAll('.slice-image');
    this.offsets = [-128, 0, 140]; // Pixel offsets for each slice

    this.bindEvents();
  }

  bindEvents() {
    this.wrapper.addEventListener('mouseenter', () => this.animateIn());
    this.wrapper.addEventListener('mouseleave', () => this.animateOut());
  }

  animateIn() {
    this.slices.forEach((slice, i) => {
      gsap.to(slice, {
        x: this.offsets[i],
        duration: 0.5,
        ease: 'power3.out',
        delay: i * 0.05 // Stagger
      });
    });
  }

  animateOut() {
    gsap.to(this.slices, {
      x: 0,
      duration: 0.4,
      ease: 'power3.inOut',
      stagger: 0.03
    });
  }
}

// Initialize
document.querySelectorAll('.js-slice-wrapper').forEach(el => {
  new SliceReveal(el);
});
```

### Variations

**3-Slice (Leeroy Default):**
- 3 horizontal strips
- Alternating left/center/right offsets

**5-Slice (More Dramatic):**
```javascript
const offsets = [-150, -75, 0, 75, 150];
```

**Vertical Slices:**
- Same concept but with vertical strips
- Use `height: 100%`, `width: 20%` for 5 vertical slices

---

## Effect 2: WebGL Mouse Displacement (GPGPU)

### What It Looks Like

- Background gradient warps/distorts following mouse movement
- Creates fluid, organic displacement trail
- Effect decays over time when mouse stops
- Adds subtle brightness boost to displaced areas

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Render Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Mouse Events ──► GPGPU Simulation ──► Simulation Texture   │
│                   (256x256 or 512x512)                      │
│                          │                                  │
│                          ▼                                  │
│  Background Gradient ◄── Displacement Effect                │
│  (Main Shader)           (Reads simulation texture)         │
│                          │                                  │
│                          ▼                                  │
│                    Final Output                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### GPGPU Simulation Shader

This shader runs on a separate render target and creates displacement data:

```glsl
// Uniforms
uniform vec2 uMouse;        // Current mouse position (0-1 normalized)
uniform vec2 uPrevMouse;    // Previous frame mouse position
uniform float uDelta;       // Delta time in ms
uniform float uMouseFactor; // Strength multiplier

// Previous frame's simulation data
uniform sampler2D tPrevious;

// Distance from point to line segment
float distanceToSegment(vec2 point, vec2 start, vec2 end) {
    vec2 lineVec = end - start;
    vec2 pointVec = point - start;
    float lineLen = length(lineVec);

    if (lineLen < 0.0001) return length(pointVec);

    vec2 lineUnitVec = lineVec / lineLen;
    float projLength = clamp(dot(pointVec, lineUnitVec), 0.0, lineLen);
    vec2 projPoint = start + lineUnitVec * projLength;

    return length(point - projPoint);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read previous frame data
    vec4 data = texture2D(tPrevious, uv);

    // Decay towards neutral (0.5 = no displacement)
    data.r = mix(data.r, 0.5, uDelta * 0.002); // X direction
    data.g = mix(data.g, 0.5, uDelta * 0.002); // Y direction
    data.b = mix(data.b, 0.0, uDelta * 0.001); // Intensity

    // Calculate mouse movement
    float mouseDist = distance(uMouse, uPrevMouse);

    // Avoid long lines when mouse enters canvas
    mouseDist *= 1.0 - step(0.2, mouseDist);

    // Direction of mouse movement
    vec2 direction = normalize(uMouse - uPrevMouse);

    // Distance from this pixel to mouse trail (line segment)
    float distToTrail = distanceToSegment(uv, uPrevMouse, uMouse);

    // Influence falls off with distance (radius ~0.2 = 20% of screen)
    float influence = 1.0 - smoothstep(0.0, 0.2, distToTrail);
    influence = pow(influence, 0.5); // Soften falloff

    // Scale by mouse velocity
    influence *= mouseDist * uMouseFactor;

    // Store displacement data in RGB
    data.r += direction.x * 2.0 * influence; // X displacement (-1 to 1, stored as 0-1)
    data.g += direction.y * 2.0 * influence; // Y displacement
    data.b += influence;                      // Intensity/brightness

    // Clamp to valid range
    data.rgb = clamp(data.rgb, 0.0, 1.0);

    gl_FragColor = data;
}
```

### Displacement Effect Shader

Applies the simulation texture to distort the main image:

```glsl
uniform sampler2D tDiffuse;          // Main rendered image
uniform sampler2D uSimulationTexture; // GPGPU output
uniform vec2 uDisplacementStrength;   // e.g., vec2(0.1, 0.1)
uniform float uCursorColoring;        // Brightness boost (e.g., 0.3)

void main() {
    vec2 uv = vUv;

    // Sample simulation texture
    vec4 simData = texture2D(uSimulationTexture, uv);

    // Convert from 0-1 to -0.5 to 0.5 range
    vec2 displacement = simData.rg - 0.5;

    // Apply displacement scaled by intensity
    vec2 displacedUv = uv - displacement * uDisplacementStrength * simData.b;

    // Sample main image at displaced coordinates
    vec4 color = texture2D(tDiffuse, displacedUv);

    // Add brightness boost based on displacement intensity
    color.rgb += color.rgb * simData.b * uCursorColoring;

    gl_FragColor = color;
}
```

### Three.js Implementation

```javascript
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

class MouseDisplacement {
  constructor(renderer, width = 256, height = 256) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    this.mouse = new THREE.Vector2(0.5, 0.5);
    this.prevMouse = new THREE.Vector2(0.5, 0.5);

    this.initGPGPU();
    this.bindEvents();
  }

  initGPGPU() {
    // Create GPGPU renderer
    this.gpuCompute = new GPUComputationRenderer(
      this.width,
      this.height,
      this.renderer
    );

    // Create initial data texture (neutral gray = no displacement)
    const initialData = this.gpuCompute.createTexture();
    const data = initialData.image.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R = 0.5 (no X displacement)
      data[i + 1] = 128; // G = 0.5 (no Y displacement)
      data[i + 2] = 0;   // B = 0 (no intensity)
      data[i + 3] = 255; // A = 1
    }

    // Create simulation variable
    this.simulationVariable = this.gpuCompute.addVariable(
      'tPrevious',
      simulationShader, // GLSL string from above
      initialData
    );

    // Set uniforms
    const uniforms = this.simulationVariable.material.uniforms;
    uniforms.uMouse = { value: this.mouse };
    uniforms.uPrevMouse = { value: this.prevMouse };
    uniforms.uDelta = { value: 16.67 }; // ~60fps
    uniforms.uMouseFactor = { value: 1.0 };

    // Set dependencies (reads from itself)
    this.gpuCompute.setVariableDependencies(
      this.simulationVariable,
      [this.simulationVariable]
    );

    // Initialize
    const error = this.gpuCompute.init();
    if (error !== null) {
      console.error('GPGPU init error:', error);
    }
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      // Store previous position
      this.prevMouse.copy(this.mouse);

      // Update current position (normalized 0-1)
      this.mouse.set(
        e.clientX / window.innerWidth,
        1.0 - (e.clientY / window.innerHeight) // Flip Y for WebGL
      );
    });
  }

  update(delta) {
    // Update uniforms
    const uniforms = this.simulationVariable.material.uniforms;
    uniforms.uMouse.value.copy(this.mouse);
    uniforms.uPrevMouse.value.copy(this.prevMouse);
    uniforms.uDelta.value = delta;

    // Run simulation
    this.gpuCompute.compute();

    // After compute, prevMouse should match mouse for next frame
    this.prevMouse.copy(this.mouse);
  }

  getTexture() {
    return this.gpuCompute.getCurrentRenderTarget(this.simulationVariable).texture;
  }
}
```

### Integration with Background Shader

```javascript
// In your main scene setup
const mouseDisplacement = new MouseDisplacement(renderer, 256, 256);

// Background material needs the simulation texture
backgroundMaterial.uniforms.uSimulationTexture = {
  value: mouseDisplacement.getTexture()
};
backgroundMaterial.uniforms.uDisplacementStrength = {
  value: new THREE.Vector2(0.1, 0.1)
};
backgroundMaterial.uniforms.uCursorColoring = { value: 0.3 };

// Animation loop
function animate() {
  const delta = clock.getDelta() * 1000; // ms

  mouseDisplacement.update(delta);

  // Update texture reference (ping-pong buffers swap)
  backgroundMaterial.uniforms.uSimulationTexture.value =
    mouseDisplacement.getTexture();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

---

## Comparison: Which Effect to Implement?

| Aspect | CSS Slice Effect | WebGL Displacement |
|--------|------------------|-------------------|
| **Complexity** | Low | High |
| **Dependencies** | CSS + optional GSAP | Three.js + GPGPU |
| **Performance** | Excellent | Good (GPU bound) |
| **Browser Support** | Universal | WebGL2 required |
| **Mobile Friendly** | Yes | Should disable |
| **Visual Impact** | High (on buttons) | Subtle (on background) |
| **Implementation Time** | 1-2 hours | 4-8 hours |

### Recommendation

**For maximum impact with minimal effort:**
1. Implement the **CSS Slice Effect** on CTA buttons - high visual impact, easy to implement
2. Optionally add **WebGL Displacement** later for the background - subtle but premium feel

---

## Implementation Priority

### Phase 1: CSS Slice Effect (Quick Win)
- Create `.slice-image` component
- Add GSAP hover animations
- Apply to homepage CTA buttons

### Phase 2: WebGL Displacement (Advanced)
- Requires refactoring current WebGL setup
- Add GPGPU simulation pass
- Modify fragment shader to apply displacement

---

## References

### Primary Source
- [Leeroy.ca](https://www.leeroy.ca/) - Live site inspection

### Related Research
- `thoughts/shared/research/2026-01-31-leeroy-webgl-shader-extraction.md` - Original shader extraction
- `thoughts/shared/research/2026-02-01-film-grain-effect-integration.md` - Grain effect

### Technical Resources
- [Three.js GPUComputationRenderer](https://threejs.org/examples/?q=gpgpu#webgl_gpgpu_birds)
- [GSAP Documentation](https://greensock.com/docs/)

---

**Last Updated**: 2026-02-01
**Confidence Level**: High - Direct inspection of live production site
**Next Steps**: Implement CSS Slice Effect for quick visual win, then consider WebGL displacement
