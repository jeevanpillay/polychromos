---
date: 2026-02-02T16:30:00+08:00
researcher: Claude
git_commit: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
branch: main
repository: jeevanpillaystudio/x
topic: "Code-Driven Design Platform Architecture - CLI-to-Web Sync Evaluation"
tags: [research, architecture, real-time, convex, canvas-kit, design-tools, cli]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
---

# Research: Code-Driven Design Platform Architecture

**Date**: 2026-02-02T16:30:00+08:00
**Researcher**: Claude
**Git Commit**: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
**Branch**: main
**Repository**: jeevanpillaystudio/x

## Research Question

Evaluate the feasibility and performance characteristics of a code-driven design platform with:
1. A web app for rendering/previewing designs
2. A CLI tool that watches a local JSON file and syncs changes to the web app via Convex
3. Real-time client-side updates without page refresh

## Summary

**The proposed architecture is technically feasible and well-suited for the use case.** Based on comprehensive research:

1. **Convex is well-suited** for this CLI-to-web sync pattern with <20ms median mutation latency, automatic WebSocket subscriptions, and exactly-once execution semantics
2. **File watching with chokidar** (industry standard) + 100-300ms debouncing handles rapid JSON edits reliably
3. **Performance is viable** for design tool workloads - Convex sustains sub-50ms latency at 5,000 concurrent connections
4. **Existing patterns validate the approach** - tools like Tailwind CSS watch, ESLint watch, and design builders (Puck, Builder.io) use similar architectures

**Key considerations:**
- Debounce file changes (300ms recommended) to prevent excessive mutations
- Use `ConvexHttpClient` for CLI (simpler than WebSocket client for one-way sync)
- Keep JSON payloads under 125 bytes for optimal WebSocket framing when possible
- Implement single-flighting to prevent mutation pile-up during rapid edits

---

## Detailed Findings

### 1. Existing Canvas-Kit Implementation

**Location**: `packages/tools/canvas-kit/`

**Current Architecture**:
- React-based canvas rendering with fixed pixel dimensions
- Uses `html-to-image` library for exporting DOM to WebP/SVG
- `ImageCanvas` component: renders children at exact pixel dimensions
- `ExportControls` component: format selection (WebP/SVG), resolution multipliers (1x-4x)
- Font embedding handled via base64 data URLs for Joyride fonts

**Key Files**:
- `src/components/image-canvas.tsx:35-65` - Fixed-dimension canvas with export capability
- `src/lib/export.ts:61-86` - WebP export using `toCanvas` with font embedding
- `src/lib/export.ts:91-98` - SVG export using `toSvg`

**Current Exports**:
```typescript
export { ImageCanvas, ImageCanvasRef, ImageCanvasProps }
export { ExportControls, ExportControlsProps }
export { exportElement, exportToWebP, exportToSVG, downloadBlob, downloadSVG }
```

**Limitation**: Current implementation is purely client-side with no sync capabilities. The proposed architecture would add the server sync layer.

---

### 2. Convex Real-Time Sync Architecture

**Technical Characteristics**:

| Metric | Value |
|--------|-------|
| Median mutation latency | <20ms |
| Sustained latency at 5k connections | Sub-50ms |
| Query/mutation execution limit | 1 second |
| Max data per mutation | 16 MiB |
| Professional tier concurrent mutations | 256 |
| Monthly function calls (Professional) | 25M |

**How It Works**:
1. Client libraries connect via WebSocket
2. Sync worker manages sessions and serves as intermediary
3. Subscription manager detects transaction log intersections with active query read sets
4. Updates pushed automatically to all subscribed clients at same logical timestamp

**For CLI-to-Web Pattern**:

**Recommended: `ConvexHttpClient`** for CLI tools:
```typescript
import { ConvexHttpClient } from "convex/browser";
const client = new ConvexHttpClient(process.env.CONVEX_URL);
await client.mutation(api.canvas.update, { data: jsonData });
```

**Alternative: Direct HTTP API**:
```typescript
const response = await fetch("https://your-deployment.convex.cloud/api/mutation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    path: "canvas:update",
    args: { data: jsonData },
    format: "json"
  })
});
```

**Key Guarantees**:
- **Exactly-once execution**: Despite retries, mutations execute once
- **Serial execution**: From single clients, prevents race conditions
- **Atomic transactions**: All writes commit together or rollback
- **Automatic client sync**: All subscriptions update to same logical database moment

---

### 3. CLI File-Watching Patterns

**Recommended Stack**:

**File Watching: Chokidar v5.0.0+**
- Industry standard (30M+ repositories, powers Webpack, Vite)
- Native OS APIs: inotify (Linux), FSEvents (macOS), ReadDirectoryChangesW (Windows)
- Handles atomic writes (editors like Vim write to temp then rename)

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch('design.json', {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 100
  },
  atomic: 100  // Handle atomic editor writes
});
```

**Debouncing Strategy**:
```typescript
import debounce from 'lodash.debounce';

const syncToConvex = debounce(async (path: string) => {
  const json = JSON.parse(await fs.readFile(path, 'utf8'));
  await client.mutation(api.canvas.update, { data: json });
}, 300, {
  leading: false,
  trailing: true,
  maxWait: 1000  // Force sync after 1s continuous editing
});

watcher.on('change', syncToConvex);
```

**JSON Validation with AJV**:
```typescript
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validate = ajv.compile(canvasSchema);

function validateConfig(data: unknown) {
  if (!validate(data)) {
    const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`);
    throw new Error(`Invalid config:\n${errors?.join('\n')}`);
  }
  return data;
}
```

---

### 4. Performance Evaluation

**Latency Chain Analysis**:

| Stage | Typical Latency | Notes |
|-------|----------------|-------|
| File change detection | <10ms | Native OS events |
| Debounce wait | 300ms | Configurable |
| JSON parse + validate | <5ms | For typical design files |
| Convex mutation | <20ms median | Network dependent |
| WebSocket push | <10ms | After mutation commits |
| React re-render | 16ms | 60fps frame budget |
| **Total** | **~350-400ms** | Debounce dominates |

**Without debounce**: ~50-100ms end-to-end (but risks overwhelming server during rapid edits)

**Payload Size Considerations**:
- WebSocket frames: 2 bytes overhead for messages ≤125 bytes
- Convex mutation limit: 16 MiB (more than sufficient)
- For large designs: consider delta updates (only changed properties)

**Scalability**:
- Single user editing: No concerns
- Multiple users viewing same canvas: Convex handles well (sub-50ms at 5k connections)
- Mutation throughput: 256 concurrent (Professional tier), single-flighting recommended anyway

---

### 5. Comparable Tools and Patterns

**Design Builders Using Similar Patterns**:

| Tool | Architecture | Data Storage |
|------|-------------|--------------|
| **Puck** | React + JSON config | JSON in database/API |
| **Builder.io** | Component registration + JSON | Cloud API |
| **GrapesJS** | Headless editor | JSON/REST API |
| **Plasmic** | Dual delivery (runtime + codegen) | Headless CMS |

**File-Watching Tools**:

| Tool | Debounce | Approach |
|------|----------|----------|
| ESLint watch | 300ms | Incremental lint |
| Webpack | 20ms | Aggregated rebuilds |
| Tailwind CSS | Incremental | Only new classes |
| nodemon | Configurable | Process restart |

**Key Pattern**: All production tools use debouncing + incremental updates to prevent thrashing.

---

### 6. Potential Issues and Mitigations

**Issue 1: Mutation Pile-up During Rapid Editing**
- **Problem**: User holds key, 100 file saves in 1 second
- **Mitigation**: Single-flighting pattern - only one mutation in-flight at a time
```typescript
let pendingMutation: Promise<void> | null = null;
let pendingData: CanvasData | null = null;

async function syncWithSingleFlight(data: CanvasData) {
  pendingData = data;
  if (pendingMutation) return; // Previous still in-flight

  while (pendingData) {
    const toSync = pendingData;
    pendingData = null;
    pendingMutation = client.mutation(api.canvas.update, { data: toSync });
    await pendingMutation;
  }
  pendingMutation = null;
}
```

**Issue 2: Network Disconnection**
- **Problem**: CLI loses connection mid-edit
- **Mitigation**:
  - Queue changes locally during disconnect
  - Exponential backoff with jitter for reconnection
  - Process queue on reconnect

**Issue 3: Invalid JSON During Editing**
- **Problem**: User saves mid-edit, JSON is incomplete
- **Mitigation**:
  - Validate before sync, skip invalid
  - Use `awaitWriteFinish` in chokidar
  - Show validation errors in CLI

**Issue 4: Large Design Files**
- **Problem**: 5MB+ JSON files slow to parse/sync
- **Mitigation**:
  - Delta updates (only changed portions)
  - Compression for payloads >1KB
  - Consider Protocol Buffers for 40% size reduction

---

### 7. Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Tool                            │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   Chokidar   │──▶│   Debounce   │──▶│ ConvexHttpClient│  │
│  │ File Watcher │   │   (300ms)    │   │    Mutation    │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│         │                                       │           │
│         ▼                                       ▼           │
│  ┌──────────────┐                     ┌────────────────┐   │
│  │ design.json  │                     │  Single-Flight │   │
│  │   (local)    │                     │    Control     │   │
│  └──────────────┘                     └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS mutation
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Convex Backend                          │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   Mutation   │──▶│   Database   │──▶│  Subscription  │  │
│  │   Handler    │   │    Update    │   │    Manager     │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket push
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Web App                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ConvexReact   │──▶│    Query     │──▶│  Canvas-Kit    │  │
│  │   Client     │   │ Subscription │   │   Renderer     │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Code References

- `packages/tools/canvas-kit/src/components/image-canvas.tsx:35-65` - Current ImageCanvas implementation
- `packages/tools/canvas-kit/src/lib/export.ts:61-86` - WebP export with font embedding
- `packages/tools/canvas-kit/package.json:29` - html-to-image dependency

---

## Historical Context

No prior research documents found specifically addressing CLI-to-server sync patterns for this codebase. The canvas-kit package appears to be a recent addition focused on client-side image generation.

---

## Open Questions

1. **JSON Schema Design**: What structure should the design JSON follow? Component tree? Property-based like Figma?
2. **Multi-User Support**: Will multiple users edit the same canvas? If so, conflict resolution needed (consider property-level LWW like Figma)
3. **Authentication**: How should CLI authenticate? Browser OAuth flow or API token?
4. **Undo/Redo**: Should the platform support history? Adds complexity to sync protocol
5. **Component Library**: Will users have custom React components, or fixed set?

---

## Conclusion

**The proposed architecture is viable and performant for the use case.**

Key recommendations:
1. Use **Convex** - its real-time primitives match the requirements well
2. Use **chokidar** with 300ms debounce for file watching
3. Implement **single-flighting** to prevent mutation pile-up
4. Start with **full-state sync**, add delta updates if performance requires
5. Use **AJV** for JSON schema validation before sync

Expected end-to-end latency: **~350-400ms** with debouncing (dominated by debounce time, not network)
Without debouncing: **~50-100ms** but with thrashing risk

The approach aligns with production patterns used by tools like Builder.io, Puck, Tailwind CSS watch mode, and similar code-driven design systems.

---

## Sources

### Convex Documentation
- [Convex Overview](https://docs.convex.dev/understanding/)
- [How Convex Works](https://stack.convex.dev/how-convex-works)
- [JavaScript Client](https://docs.convex.dev/client/javascript)
- [Limits Documentation](https://docs.convex.dev/production/state/limits)
- [Throttling by Single-Flighting](https://stack.convex.dev/throttling-requests-by-single-flighting)

### File Watching
- [Chokidar GitHub](https://github.com/paulmillr/chokidar)
- [AJV JSON Schema Validator](https://ajv.js.org/)

### Design Tools
- [Puck - Open Source Visual Editor](https://github.com/measuredco/puck)
- [Builder.io React Integration](https://www.builder.io/m/react)
- [GrapesJS Documentation](https://grapesjs.com/docs/)

### Real-Time Patterns
- [WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices)
- [How Figma's Multiplayer Works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
