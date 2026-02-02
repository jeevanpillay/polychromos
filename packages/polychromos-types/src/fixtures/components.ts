import type { PolychromosComponent } from '../types';

export const simpleComponent: PolychromosComponent = {
  id: 'main',
  name: 'Main Component',
  width: 1024,
  height: 768,
  root: {
    id: 'root',
    type: 'box',
  },
};

export const componentWithTextRoot: PolychromosComponent = {
  id: 'text-comp',
  name: 'Text Component',
  width: 800,
  height: 600,
  root: {
    id: 'text-root',
    type: 'text',
    text: { content: 'Hello' },
  },
};
