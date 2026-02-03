---
date: 2026-02-02T10:30:00+08:00
researcher: Claude
git_commit: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
branch: main
repository: jeevanpillaystudio/x
topic: "Undo/Redo & Version History for CLI-to-Web Sync Architecture"
tags: [research, version-history, undo-redo, convex, crdt, cli, sync, design-tools]
status: complete
last_updated: 2026-02-02
last_updated_by: Claude
related_research: thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md
---

# Research: Undo/Redo & Version History for CLI-to-Web Sync Architecture

**Date**: 2026-02-02T10:30:00+08:00
**Researcher**: Claude
**Git Commit**: 4f3712c3d08aa993919f1b087f67ebe4e578c56a
**Branch**: main
**Repository**: jeevanpillaystudio/x

## Research Question

How to implement version history and undo/redo for a code-driven design platform where:
1. Users edit a local JSON config file
2. A CLI tool watches and syncs changes to Convex
3. Users need app-level version control (independent of git)
4. The CLI should let users go back to previous versions

## Summary

**The recommended approach is a hybrid architecture using JSON Patches + Convex Timeline Component.**

Key findings:
1. **Convex has two purpose-built components**: Timeline (for undo/redo) and Table History (for audit logs)
2. **JSON Patch (RFC 6902)** is the most storage-efficient approach for storing diffs (~97% memory savings vs snapshots)
3. **CRDTs (Automerge/Yjs)** are ideal for CLI-to-web sync but may be overkill for single-user scenarios
4. **Firebase-style numbered versions** with rollback-as-new-version is the simplest UX pattern
5. **Append-only event log** provides maximum flexibility for time-travel

**Recommended Stack**:
- **Storage**: JSON Patches in Convex with periodic full snapshots
- **CLI**: Local version history using append-only log + `travels` library
- **Sync**: Debounced patches sent to Convex, not full state
- **Web**: Convex Timeline component for undo/redo UI

---

## Detailed Findings

### 1. Convex Version History Solutions

Convex doesn't expose its internal transaction log for time-travel, but provides two components:

#### Timeline Component (Recommended for Undo/Redo)

**Installation**: `npm install convex-timeline`

**Features**:
- Push/undo/redo operations per document
- Named checkpoints (persist even after pruning)
- Configurable history limits (auto-prune old nodes)
- Matches standard editor behavior (Google Docs, VSCode)

**Usage**:
```typescript
import { Timeline } from "convex-timeline";

const timeline = new Timeline(components.timeline, {
  maxNodesPerScope: { "doc:": 500 }  // Keep 500 versions per document
});

// In mutations
export const updateDesign = mutation({
  handler: async (ctx, { docId, newState }) => {
    const doc = timeline.forScope(`doc:${docId}`);
    await doc.push(ctx, newState);
    await ctx.db.patch(docId, newState);
  }
});

export const undo = mutation({
  handler: async (ctx, { docId }) => {
    const doc = timeline.forScope(`doc:${docId}`);
    const previousState = await doc.undo(ctx);
    if (previousState) await ctx.db.patch(docId, previousState);
  }
});

// Named checkpoints for milestones
export const createCheckpoint = mutation({
  handler: async (ctx, { docId, name }) => {
    await timeline.forScope(`doc:${docId}`).createCheckpoint(ctx, name);
  }
});
```

#### Table History Component (For Audit Logs)

**Installation**: `npm install convex-table-history`

**Features**:
- Complete audit trail with attribution (user, timestamp)
- Time-travel queries via `listSnapshot()`
- Automatic via database triggers

**When to use**: Compliance/audit requirements, not daily undo/redo.

---

### 2. Storage Strategies: Patches vs Snapshots

| Approach | Storage Efficiency | Undo Speed | Time Travel |
|----------|-------------------|------------|-------------|
| Full Snapshots | Poor (duplicates entire state) | O(1) | Easy |
| JSON Patches | Excellent (~97% savings) | O(n) replay | Forward-only |
| Patches + Periodic Snapshots | Good (best of both) | O(1) | Easy |
| Event Sourcing | Good | O(1) with snapshots | Full history |

**Winner: Patches + Periodic Snapshots**

Store patches for every change, but create full snapshots every N changes (e.g., 50-100). This enables:
- Fast undo via patch reversal
- Efficient storage via small diffs
- Time-travel by loading nearest snapshot + replaying patches

---

### 3. JSON Patch Implementation

**RFC 6902 JSON Patch** is the standard for expressing JSON document changes.

**Operations**: `add`, `remove`, `replace`, `move`, `copy`, `test`

**Example**:
```json
[
  { "op": "replace", "path": "/title", "value": "New Title" },
  { "op": "add", "path": "/elements/-", "value": { "type": "rect" } },
  { "op": "remove", "path": "/elements/0" }
]
```

#### Recommended Library: `travels`

**Why**: 97% memory savings, framework-agnostic, inverse patches for undo.

```typescript
import { createTravels } from 'travels';

const travels = createTravels({
  title: 'My Design',
  elements: []
});

// Track changes
travels.setState(draft => {
  draft.title = 'Updated Title';
  draft.elements.push({ type: 'rect', x: 0, y: 0 });
});

// Undo/redo
travels.back();     // Undo
travels.forward();  // Redo
travels.go(5);      // Jump to position 5
travels.reset();    // Back to initial state

// Get patches for sync
const patches = travels.getPatches();  // Send to server
```

**Memory Comparison (100 operations)**:
- Snapshot-based: 11.8 MB
- Travels (patches): 320 KB (~97% reduction)

#### Alternative: `immer` for React Projects

```typescript
import { produceWithPatches, enablePatches } from 'immer';
enablePatches();

const [nextState, patches, inversePatches] = produceWithPatches(
  state,
  draft => { draft.title = 'New'; }
);

// Store inversePatches for undo
undoStack.push(inversePatches);
```

---

### 4. CLI Version History Architecture

**Recommended: Append-Only Event Log + Local Snapshots**

```
.polychromos/
├── design.json           # Current state (materialized view)
├── events.jsonl          # Append-only change log
├── snapshots/
│   ├── 1706841600.json   # Periodic full snapshots
│   └── 1706842800.json
└── versions.sqlite       # Optional: SQLite for querying history
```

**Event Log Format** (events.jsonl):
```json
{"v":1,"ts":1706841000,"patches":[{"op":"replace","path":"/title","value":"Draft 1"}]}
{"v":2,"ts":1706841100,"patches":[{"op":"add","path":"/elements/0","value":{"type":"rect"}}]}
{"v":3,"ts":1706841200,"patches":[{"op":"replace","path":"/elements/0/x","value":100}]}
```

**CLI Commands**:
```bash
polychromos history          # List versions
polychromos undo             # Undo last change
polychromos redo             # Redo undone change
polychromos goto 5           # Jump to version 5
polychromos checkpoint "v1"  # Named checkpoint
polychromos restore "v1"     # Restore checkpoint
```

**Implementation Pseudocode**:
```typescript
class VersionManager {
  private eventsFile: string;
  private currentVersion: number;
  private undoStack: Patch[][];
  private redoStack: Patch[][];

  async recordChange(patches: Patch[], inversePatches: Patch[]) {
    // Append to event log
    await appendFile(this.eventsFile, JSON.stringify({
      v: ++this.currentVersion,
      ts: Date.now(),
      patches
    }) + '\n');

    // Push to undo stack
    this.undoStack.push(inversePatches);
    this.redoStack = [];  // Clear redo on new change

    // Periodic snapshot
    if (this.currentVersion % 50 === 0) {
      await this.createSnapshot();
    }
  }

  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) return false;
    const inversePatches = this.undoStack.pop()!;

    // Apply inverse patches to current state
    await this.applyPatches(inversePatches);

    // Record as new event (append-only)
    await this.recordChange(inversePatches, /* forward patches */);

    return true;
  }
}
```

---

### 5. Sync Architecture

**Critical Insight**: Sync *patches*, not full state.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Tool                            │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐    │
│  │  Chokidar  │──▶│  Debounce  │──▶│ Generate Patches │    │
│  │  Watcher   │   │  (300ms)   │   │   (immer/rfc6902) │   │
│  └────────────┘   └────────────┘   └──────────────────┘    │
│         │                                   │               │
│         ▼                                   ▼               │
│  ┌────────────┐                    ┌──────────────────┐    │
│  │ design.json│                    │ Local Event Log  │    │
│  └────────────┘                    │ (.polychromos/)  │    │
│                                    └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS: { patches, version }
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Convex Backend                          │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │   Mutation   │──▶│   Apply      │──▶│   Timeline     │  │
│  │   Handler    │   │   Patches    │   │   Component    │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│                              │                              │
│                              ▼                              │
│                     ┌──────────────┐                        │
│                     │   Document   │                        │
│                     │   Table      │                        │
│                     └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket: { newState }
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Web App                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ useQuery()   │──▶│    State     │──▶│  Canvas-Kit    │  │
│  │ Subscription │   │    Update    │   │   Renderer     │  │
│  └──────────────┘   └──────────────┘   └────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Undo/Redo UI                       │  │
│  │   [Undo] [Redo] | v3 of 10 | Checkpoint: "draft-1"   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Convex Mutation Handler**:
```typescript
import { applyPatch } from 'rfc6902';

export const applyChanges = mutation({
  args: {
    docId: v.id("designs"),
    patches: v.array(v.object({
      op: v.string(),
      path: v.string(),
      value: v.optional(v.any())
    })),
    clientVersion: v.number()
  },
  handler: async (ctx, { docId, patches, clientVersion }) => {
    const doc = await ctx.db.get(docId);

    // Conflict check
    if (doc.version !== clientVersion) {
      throw new Error("Version conflict - please refresh");
    }

    // Apply patches
    const newState = structuredClone(doc.state);
    applyPatch(newState, patches);

    // Save to timeline for undo/redo
    await timeline.forScope(`doc:${docId}`).push(ctx, newState);

    // Update document
    await ctx.db.patch(docId, {
      state: newState,
      version: doc.version + 1
    });
  }
});
```

---

### 6. CRDT Considerations

**When CRDTs are Worth It**:
- Multi-user simultaneous editing
- Offline-first with complex merge requirements
- Need character-level text merging

**When CRDTs are Overkill**:
- Single-user editing (your current use case)
- Server is always available for sync
- Property-level conflicts acceptable (last-write-wins)

**If You Need CRDTs Later**:
- **Automerge**: Full history, git-like workflows, ~30% overhead
- **Yjs**: Maximum performance, built-in UndoManager

---

### 7. Recommended Implementation Plan

**Phase 1: Basic Version History (MVP)**
1. Use `travels` library in CLI for local undo/redo
2. Store patches in `.polychromos/events.jsonl`
3. Sync full state to Convex (simpler initial implementation)
4. Use Convex Timeline for web-side undo/redo

**Phase 2: Efficient Sync**
1. Switch to patch-based sync (only send diffs)
2. Add periodic snapshots for fast loading
3. Implement conflict detection (version numbers)

**Phase 3: Named Versions & Time Travel**
1. Add checkpoint commands (`polychromos checkpoint "v1"`)
2. Implement `goto` command for time travel
3. Build version history UI in web app

**Phase 4: Collaboration (If Needed)**
1. Migrate to Automerge for CRDT-based sync
2. Implement per-user undo stacks
3. Add real-time presence indicators

---

## Code References

- `thoughts/shared/research/2026-02-02-code-driven-design-platform-architecture.md` - Original architecture research
- `packages/tools/canvas-kit/` - Existing canvas rendering implementation

---

## Open Questions

1. **Version Limits**: How many versions to keep? (Recommend: 500 in Timeline, unlimited in event log with snapshots every 50)
2. **Conflict UX**: What happens when CLI and web edit simultaneously? (Recommend: last-write-wins with conflict notification)
3. **Checkpoint Naming**: User-defined names or auto-generated? (Recommend: optional user names, auto timestamps)
4. **Sync Granularity**: Patch per keystroke or debounced? (Recommend: 300ms debounce + batch patches)

---

## Sources

### Convex Documentation
- [Convex Timeline Component](https://www.convex.dev/components/timeline)
- [Convex Table History Component](https://github.com/get-convex/table-history)
- [Throttling by Single-Flighting](https://stack.convex.dev/throttling-requests-by-single-flighting)

### Version History Patterns
- [How Figma's Multiplayer Technology Works](https://madebyevan.com/figma/how-figmas-multiplayer-technology-works/)
- [How to Build Undo/Redo in Multiplayer Environment | Liveblocks](https://liveblocks.io/blog/how-to-build-undo-redo-in-a-multiplayer-environment)
- [Event Sourcing Pattern | Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)

### JSON Patch Libraries
- [travels - GitHub](https://github.com/mutativejs/travels) - 97% memory savings
- [rfc6902 - npm](https://www.npmjs.com/package/rfc6902) - Standard compliance
- [Immer Patches Documentation](https://immerjs.github.io/immer/patches/)

### CRDT Resources
- [Automerge 2.0 Release](https://automerge.org/blog/automerge-2/)
- [Yjs UndoManager](https://docs.yjs.dev/api/undo-manager)
- [Building Real-Time Collaboration: OT vs CRDT | TinyMCE](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/)

### CLI Versioning Patterns
- [Terraform State Versions API](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/state-versions)
- [Firebase Remote Config Templates](https://firebase.google.com/docs/remote-config/templates)
- [The Log: What Every Software Engineer Should Know](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)
