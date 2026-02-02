import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import type { Operation } from "rfc6902";
import { applyPatch, createPatch } from "rfc6902";

export interface VersionEntry {
  v: number;
  ts: number;
  patches: Operation[];
  checkpoint?: string;
}

export class VersionManager {
  private directory: string;
  private eventsFile: string;
  private snapshotFile: string;
  private baseFile: string;
  private currentVersion = 0;
  private history: VersionEntry[] = [];
  private redoStack: VersionEntry[] = [];
  private lastSnapshot: unknown = null;
  private baseSnapshot: unknown = null;

  constructor(directory: string) {
    this.directory = directory;
    this.eventsFile = join(directory, "events.jsonl");
    this.snapshotFile = join(directory, "snapshot.json");
    this.baseFile = join(directory, "base.json");
  }

  async init(): Promise<void> {
    // Create .polychromos directory if needed
    try {
      await mkdir(this.directory, { recursive: true });
    } catch {
      // Directory already exists
    }

    // Load event log if it exists
    try {
      const content = await readFile(this.eventsFile, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      this.history = lines.map((line) => JSON.parse(line) as VersionEntry);
      this.currentVersion = this.history.length;
    } catch {
      // File doesn't exist yet
      this.history = [];
      this.currentVersion = 0;
    }

    // Load base snapshot (initial state for rebuilding)
    try {
      const baseContent = await readFile(this.baseFile, "utf-8");
      this.baseSnapshot = JSON.parse(baseContent);
    } catch {
      this.baseSnapshot = null;
    }

    // Load last snapshot
    try {
      const snapshotContent = await readFile(this.snapshotFile, "utf-8");
      this.lastSnapshot = JSON.parse(snapshotContent);
    } catch {
      this.lastSnapshot = null;
    }
  }

  async recordChange(data: unknown): Promise<void> {
    // Generate patches from the last known state
    const patches = this.lastSnapshot
      ? createPatch(this.lastSnapshot, data)
      : [];

    // Only record if there are actual changes
    if (patches.length === 0 && this.lastSnapshot !== null) {
      return;
    }

    // Save base snapshot on first record (for rebuilding state during undo)
    if (this.baseSnapshot === null) {
      this.baseSnapshot = structuredClone(data);
      await writeFile(this.baseFile, JSON.stringify(data, null, 2), "utf-8");
    }

    const entry: VersionEntry = {
      v: ++this.currentVersion,
      ts: Date.now(),
      patches,
    };

    // Append to event log
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.eventsFile, line);

    // Update in-memory state
    this.history.push(entry);
    this.lastSnapshot = structuredClone(data);
    this.redoStack = []; // Clear redo stack on new change

    // Save snapshot
    await writeFile(this.snapshotFile, JSON.stringify(data, null, 2), "utf-8");
  }

  async undo(): Promise<unknown> {
    if (this.history.length === 0) {
      console.log("Nothing to undo");
      return null;
    }

    const lastEntry = this.history.pop();
    if (!lastEntry) {
      return null;
    }

    this.redoStack.push(lastEntry);
    this.currentVersion--;

    // Revert by applying inverse patches
    if (this.lastSnapshot && lastEntry.patches.length > 0) {
      // To undo, we need to rebuild from the beginning or use inverse patches
      // For simplicity, rebuild from scratch
      const newState = this.rebuildState();
      this.lastSnapshot = newState;
      await writeFile(
        this.snapshotFile,
        JSON.stringify(newState, null, 2),
        "utf-8",
      );
      return newState;
    }

    return this.lastSnapshot;
  }

  async redo(): Promise<unknown> {
    if (this.redoStack.length === 0) {
      console.log("Nothing to redo");
      return null;
    }

    const entry = this.redoStack.pop();
    if (!entry) {
      return null;
    }

    this.history.push(entry);
    this.currentVersion++;

    // Apply patches to current state
    if (this.lastSnapshot && entry.patches.length > 0) {
      const newState = structuredClone(this.lastSnapshot);
      applyPatch(newState, entry.patches);
      this.lastSnapshot = newState;
      await writeFile(
        this.snapshotFile,
        JSON.stringify(newState, null, 2),
        "utf-8",
      );
      return newState;
    }

    return this.lastSnapshot;
  }

  async checkpoint(name: string): Promise<void> {
    const entry: VersionEntry = {
      v: this.currentVersion,
      ts: Date.now(),
      patches: [],
      checkpoint: name,
    };

    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.eventsFile, line);
    this.history.push(entry);

    console.log(
      `✓ Checkpoint "${name}" created at version ${this.currentVersion}`,
    );
  }

  list(): VersionEntry[] {
    return [...this.history];
  }

  getVersion(): number {
    return this.currentVersion;
  }

  private rebuildState(): unknown {
    // Rebuild state by applying all patches in order starting from the base snapshot
    if (this.baseSnapshot === null) {
      return null;
    }

    let state: unknown = structuredClone(this.baseSnapshot);

    for (const entry of this.history) {
      if (entry.patches.length > 0) {
        const newState = structuredClone(state);
        applyPatch(newState, entry.patches);
        state = newState;
      }
    }

    return state;
  }
}
