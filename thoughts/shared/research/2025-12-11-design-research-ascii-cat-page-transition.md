---
date: 2025-12-11T00:00:00+00:00
researcher: claude-opus-4-5
topic: "ASCII Cat Page Transition with Sliding Blue Overlay"
tags: [design, research, page-transition, ascii-art, animation, gsap, framer-motion]
status: complete
created_at: 2025-12-11
effect_type: transition
complexity: moderate
---

# Design Research: ASCII Cat Page Transition with Sliding Blue Overlay

**Date**: 2025-12-11
**Challenge**: Design a page transition where a blue overlay slides in from left-to-right, revealing an ASCII art cat drawn in white monospace lines. Once fully revealed, the overlay continues sliding out to expose the new page content. Should feel smooth and intentional, not jarring.
**Effect Type**: Page transition with reveal
**Complexity**: Moderate

## Design Challenge

Create a two-stage page transition:
1. **Stage 1 (Overlay In)**: Blue overlay slides in from left → reveals ASCII cat centered on overlay
2. **Stage 2 (Overlay Out)**: Overlay continues sliding out to the right → reveals new page content

The effect should feel smooth, deliberate, and playful—not jarring or abrupt.

## Creative Summary

This effect combines a classic wipe/reveal transition with ASCII art as an intermediate "loading" or "transition" state. The key to making it feel intentional is **timing asymmetry** and **proper easing**:

- The overlay entrance should feel swift but controlled (ease-out, ~400-500ms)
- A brief pause with the ASCII cat visible creates anticipation (~200-400ms)
- The overlay exit continues the momentum (ease-in, ~400-500ms)

**Recommended approach**: Use **GSAP Timeline** for precise sequencing, or **Framer Motion** with `AnimatePresence` for React integration. The ASCII cat should be pre-rendered as a `<pre>` element with careful CSS for consistent monospace rendering.

## Inspiration Gallery

### Live Demos

| Demo | Technique | Link | Notes |
|------|-----------|------|-------|
| Vue Page Transitions | Multiple overlay patterns | [CodePen](https://codepen.io/fpvz/pen/KQwzGQ) | 11+ effects including slides |
| Pure CSS Overlay | CSS transitions only | [CodePen](https://codepen.io/racpa/pen/EgvmXe) | L-to-R, R-to-L, all directions |
| Barba.js + GSAP | Timeline sequencing | [CodePen](https://codepen.io/naseemshah/pen/KKpeOpy) | Two-stage with scaleY |
| GSAP Menu Overlay | xPercent animation | [CodePen](https://codepen.io/daafiejd/pen/bQMMRa) | Power1 easing, reversible |
| ASCII Morph | Morphing ASCII art | [GitHub](https://github.com/tholman/ascii-morph) | Smooth transitions between shapes |

### Sites Using Similar Effects

| Site | Effect | Link | What to Notice |
|------|--------|------|----------------|
| Awwwards Collection | Various transitions | [Awwwards](https://www.awwwards.com/awwwards/collections/transitions/) | Curated award-winning examples |
| Best Website Gallery | Page transitions | [BWG](https://bestwebsite.gallery/sites/style/page-transitions) | Filter by style |
| Minimal Gallery | Curated design | [Minimal](https://minimal.gallery/) | Daily hand-picked inspiration |

### Design References

- [Codrops - Rotated Overlays](https://tympanus.net/codrops/2019/04/18/how-to-create-and-animate-rotated-overlays/) - Advanced overlay techniques
- [CSS-Tricks - Animating with Clip-Path](https://css-tricks.com/animating-with-clip-path/) - Wipe reveal mechanics
- [Emil Kowalski - Magic of Clip-Path](https://emilkowal.ski/ui/the-magic-of-clip-path/) - Modern clip-path animations

## Implementation Approaches

### Approach 1: GSAP Timeline (Recommended)

**Complexity**: Moderate
**Best For**: Precise timing control, multi-stage sequences, professional results
**Limitations**: Additional dependency (~60kb), imperative API

**How it works**:
GSAP Timeline lets you sequence multiple animations with exact timing. The overlay slides in using `xPercent`, pauses, then continues out. The ASCII cat fades in during the pause.

**Key Code Pattern**:

```tsx
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

function PageTransition({ isAnimating, onComplete }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLPreElement>(null);

  useGSAP(() => {
    if (!isAnimating) return;

    const tl = gsap.timeline({
      onComplete,
      defaults: { ease: 'power2.out' }
    });

    tl
      // Stage 1: Overlay slides in from left
      .fromTo(overlayRef.current,
        { xPercent: -100 },
        { xPercent: 0, duration: 0.5 }
      )
      // ASCII cat fades in
      .fromTo(catRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2 },
        '-=0.1' // Slight overlap
      )
      // Brief pause to appreciate the cat
      .to({}, { duration: 0.3 })
      // Stage 2: Overlay slides out to right
      .to(overlayRef.current, {
        xPercent: 100,
        duration: 0.5,
        ease: 'power2.in'
      })
      .to(catRef.current,
        { opacity: 0, duration: 0.15 },
        '-=0.4'
      );
  }, [isAnimating]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-blue-600 z-50 flex items-center justify-center"
      style={{ transform: 'translateX(-100%)' }}
    >
      <pre
        ref={catRef}
        className="text-white font-mono text-sm leading-tight opacity-0"
        style={{ letterSpacing: '-0.1em', lineHeight: '1.1' }}
      >
{`    /\\_/\\
   ( o.o )
    > ^ <`}
      </pre>
    </div>
  );
}
```

**Resources**:
- [GSAP Timeline Docs](https://gsap.com/docs/v3/GSAP/Timeline/)
- [GSAP React Integration](https://gsap.com/resources/React/)
- [GSAP Easing Visualizer](https://gsap.com/docs/v3/Eases/)

---

### Approach 2: Framer Motion + AnimatePresence

**Complexity**: Moderate
**Best For**: React-native feel, declarative API, component-based architecture
**Limitations**: Exit animations with TanStack Router require workarounds

**How it works**:
Use Framer Motion's `AnimatePresence` with a transition overlay component. The overlay animates through multiple states using variants.

**Key Code Pattern**:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

const overlayVariants = {
  initial: { x: '-100%' },
  enter: {
    x: '0%',
    transition: { duration: 0.5, ease: [0.77, 0, 0.175, 1] }
  },
  exit: {
    x: '100%',
    transition: { duration: 0.5, ease: [0.77, 0, 0.175, 1] }
  }
};

const catVariants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { delay: 0.3, duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

function TransitionOverlay({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 bg-blue-600 z-50 flex items-center justify-center"
          variants={overlayVariants}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          <motion.pre
            className="text-white font-mono"
            variants={catVariants}
            initial="initial"
            animate="enter"
            exit="exit"
          >
{`    /\\_/\\
   ( o.o )
    > ^ <`}
          </motion.pre>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Resources**:
- [Framer Motion AnimatePresence](https://motion.dev/docs/react-animate-presence)
- [TanStack Router + Framer Motion](https://tanstack.com/router/latest/docs/framework/react/how-to/integrate-framer-motion)
- [Page Transitions in React](https://jfelix.info/blog/page-transitions-in-react)

---

### Approach 3: CSS + View Transitions API

**Complexity**: Simple
**Best For**: Native browser support, minimal bundle size, progressive enhancement
**Limitations**: Limited browser support, less control over intermediate states

**How it works**:
Use CSS animations triggered by class changes, or the native View Transitions API for simple cross-document transitions.

**Key Code Pattern**:

```css
/* CSS Keyframes Approach */
.overlay {
  position: fixed;
  inset: 0;
  background: #2563eb; /* blue-600 */
  transform: translateX(-100%);
  z-index: 50;
}

.overlay.animating-in {
  animation: slide-in 0.5s cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

.overlay.animating-out {
  animation: slide-out 0.5s cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

@keyframes slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0%); }
}

@keyframes slide-out {
  from { transform: translateX(0%); }
  to { transform: translateX(100%); }
}

/* ASCII cat fade */
.ascii-cat {
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.overlay.animating-in .ascii-cat {
  animation: fade-in 0.2s 0.35s forwards;
}

@keyframes fade-in {
  to { opacity: 1; }
}
```

**View Transitions API (TanStack Router)**:
```tsx
const router = createRouter({
  routeTree,
  defaultViewTransition: true,
});
```

**Resources**:
- [MDN View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [TanStack Router View Transitions](https://tanstack.com/router/latest/docs/framework/react/examples/view-transitions)

---

## Recommended Approach

**For your use case, I recommend**: **GSAP Timeline**

**Why**:
1. **Precise timing control** - You need exact sequencing (slide in → pause → slide out)
2. **Works with TanStack Router** - No exit animation issues like Framer Motion
3. **Production-proven** - Industry standard for complex animations
4. **Great easing** - Built-in easing functions that feel smooth

**Implementation Steps**:
1. Install GSAP: `pnpm add gsap @gsap/react`
2. Create a `PageTransition` component with overlay + ASCII cat
3. Use GSAP Timeline for the three-stage animation
4. Integrate with TanStack Router's navigation events
5. Add `prefers-reduced-motion` support

## Libraries & Tools

### Recommended

| Library | Use For | Bundle Size | Link |
|---------|---------|-------------|------|
| GSAP | Timeline animations | ~60kb | [gsap.com](https://gsap.com/) |
| @gsap/react | React integration | ~2kb | [npm](https://www.npmjs.com/package/@gsap/react) |

### Alternatives

| Library | Pros | Cons | Link |
|---------|------|------|------|
| Framer Motion | Declarative, React-native | Exit animation issues with TanStack | [motion.dev](https://motion.dev/) |
| Motion One | Tiny (3.8kb) | No AnimatePresence | [motion.dev](https://motion.dev/) |
| CSS only | No dependencies | Limited sequencing | N/A |

## Code Examples

### Basic Implementation

```tsx
// components/PageTransition.tsx
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

const ASCII_CAT = `
    /\\_/\\
   ( o.o )
    > ^ <
`;

interface PageTransitionProps {
  isActive: boolean;
  onComplete?: () => void;
}

export function PageTransition({ isActive, onComplete }: PageTransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLPreElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!isActive || !overlayRef.current || !catRef.current) return;

    // Kill any existing timeline
    timelineRef.current?.kill();

    const tl = gsap.timeline({ onComplete });
    timelineRef.current = tl;

    tl
      .set(overlayRef.current, { xPercent: -100, display: 'flex' })
      .set(catRef.current, { opacity: 0 })
      .to(overlayRef.current, {
        xPercent: 0,
        duration: 0.5,
        ease: 'power2.out'
      })
      .to(catRef.current, {
        opacity: 1,
        duration: 0.2
      }, '-=0.1')
      .to({}, { duration: 0.3 }) // Pause
      .to(catRef.current, {
        opacity: 0,
        duration: 0.15
      })
      .to(overlayRef.current, {
        xPercent: 100,
        duration: 0.5,
        ease: 'power2.in'
      }, '-=0.1')
      .set(overlayRef.current, { display: 'none' });

    return () => {
      timelineRef.current?.kill();
    };
  }, [isActive, onComplete]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 hidden items-center justify-center bg-blue-600"
    >
      <pre
        ref={catRef}
        className="font-mono text-white"
        style={{
          fontSize: '1.5rem',
          lineHeight: 1.1,
          letterSpacing: '-0.05em',
          whiteSpace: 'pre',
        }}
      >
        {ASCII_CAT}
      </pre>
    </div>
  );
}
```

### Enhanced Version with Router Integration

```tsx
// hooks/usePageTransition.ts
import { useState, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';

export function usePageTransition() {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const navigateWithTransition = useCallback((to: string) => {
    setPendingPath(to);
    setIsTransitioning(true);
  }, []);

  const onTransitionComplete = useCallback(() => {
    if (pendingPath) {
      router.navigate({ to: pendingPath });
      setPendingPath(null);
    }
    setIsTransitioning(false);
  }, [pendingPath, router]);

  return {
    isTransitioning,
    navigateWithTransition,
    onTransitionComplete,
  };
}

// Usage in _root.tsx
function RootComponent() {
  const { isTransitioning, onTransitionComplete } = usePageTransition();

  return (
    <RootDocument>
      <PageTransition
        isActive={isTransitioning}
        onComplete={onTransitionComplete}
      />
      <Outlet />
    </RootDocument>
  );
}
```

## Browser & Performance Notes

- **Browser Support**: GSAP works in all modern browsers including IE11
- **Performance**: `transform: translateX()` is GPU-accelerated, no layout thrashing
- **Accessibility**: Add `prefers-reduced-motion` media query support
- **Mobile**: Test on slower devices; consider reducing duration to 0.3s

### Accessibility Implementation

```tsx
useEffect(() => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) {
    // Skip animation, just show/hide
    gsap.set(overlayRef.current, { display: isActive ? 'flex' : 'none' });
    onComplete?.();
    return;
  }

  // ... normal animation code
}, [isActive]);
```

## ASCII Cat Art Options

### Simple (Recommended for transitions)
```
    /\_/\
   ( o.o )
    > ^ <
```

### Medium Detail
```
  /\_/\
 ( o.o )
  > ^ <
 /|   |\
(_|   |_)
```

### Sitting Cat
```
 /\_/\
( o.o )
 > ^ <
/|   |\
\|___|/
```

### CSS for ASCII Art
```css
.ascii-cat {
  font-family: 'Geist Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
  white-space: pre;
  line-height: 1.1;
  letter-spacing: -0.05em;
  text-align: center;
}
```

## Timing Recommendations

| Stage | Duration | Easing | Notes |
|-------|----------|--------|-------|
| Overlay In | 400-500ms | `power2.out` | Swift but controlled |
| Cat Fade In | 150-200ms | `power1.out` | Quick reveal |
| Pause | 200-400ms | - | Let users see the cat |
| Cat Fade Out | 100-150ms | `power1.in` | Quick exit |
| Overlay Out | 400-500ms | `power2.in` | Matches entrance momentum |

**Total duration**: ~1.2-1.8 seconds

**What makes it feel smooth**:
- Asymmetric easing (out on enter, in on exit)
- Overlapping animations (cat starts fading before overlay stops)
- Brief pause creates intentionality
- Consistent momentum throughout

## Related Effects to Explore

- **Staggered text reveal** - ASCII cat appears line by line
- **Typewriter effect** - Characters appear one by one
- **Multiple overlay stripes** - Several colored bars slide across
- **Clip-path reveal** - Use `clip-path: inset()` instead of transform

## Sources

### Demos & Codepens
- [Vue Page Transitions](https://codepen.io/fpvz/pen/KQwzGQ) - fpvz
- [Pure CSS Overlay](https://codepen.io/racpa/pen/EgvmXe) - racpa
- [Barba.js + GSAP](https://codepen.io/naseemshah/pen/KKpeOpy) - naseemshah
- [GSAP Menu Overlay](https://codepen.io/daafiejd/pen/bQMMRa) - daafiejd
- [ASCII Morph](https://github.com/tholman/ascii-morph) - Tim Holman

### Tutorials & Articles
- [GSAP Timeline Docs](https://gsap.com/docs/v3/GSAP/Timeline/) - GreenSock
- [GSAP React Integration](https://gsap.com/resources/React/) - GreenSock
- [CSS-Tricks - Animating with Clip-Path](https://css-tricks.com/animating-with-clip-path/)
- [Codrops - Rotated Overlays](https://tympanus.net/codrops/2019/04/18/how-to-create-and-animate-rotated-overlays/)
- [TanStack Router Framer Motion](https://tanstack.com/router/latest/docs/framework/react/how-to/integrate-framer-motion)

### Libraries & Documentation
- [GSAP](https://gsap.com/) - GreenSock Animation Platform
- [Framer Motion](https://motion.dev/) - React animation library
- [react-ascii-text](https://github.com/samuelweckstrom/react-ascii-text) - ASCII text React hook

### ASCII Art Resources
- [ASCII Art EU - Cats](https://www.asciiart.eu/animals/cats)
- [ASCII Art CSS Styling](https://briankhuu.com/blog/2015/01/14/css-style-for-ascii-art/)

### Timing & Easing
- [Easings.net](https://easings.net/) - Easing function visualizer
- [NN/G Animation Duration](https://www.nngroup.com/articles/animation-duration/) - Research on optimal timing

---

**Last Updated**: 2025-12-11
**Ready to Implement**: Yes
**Next Steps**: Install GSAP (`pnpm add gsap @gsap/react`), create the PageTransition component, integrate with TanStack Router navigation
