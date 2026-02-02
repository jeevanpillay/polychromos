import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import { VersionManager } from '../version-manager';

describe('VersionManager', () => {
  beforeEach(() => {
    vol.reset();
    vi.useRealTimers();
  });

  describe('init', () => {
    it('creates .polychromos directory if it does not exist', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vol.existsSync('.polychromos')).toBe(true);
    });

    it('does not fail if directory already exists', async () => {
      vol.mkdirSync('.polychromos', { recursive: true });

      const vm = new VersionManager('.polychromos');
      await expect(vm.init()).resolves.not.toThrow();
    });

    it('loads existing event log version count', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1,"ts":1000,"patches":[]}\n{"v":2,"ts":2000,"patches":[]}\n{"v":3,"ts":3000,"patches":[]}\n',
      });

      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(3);
    });

    it('starts at version 0 if no event log exists', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(0);
    });
  });

  describe('recordChange', () => {
    it('increments version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      expect(vm.getVersion()).toBe(1);
    });

    it('appends to events.jsonl', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'first' });
      await vm.recordChange({ name: 'second' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8') as string;
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(2);

      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      expect(entry1.v).toBe(1);
      expect(entry2.v).toBe(2);
    });

    it('includes timestamp in entry', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ name: 'test' });

      const content = vol.readFileSync('.polychromos/events.jsonl', 'utf-8') as string;
      const entry = JSON.parse(content.trim());

      expect(entry.ts).toBe(now);
    });

    it('saves base snapshot on first change', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const data = { name: 'test', value: 42 };
      await vm.recordChange(data);

      const base = JSON.parse(vol.readFileSync('.polychromos/base.json', 'utf-8') as string);
      expect(base).toEqual(data);
    });

    it('clears redo stack on new change', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      await vm.undo();

      // After undo, redo should work
      await vm.recordChange({ v: 3 });

      // Redo stack should be cleared
      const result = await vm.redo();
      expect(result).toBeNull();
    });
  });

  describe('undo', () => {
    it('returns null when nothing to undo', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const result = await vm.undo();

      expect(result).toBeNull();
    });

    it('decrements version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      expect(vm.getVersion()).toBe(2);

      await vm.undo();
      expect(vm.getVersion()).toBe(1);
    });

    it('restores previous state', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });

      const result = await vm.undo();

      expect(result).toEqual({ value: 'first' });
    });

    it('updates snapshot file', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });
      await vm.undo();

      const snapshot = JSON.parse(vol.readFileSync('.polychromos/snapshot.json', 'utf-8') as string);
      expect(snapshot).toEqual({ value: 'first' });
    });
  });

  describe('redo', () => {
    it('returns null when nothing to redo', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const result = await vm.redo();

      expect(result).toBeNull();
    });

    it('increments version number', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.recordChange({ v: 2 });
      await vm.undo();
      expect(vm.getVersion()).toBe(1);

      await vm.redo();
      expect(vm.getVersion()).toBe(2);
    });

    it('restores undone state', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ value: 'first' });
      await vm.recordChange({ value: 'second' });
      await vm.undo();

      const result = await vm.redo();

      expect(result).toEqual({ value: 'second' });
    });
  });

  describe('checkpoint', () => {
    it('creates checkpoint entry with name', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      await vm.recordChange({ v: 1 });
      await vm.checkpoint('release-v1');

      const history = vm.list();
      const checkpoint = history.find(e => e.checkpoint === 'release-v1');

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.patches).toEqual([]);
    });
  });

  describe('list', () => {
    it('returns empty array if no events', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = vm.list();

      expect(history).toEqual([]);
    });

    it('returns all events in order', async () => {
      vol.fromJSON({
        '.polychromos/events.jsonl': '{"v":1,"ts":1000,"patches":[]}\n{"v":2,"ts":2000,"patches":[]}\n',
      });

      const vm = new VersionManager('.polychromos');
      await vm.init();

      const history = vm.list();

      expect(history).toHaveLength(2);
      expect(history[0].v).toBe(1);
      expect(history[1].v).toBe(2);
    });
  });

  describe('getVersion', () => {
    it('returns current version', async () => {
      const vm = new VersionManager('.polychromos');
      await vm.init();

      expect(vm.getVersion()).toBe(0);

      await vm.recordChange({ value: 1 });
      expect(vm.getVersion()).toBe(1);

      await vm.recordChange({ value: 2 });
      expect(vm.getVersion()).toBe(2);
    });
  });
});
