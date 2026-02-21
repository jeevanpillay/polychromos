# Convex Flat Storage Implementation Plan

## Overview

This plan implements the **flat storage with document-relational pattern** to solve the Convex 16-level nesting depth constraint. Since Polychromos is not in production, we'll implement a clean cut-over (no migration framework needed). The CLI will continue using nested `design.json` files locally, converting to/from flat format during sync.

**Key Decisions:**
- Full end-to-end implementation (schema, backend, frontend, CLI)
- CLI converts nested ↔ flat during sync
- Per-workspace patches for undo/redo (reconstruct nested format)
- Convex reactivity only (no Jotai/Zustand)

## Current State Analysis

### Problems Being Solved
1. **Convex 16-level nesting limit** (`convex/schema.ts:8`) - `data: v.any()` stores entire workspace as nested JSON
2. **Performance issues** - Entire workspace re-fetched on any element change
3. **No granular subscriptions** - All components re-render on any update
4. **Recursive children** (`types.ts:47`) - `children?: PolychromosElement[]` allows unlimited depth

### Key Files
- `apps/polychromos-app/convex/schema.ts` - Current nested schema
- `apps/polychromos-app/convex/workspaces.ts` - CRUD operations with event sourcing
- `packages/polychromos-types/src/types.ts` - TypeScript interfaces
- `packages/polychromos-types/src/validators.ts` - Zod validators
- `apps/polychromos-app/src/routes/index.tsx` - Frontend workspace rendering
- `apps/polychromos-app/src/components/element-renderers/box.tsx` - Recursive rendering
- `packages/polychromos/src/commands/dev.ts` - CLI sync loop

## Desired End State

After implementation:
1. **Unlimited nesting depth** - Elements stored flat with `parentId` references
2. **Granular real-time updates** - Only affected components re-render
3. **CLI compatibility** - Local `design.json` remains nested for easy editing
4. **Event sourcing preserved** - Undo/redo works by reconstructing nested format for patches
5. **Schema versioning** - Single `version` field at workspace level

### Verification Criteria
- [ ] Create workspace with 20+ levels of nesting
- [ ] Single element update only re-fetches that element's query
- [ ] CLI `dev` command syncs changes correctly
- [ ] CLI `undo`/`redo` commands work
- [ ] Export commands produce valid HTML/Tailwind

## What We're NOT Doing

- **Migration framework** - Not in production, clean cut-over instead
- **Per-element versioning** - Single workspace version, not three-level
- **Jotai/Zustand** - Using Convex reactivity only
- **Backward compatibility layer** - No need to read v1 format after cut-over
- **Local file format change** - `design.json` stays nested

## Implementation Approach

**Strategy**: Implement new flat schema alongside existing, then switch over completely.

**Order**:
1. Backend schema and queries/mutations
2. Frontend queries and rendering
3. CLI conversion layer
4. Event sourcing adaptation
5. Cut-over and cleanup

---

## Phase 1: Backend Schema & Core Queries

### Overview
Create the new flat Convex schema with `workspaces`, `components`, and `elements` tables. Implement core CRUD queries and mutations.

### Changes Required:

#### 1. New Convex Schema
**File**: `apps/polychromos-app/convex/schema.ts`
**Changes**: Replace existing schema with flat structure

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    version: v.string(), // Schema version: "2.0"
    settings: v.optional(
      v.object({
        defaultUnits: v.optional(v.union(v.literal("px"), v.literal("rem"))),
        rootFontSize: v.optional(v.number()),
      })
    ),
    tokens: v.optional(
      v.object({
        colors: v.optional(v.record(v.string(), v.string())),
        spacing: v.optional(v.record(v.string(), v.string())),
        fonts: v.optional(
          v.record(v.string(), v.object({ family: v.string() }))
        ),
      })
    ),
    rootComponentId: v.optional(v.id("components")), // Main component reference
    // Event sourcing fields
    eventVersion: v.number(),
    maxEventVersion: v.number(),
    occVersion: v.number(), // Renamed from 'version' for clarity
    // Ownership & timestamps
    ownerId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  components: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    width: v.number(),
    height: v.number(),
    rootElementId: v.optional(v.id("elements")),
  }).index("by_workspace", ["workspaceId"]),

  elements: defineTable({
    workspaceId: v.id("workspaces"),
    componentId: v.id("components"),
    parentId: v.optional(v.id("elements")), // null for root element
    type: v.union(
      v.literal("box"),
      v.literal("text"),
      v.literal("image"),
      v.literal("webgl")
    ),
    order: v.number(), // For sibling ordering

    // Position & dimensions
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.union(v.number(), v.string())),
    height: v.optional(v.union(v.number(), v.string())),

    // Layout properties
    layout: v.optional(
      v.object({
        display: v.optional(
          v.union(v.literal("flex"), v.literal("grid"), v.literal("block"))
        ),
        flexDirection: v.optional(
          v.union(v.literal("row"), v.literal("column"))
        ),
        justifyContent: v.optional(v.string()),
        alignItems: v.optional(v.string()),
        gap: v.optional(v.number()),
        gridTemplateColumns: v.optional(v.string()),
        gridTemplateRows: v.optional(v.string()),
      })
    ),

    // Spacing (stored as arrays for consistency)
    padding: v.optional(v.array(v.number())),
    margin: v.optional(v.array(v.number())),

    // Visual style
    style: v.optional(
      v.object({
        backgroundColor: v.optional(v.string()),
        borderRadius: v.optional(v.number()),
        border: v.optional(v.string()),
        opacity: v.optional(v.number()),
      })
    ),

    // Type-specific configs
    text: v.optional(
      v.object({
        content: v.string(),
        fontFamily: v.optional(v.string()),
        fontSize: v.optional(v.number()),
        fontWeight: v.optional(v.union(v.number(), v.string())),
        lineHeight: v.optional(v.union(v.number(), v.string())),
        color: v.optional(v.string()),
        textAlign: v.optional(v.string()),
      })
    ),
    image: v.optional(
      v.object({
        src: v.string(),
        alt: v.optional(v.string()),
        objectFit: v.optional(v.string()),
      })
    ),
    webgl: v.optional(
      v.object({
        shaderPath: v.string(),
        uniforms: v.optional(v.any()),
      })
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_component", ["componentId"])
    .index("by_parent", ["parentId", "order"]),

  // Event log for version history (unchanged)
  events: defineTable({
    workspaceId: v.id("workspaces"),
    version: v.number(),
    timestamp: v.number(),
    userId: v.string(),
    patches: v.array(
      v.object({
        op: v.string(),
        path: v.string(),
        value: v.optional(v.any()),
      })
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_version", ["workspaceId", "version"]),

  // CLI auth session management (unchanged)
  cliAuthSessions: defineTable({
    code: v.string(),
    status: v.string(),
    token: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_status_created", ["status", "createdAt"]),
});
```

#### 2. Workspace Queries
**File**: `apps/polychromos-app/convex/workspaces.ts`
**Changes**: Update queries for flat structure

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireWorkspaceAccess } from "./lib/auth";
import { createPatch, applyPatch, type Operation } from "rfc6902";
import {
  flattenWorkspace,
  reconstructWorkspace,
  type FlatWorkspaceData,
} from "./lib/flatten";

// Get workspace metadata only (without elements)
export const get = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(args.id);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    return workspace;
  },
});

// Get workspace with all components and elements (for CLI sync)
export const getFullWorkspace = query({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(args.id);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    const components = await ctx.db
      .query("components")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    const elements = await ctx.db
      .query("elements")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    return { workspace, components, elements };
  },
});

// List workspaces for current user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
  },
});

// Create workspace from nested data (CLI sends nested format)
export const create = mutation({
  args: {
    name: v.string(),
    data: v.any(), // Nested PolychromosWorkspace format
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    // Flatten the nested workspace data
    const flat = flattenWorkspace(args.data);

    // Create workspace
    const workspaceId = await ctx.db.insert("workspaces", {
      name: args.name,
      description: flat.workspace.description,
      version: "2.0",
      settings: flat.workspace.settings,
      tokens: flat.workspace.tokens,
      rootComponentId: undefined, // Set after creating components
      eventVersion: 0,
      maxEventVersion: 0,
      occVersion: 1,
      ownerId: identity.subject,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create components and elements
    let mainComponentId: string | undefined;

    for (const component of flat.components) {
      const componentId = await ctx.db.insert("components", {
        workspaceId,
        name: component.name,
        width: component.width,
        height: component.height,
        rootElementId: undefined, // Set after creating elements
      });

      // Create elements for this component
      let rootElementId: string | undefined;
      const elementIdMap = new Map<string, string>(); // old ID -> new ID

      for (const element of flat.elements.filter(
        (e) => e.componentId === component.tempId
      )) {
        const elementId = await ctx.db.insert("elements", {
          workspaceId,
          componentId,
          parentId: element.parentTempId
            ? (elementIdMap.get(element.parentTempId) as any)
            : undefined,
          type: element.type,
          order: element.order,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          layout: element.layout,
          padding: element.padding,
          margin: element.margin,
          style: element.style,
          text: element.text,
          image: element.image,
          webgl: element.webgl,
        });

        elementIdMap.set(element.tempId, elementId);

        if (!element.parentTempId) {
          rootElementId = elementId;
        }
      }

      // Update component with root element
      if (rootElementId) {
        await ctx.db.patch(componentId, { rootElementId: rootElementId as any });
      }

      // Track main component
      if (component.isMain) {
        mainComponentId = componentId;
      }
    }

    // Update workspace with root component
    if (mainComponentId) {
      await ctx.db.patch(workspaceId, {
        rootComponentId: mainComponentId as any,
      });
    }

    return workspaceId;
  },
});

// Update workspace from nested data (with event sourcing)
export const update = mutation({
  args: {
    id: v.id("workspaces"),
    data: v.any(), // Nested PolychromosWorkspace format
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity, workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.occVersion !== args.expectedVersion) {
      throw new Error("Version conflict");
    }

    // Reconstruct current state as nested format for patch calculation
    const currentNested = await reconstructWorkspaceNested(ctx, args.id);

    // Calculate patches
    const patches = createPatch(currentNested, args.data);
    if (patches.length === 0) {
      return { success: true, noChanges: true };
    }

    // Delete future events if we're branching
    if (workspace.eventVersion < workspace.maxEventVersion) {
      const futureEvents = await ctx.db
        .query("events")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
        .filter((q) => q.gt(q.field("version"), workspace.eventVersion))
        .collect();

      for (const event of futureEvents) {
        await ctx.db.delete(event._id);
      }
    }

    // Record event
    const newEventVersion = workspace.eventVersion + 1;
    await ctx.db.insert("events", {
      workspaceId: args.id,
      version: newEventVersion,
      timestamp: Date.now(),
      userId: identity.subject,
      patches,
    });

    // Flatten new data and update flat storage
    const flat = flattenWorkspace(args.data);

    // Delete all existing components and elements
    const existingComponents = await ctx.db
      .query("components")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    const existingElements = await ctx.db
      .query("elements")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    for (const element of existingElements) {
      await ctx.db.delete(element._id);
    }
    for (const component of existingComponents) {
      await ctx.db.delete(component._id);
    }

    // Insert new components and elements (same logic as create)
    let mainComponentId: string | undefined;

    for (const component of flat.components) {
      const componentId = await ctx.db.insert("components", {
        workspaceId: args.id,
        name: component.name,
        width: component.width,
        height: component.height,
        rootElementId: undefined,
      });

      let rootElementId: string | undefined;
      const elementIdMap = new Map<string, string>();

      for (const element of flat.elements.filter(
        (e) => e.componentId === component.tempId
      )) {
        const elementId = await ctx.db.insert("elements", {
          workspaceId: args.id,
          componentId,
          parentId: element.parentTempId
            ? (elementIdMap.get(element.parentTempId) as any)
            : undefined,
          type: element.type,
          order: element.order,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          layout: element.layout,
          padding: element.padding,
          margin: element.margin,
          style: element.style,
          text: element.text,
          image: element.image,
          webgl: element.webgl,
        });

        elementIdMap.set(element.tempId, elementId);
        if (!element.parentTempId) rootElementId = elementId;
      }

      if (rootElementId) {
        await ctx.db.patch(componentId, { rootElementId: rootElementId as any });
      }
      if (component.isMain) mainComponentId = componentId;
    }

    // Update workspace
    await ctx.db.patch(args.id, {
      settings: flat.workspace.settings,
      tokens: flat.workspace.tokens,
      rootComponentId: mainComponentId as any,
      eventVersion: newEventVersion,
      maxEventVersion: newEventVersion,
      occVersion: workspace.occVersion + 1,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Helper to reconstruct nested format from flat storage
async function reconstructWorkspaceNested(
  ctx: any,
  workspaceId: string
): Promise<any> {
  const workspace = await ctx.db.get(workspaceId);
  const components = await ctx.db
    .query("components")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();
  const elements = await ctx.db
    .query("elements")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  return reconstructWorkspace(workspace, components, elements);
}
```

#### 3. Flatten/Reconstruct Utilities
**File**: `apps/polychromos-app/convex/lib/flatten.ts` (NEW)
**Changes**: Create utility functions for nested ↔ flat conversion

```typescript
// Utilities for converting between nested and flat workspace formats

export interface FlatElement {
  tempId: string;
  componentId: string;
  parentTempId?: string;
  type: "box" | "text" | "image" | "webgl";
  order: number;
  x?: number;
  y?: number;
  width?: number | string;
  height?: number | string;
  layout?: any;
  padding?: number[];
  margin?: number[];
  style?: any;
  text?: any;
  image?: any;
  webgl?: any;
}

export interface FlatComponent {
  tempId: string;
  name: string;
  width: number;
  height: number;
  isMain: boolean;
}

export interface FlatWorkspaceData {
  workspace: {
    description?: string;
    settings?: any;
    tokens?: any;
  };
  components: FlatComponent[];
  elements: FlatElement[];
}

// Convert nested workspace to flat structure
export function flattenWorkspace(nested: any): FlatWorkspaceData {
  const components: FlatComponent[] = [];
  const elements: FlatElement[] = [];

  // Process each component
  for (const [key, component] of Object.entries(nested.components || {})) {
    const comp = component as any;
    const componentTempId = comp.id || key;

    components.push({
      tempId: componentTempId,
      name: comp.name || key,
      width: comp.width,
      height: comp.height,
      isMain: key === "main",
    });

    // Flatten element tree
    if (comp.root) {
      flattenElement(elements, comp.root, componentTempId, undefined, 0);
    }
  }

  return {
    workspace: {
      description: nested.description,
      settings: nested.settings,
      tokens: nested.tokens,
    },
    components,
    elements,
  };
}

function flattenElement(
  elements: FlatElement[],
  element: any,
  componentId: string,
  parentId: string | undefined,
  order: number
): void {
  const tempId = element.id || `el_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  elements.push({
    tempId,
    componentId,
    parentTempId: parentId,
    type: element.type,
    order,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    layout: element.layout,
    padding: normalizeSpacing(element.padding),
    margin: normalizeSpacing(element.margin),
    style: element.style,
    text: element.text,
    image: element.image,
    webgl: element.webgl,
  });

  // Recursively flatten children
  if (element.children) {
    element.children.forEach((child: any, index: number) => {
      flattenElement(elements, child, componentId, tempId, index);
    });
  }
}

// Normalize spacing to array format
function normalizeSpacing(
  spacing: number | [number, number] | [number, number, number, number] | undefined
): number[] | undefined {
  if (spacing === undefined) return undefined;
  if (typeof spacing === "number") return [spacing];
  return spacing as number[];
}

// Denormalize spacing back to original format
function denormalizeSpacing(
  spacing: number[] | undefined
): number | [number, number] | [number, number, number, number] | undefined {
  if (!spacing) return undefined;
  if (spacing.length === 1) return spacing[0];
  if (spacing.length === 2) return [spacing[0], spacing[1]];
  if (spacing.length === 4) return [spacing[0], spacing[1], spacing[2], spacing[3]];
  return spacing[0]; // Fallback
}

// Reconstruct nested format from flat data
export function reconstructWorkspace(
  workspace: any,
  components: any[],
  elements: any[]
): any {
  const result: any = {
    id: workspace._id,
    version: "1.0", // Output as v1.0 format for CLI
    name: workspace.name,
    settings: workspace.settings,
    tokens: workspace.tokens,
    components: {},
  };

  // Build element lookup by ID
  const elementMap = new Map(elements.map((e) => [e._id, e]));

  // Build children map (parentId -> sorted children)
  const childrenMap = new Map<string | null, any[]>();
  for (const element of elements) {
    const parentKey = element.parentId || null;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(element);
  }

  // Sort children by order
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  // Reconstruct each component
  for (const component of components) {
    const componentKey =
      workspace.rootComponentId === component._id ? "main" : component.name;

    result.components[componentKey] = {
      id: component._id,
      name: component.name,
      width: component.width,
      height: component.height,
      root: component.rootElementId
        ? reconstructElement(component.rootElementId, elementMap, childrenMap)
        : null,
    };
  }

  return result;
}

function reconstructElement(
  elementId: string,
  elementMap: Map<string, any>,
  childrenMap: Map<string | null, any[]>
): any {
  const element = elementMap.get(elementId);
  if (!element) return null;

  const children = childrenMap.get(elementId) || [];
  const reconstructedChildren = children.map((child) =>
    reconstructElement(child._id, elementMap, childrenMap)
  );

  const result: any = {
    id: element._id,
    type: element.type,
  };

  // Only include defined properties
  if (element.x !== undefined) result.x = element.x;
  if (element.y !== undefined) result.y = element.y;
  if (element.width !== undefined) result.width = element.width;
  if (element.height !== undefined) result.height = element.height;
  if (element.layout) result.layout = element.layout;
  if (element.padding) result.padding = denormalizeSpacing(element.padding);
  if (element.margin) result.margin = denormalizeSpacing(element.margin);
  if (element.style) result.style = element.style;
  if (element.text) result.text = element.text;
  if (element.image) result.image = element.image;
  if (element.webgl) result.webgl = element.webgl;
  if (reconstructedChildren.length > 0) result.children = reconstructedChildren;

  return result;
}
```

#### 4. Element Queries
**File**: `apps/polychromos-app/convex/elements.ts` (NEW)
**Changes**: Create element-level queries for granular subscriptions

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireWorkspaceAccess } from "./lib/auth";

// Get single element
export const get = query({
  args: { id: v.id("elements") },
  handler: async (ctx, args) => {
    const element = await ctx.db.get(args.id);
    if (!element) return null;

    // Verify access through workspace
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(element.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    return element;
  },
});

// Get children of an element (ordered)
export const getChildren = query({
  args: { parentId: v.id("elements") },
  handler: async (ctx, args) => {
    const parent = await ctx.db.get(args.parentId);
    if (!parent) return [];

    // Verify access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const workspace = await ctx.db.get(parent.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("elements")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

// Get all elements for a component
export const getByComponent = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.componentId);
    if (!component) return [];

    // Verify access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const workspace = await ctx.db.get(component.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("elements")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();
  },
});

// Get root element for a component
export const getRootElement = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.componentId);
    if (!component?.rootElementId) return null;

    // Verify access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(component.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    return await ctx.db.get(component.rootElementId);
  },
});
```

#### 5. Component Queries
**File**: `apps/polychromos-app/convex/components.ts` (NEW)
**Changes**: Create component-level queries

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";

// Get single component
export const get = query({
  args: { id: v.id("components") },
  handler: async (ctx, args) => {
    const component = await ctx.db.get(args.id);
    if (!component) return null;

    // Verify access through workspace
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(component.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    return component;
  },
});

// Get all components for a workspace
export const getByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("components")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

// Get main component for a workspace
export const getMain = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Verify access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace?.ownerId || workspace.ownerId !== identity.subject) {
      return null;
    }

    if (!workspace.rootComponentId) return null;

    return await ctx.db.get(workspace.rootComponentId);
  },
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter @repo/app exec npx convex dev` runs without schema errors
- [ ] `pnpm typecheck` passes with no errors
- [ ] Create test mutations that insert 50+ level deep element trees

#### Manual Verification:
- [ ] Convex dashboard shows new tables (workspaces, components, elements)
- [ ] Indexes appear correctly in Convex dashboard

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the schema deployed correctly before proceeding to Phase 2.

---

## Phase 2: Undo/Redo with Flat Storage

### Overview
Update undo/redo mutations to work with flat storage while maintaining JSON patch event sourcing.

### Changes Required:

#### 1. Update Undo Mutation
**File**: `apps/polychromos-app/convex/workspaces.ts`
**Changes**: Add undo mutation that reconstructs nested format for patch replay

```typescript
// Add to workspaces.ts

export const undo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { identity, workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion <= 0) {
      return { success: false, message: "Nothing to undo" };
    }

    // Get events up to eventVersion - 1
    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .filter((q) => q.lte(q.field("version"), workspace.eventVersion - 1))
      .order("asc")
      .collect();

    // We need to get the base state (empty workspace) and replay events
    // For now, we'll use a stored baseNested if available, or reconstruct
    const baseNested = await getBaseNestedState(ctx, args.id);

    // Replay events on base state
    const state = structuredClone(baseNested);
    for (const event of events) {
      applyPatch(state, event.patches as Operation[]);
    }

    // Flatten the resulting state and update storage
    const flat = flattenWorkspace(state);

    // Delete existing components and elements
    const existingComponents = await ctx.db
      .query("components")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();
    const existingElements = await ctx.db
      .query("elements")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    for (const element of existingElements) {
      await ctx.db.delete(element._id);
    }
    for (const component of existingComponents) {
      await ctx.db.delete(component._id);
    }

    // Insert new flattened state (same as update)
    let mainComponentId: string | undefined;
    for (const component of flat.components) {
      const componentId = await ctx.db.insert("components", {
        workspaceId: args.id,
        name: component.name,
        width: component.width,
        height: component.height,
        rootElementId: undefined,
      });

      let rootElementId: string | undefined;
      const elementIdMap = new Map<string, string>();

      for (const element of flat.elements.filter(
        (e) => e.componentId === component.tempId
      )) {
        const elementId = await ctx.db.insert("elements", {
          workspaceId: args.id,
          componentId,
          parentId: element.parentTempId
            ? (elementIdMap.get(element.parentTempId) as any)
            : undefined,
          type: element.type,
          order: element.order,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          layout: element.layout,
          padding: element.padding,
          margin: element.margin,
          style: element.style,
          text: element.text,
          image: element.image,
          webgl: element.webgl,
        });

        elementIdMap.set(element.tempId, elementId);
        if (!element.parentTempId) rootElementId = elementId;
      }

      if (rootElementId) {
        await ctx.db.patch(componentId, { rootElementId: rootElementId as any });
      }
      if (component.isMain) mainComponentId = componentId;
    }

    const newEventVersion = workspace.eventVersion - 1;

    await ctx.db.patch(args.id, {
      settings: flat.workspace.settings,
      tokens: flat.workspace.tokens,
      rootComponentId: mainComponentId as any,
      eventVersion: newEventVersion,
      occVersion: workspace.occVersion + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state, // Return nested format for CLI
      eventVersion: newEventVersion,
      occVersion: workspace.occVersion + 1,
    };
  },
});

export const redo = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { identity, workspace } = await requireWorkspaceAccess(ctx, args.id);

    if (workspace.eventVersion >= workspace.maxEventVersion) {
      return { success: false, message: "Nothing to redo" };
    }

    // Get next event
    const nextEvent = await ctx.db
      .query("events")
      .withIndex("by_workspace_version", (q) =>
        q.eq("workspaceId", args.id).eq("version", workspace.eventVersion + 1)
      )
      .first();

    if (!nextEvent) {
      return { success: false, message: "Event not found" };
    }

    // Reconstruct current nested state
    const currentNested = await reconstructWorkspaceNested(ctx, args.id);

    // Apply patches
    const state = structuredClone(currentNested);
    applyPatch(state, nextEvent.patches as Operation[]);

    // Flatten and update (same as undo)
    const flat = flattenWorkspace(state);

    // Delete and recreate (same pattern as undo)
    const existingComponents = await ctx.db
      .query("components")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();
    const existingElements = await ctx.db
      .query("elements")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.id))
      .collect();

    for (const element of existingElements) {
      await ctx.db.delete(element._id);
    }
    for (const component of existingComponents) {
      await ctx.db.delete(component._id);
    }

    let mainComponentId: string | undefined;
    for (const component of flat.components) {
      const componentId = await ctx.db.insert("components", {
        workspaceId: args.id,
        name: component.name,
        width: component.width,
        height: component.height,
        rootElementId: undefined,
      });

      let rootElementId: string | undefined;
      const elementIdMap = new Map<string, string>();

      for (const element of flat.elements.filter(
        (e) => e.componentId === component.tempId
      )) {
        const elementId = await ctx.db.insert("elements", {
          workspaceId: args.id,
          componentId,
          parentId: element.parentTempId
            ? (elementIdMap.get(element.parentTempId) as any)
            : undefined,
          type: element.type,
          order: element.order,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          layout: element.layout,
          padding: element.padding,
          margin: element.margin,
          style: element.style,
          text: element.text,
          image: element.image,
          webgl: element.webgl,
        });

        elementIdMap.set(element.tempId, elementId);
        if (!element.parentTempId) rootElementId = elementId;
      }

      if (rootElementId) {
        await ctx.db.patch(componentId, { rootElementId: rootElementId as any });
      }
      if (component.isMain) mainComponentId = componentId;
    }

    const newEventVersion = workspace.eventVersion + 1;

    await ctx.db.patch(args.id, {
      settings: flat.workspace.settings,
      tokens: flat.workspace.tokens,
      rootComponentId: mainComponentId as any,
      eventVersion: newEventVersion,
      occVersion: workspace.occVersion + 1,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      data: state,
      eventVersion: newEventVersion,
      occVersion: workspace.occVersion + 1,
    };
  },
});

// Helper to get base nested state for event replay
async function getBaseNestedState(ctx: any, workspaceId: string): Promise<any> {
  // For new flat storage, we need to store base state separately
  // Option 1: Store baseNested in workspace document
  // Option 2: Compute from first event (if no events, current state is base)

  const workspace = await ctx.db.get(workspaceId);

  // If no events, current state IS the base
  if (workspace.eventVersion === 0 && workspace.maxEventVersion === 0) {
    return await reconstructWorkspaceNested(ctx, workspaceId);
  }

  // Otherwise, we need the stored base state
  // This requires adding a baseNested field to workspace
  // For simplicity, let's reconstruct by replaying from empty
  return {
    id: workspace._id,
    version: "1.0",
    name: workspace.name,
    settings: workspace.settings,
    tokens: workspace.tokens,
    components: {},
  };
}
```

#### 2. Add baseNested Storage
**File**: `apps/polychromos-app/convex/schema.ts`
**Changes**: Add `baseNested` field to workspaces table for event replay

Add to workspaces table definition:
```typescript
baseNested: v.optional(v.any()), // Base state in nested format for event replay
```

Update create and update mutations to store `baseNested` when `eventVersion === 0`.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes
- [ ] Schema deploys successfully

#### Manual Verification:
- [ ] Create workspace, make changes, undo restores previous state
- [ ] Redo after undo re-applies changes
- [ ] Multiple undo/redo cycles work correctly

**Implementation Note**: After completing this phase, verify undo/redo works before proceeding to Phase 3.

---

## Phase 3: Frontend Rendering with Flat Data

### Overview
Update frontend components to query flat data and render recursively using element IDs.

### Changes Required:

#### 1. Update Index Route
**File**: `apps/polychromos-app/src/routes/index.tsx`
**Changes**: Query workspace and main component separately

```typescript
// In WorkspacePreview component

const workspace = useQuery(api.workspaces.get, { id: workspaceAsId });
const mainComponent = useQuery(api.components.getMain, {
  workspaceId: workspaceAsId,
});
const rootElement = useQuery(api.elements.getRootElement, {
  componentId: mainComponent?._id,
});

// Update rendering to use new data structure
```

#### 2. Create ElementTree Component
**File**: `apps/polychromos-app/src/components/element-tree.tsx` (NEW)
**Changes**: Recursive element renderer using ID-based queries

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Renderer } from "./renderer";

interface ElementTreeProps {
  elementId: Id<"elements">;
  tokens?: any;
}

export function ElementTree({ elementId, tokens }: ElementTreeProps) {
  const element = useQuery(api.elements.get, { id: elementId });
  const children = useQuery(api.elements.getChildren, { parentId: elementId });

  if (!element) return null;

  // Convert flat element to renderer-compatible format
  const elementData = {
    id: element._id,
    type: element.type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    layout: element.layout,
    padding: denormalizeSpacing(element.padding),
    margin: denormalizeSpacing(element.margin),
    style: element.style,
    text: element.text,
    image: element.image,
    webgl: element.webgl,
    // Children rendered separately
  };

  return (
    <ElementWrapper element={elementData} tokens={tokens}>
      {children?.map((child) => (
        <ElementTree key={child._id} elementId={child._id} tokens={tokens} />
      ))}
    </ElementWrapper>
  );
}

// Helper to denormalize spacing
function denormalizeSpacing(spacing?: number[]): number | [number, number] | [number, number, number, number] | undefined {
  if (!spacing) return undefined;
  if (spacing.length === 1) return spacing[0];
  if (spacing.length === 2) return [spacing[0], spacing[1]];
  if (spacing.length === 4) return [spacing[0], spacing[1], spacing[2], spacing[3]];
  return spacing[0];
}
```

#### 3. Update Box Renderer
**File**: `apps/polychromos-app/src/components/element-renderers/box.tsx`
**Changes**: Accept children as React children instead of `element.children`

```typescript
// Update Box component signature
interface BoxProps {
  element: Omit<PolychromosElement, 'children'>;
  tokens?: PolychromosWorkspace["tokens"];
  children?: React.ReactNode;
}

export function Box({ element, tokens, children }: BoxProps) {
  // ... existing style computation ...

  return (
    <div style={style} data-element-id={element.id}>
      {children}
    </div>
  );
}
```

#### 4. Update Canvas Container
**File**: `apps/polychromos-app/src/components/canvas-container.tsx`
**Changes**: Use ElementTree for rendering

```typescript
import { ElementTree } from "./element-tree";
import { Id } from "../convex/_generated/dataModel";

interface CanvasContainerProps {
  componentId: Id<"components">;
  rootElementId: Id<"elements">;
  tokens?: any;
  className?: string;
}

export function CanvasContainer({
  componentId,
  rootElementId,
  tokens,
  className,
}: CanvasContainerProps) {
  return (
    <div className={className} data-component-id={componentId}>
      <ElementTree elementId={rootElementId} tokens={tokens} />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build:app` succeeds
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Workspace renders correctly in browser
- [ ] Deep nesting (20+ levels) renders without errors
- [ ] Editing single element only triggers minimal re-renders

**Implementation Note**: After completing this phase, test rendering in the browser before proceeding to Phase 4.

---

## Phase 4: CLI Sync Integration

### Overview
Update CLI to convert between nested local format and flat server format during sync.

### Changes Required:

#### 1. Update Dev Command
**File**: `packages/polychromos/src/commands/dev.ts`
**Changes**: Use `getFullWorkspace` query and `update` mutation with nested data

```typescript
// Update initial fetch to use getFullWorkspace
const result = await withRetry(() =>
  convexClient.query("workspaces:getFullWorkspace" as never, {
    id: config.workspaceId,
  } as never)
);

// The sync remains the same - send nested data, server flattens
await syncWithSingleFlight(data);
```

#### 2. Update Undo Command
**File**: `packages/polychromos/src/commands/undo.ts`
**Changes**: Handle new response format

```typescript
// Result now includes nested data directly
const result = await convexClient.mutation("workspaces:undo" as never, {
  id: config.workspaceId,
} as never) as { success: boolean; data?: any; message?: string };

if (result.success && result.data) {
  await writeFile("design.json", JSON.stringify(result.data, null, 2));
}
```

#### 3. Update Redo Command
**File**: `packages/polychromos/src/commands/redo.ts`
**Changes**: Handle new response format (same as undo)

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm --filter polychromos build` succeeds
- [ ] `pnpm typecheck` passes

#### Manual Verification:
- [ ] `polychromos dev` watches and syncs changes
- [ ] `polychromos undo` restores previous version to design.json
- [ ] `polychromos redo` re-applies changes to design.json

**Implementation Note**: After completing this phase, test full CLI flow before proceeding to Phase 5.

---

## Phase 5: Testing & Cleanup

### Overview
Write tests, verify edge cases, and clean up unused code.

### Changes Required:

#### 1. Add Integration Tests
**File**: `apps/polychromos-app/convex/__tests__/workspaces.test.ts` (NEW)
**Changes**: Test flatten/reconstruct roundtrip

```typescript
import { describe, it, expect } from "vitest";
import { flattenWorkspace, reconstructWorkspace } from "../lib/flatten";

describe("flatten/reconstruct", () => {
  it("roundtrips simple workspace", () => {
    const original = {
      id: "ws_1",
      version: "1.0",
      name: "Test",
      components: {
        main: {
          id: "comp_1",
          name: "Main",
          width: 800,
          height: 600,
          root: {
            id: "el_1",
            type: "box",
            children: [
              { id: "el_2", type: "text", text: { content: "Hello" } },
            ],
          },
        },
      },
    };

    const flat = flattenWorkspace(original);
    // Simulate database IDs
    const mockWorkspace = { _id: "ws_1", ...flat.workspace };
    const mockComponents = flat.components.map((c, i) => ({
      _id: `comp_${i}`,
      ...c,
    }));
    const mockElements = flat.elements.map((e, i) => ({
      _id: `el_${i}`,
      ...e,
    }));

    const reconstructed = reconstructWorkspace(
      mockWorkspace,
      mockComponents,
      mockElements
    );

    expect(reconstructed.components.main.root.type).toBe("box");
    expect(reconstructed.components.main.root.children).toHaveLength(1);
  });

  it("handles deeply nested elements", () => {
    // Create 50-level deep nesting
    let root: any = { id: "el_0", type: "box" };
    let current = root;
    for (let i = 1; i < 50; i++) {
      const child = { id: `el_${i}`, type: "box" };
      current.children = [child];
      current = child;
    }
    current.children = [{ id: "el_50", type: "text", text: { content: "Deep!" } }];

    const workspace = {
      id: "ws_1",
      version: "1.0",
      name: "Deep Test",
      components: { main: { id: "c1", name: "Main", width: 100, height: 100, root } },
    };

    const flat = flattenWorkspace(workspace);
    expect(flat.elements.length).toBe(51);
  });
});
```

#### 2. Remove Old Schema Fields
**File**: `apps/polychromos-app/convex/schema.ts`
**Changes**: Remove deprecated fields after migration

Remove:
- `data: v.any()` (replaced by flat tables)
- `baseData: v.any()` (replaced by `baseNested`)

#### 3. Update Type Exports
**File**: `packages/polychromos-types/src/types.ts`
**Changes**: Add flat element types if needed by CLI

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm test` passes all tests
- [ ] `pnpm test:coverage` shows adequate coverage
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds for all packages

#### Manual Verification:
- [ ] Full workflow: create, edit, undo, redo, export
- [ ] Deep nesting (50+ levels) works end-to-end
- [ ] No console errors in browser
- [ ] CLI commands all work correctly

**Implementation Note**: Final verification before deployment.

---

## Testing Strategy

### Unit Tests
- Flatten/reconstruct roundtrip preserves all data
- Spacing normalization/denormalization
- Element ordering by `order` field
- Empty workspace handling
- Missing optional fields handling

### Integration Tests
- Create workspace with nested data
- Update workspace with changes
- Undo/redo cycle
- Deep nesting (50+ levels)
- Concurrent updates (OCC conflict detection)

### Manual Testing Steps
1. Create new workspace via CLI `polychromos init`
2. Start dev server `polychromos dev`
3. Edit `design.json` with 20+ levels of nesting
4. Verify changes appear in web app
5. Make more changes
6. Run `polychromos undo` - verify previous state
7. Run `polychromos redo` - verify restored state
8. Export to HTML/Tailwind - verify output

## Performance Considerations

- **Granular queries**: Each `useQuery` for element only subscribes to that element
- **Index usage**: `by_parent` index enables efficient children queries
- **Batch operations**: Full workspace update deletes and recreates all elements (acceptable for alpha)
- **Future optimization**: Implement incremental updates instead of full replacement

## References

- Research: `thoughts/shared/research/2026-02-04-convex-nesting-limit-solution-with-versioning.md`
- Current schema: `apps/polychromos-app/convex/schema.ts`
- Current types: `packages/polychromos-types/src/types.ts`
- CLI dev command: `packages/polychromos/src/commands/dev.ts`
- Frontend rendering: `apps/polychromos-app/src/components/element-renderers/box.tsx`
