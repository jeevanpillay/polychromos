import type { PolychromosElement } from '../types';

export const simpleBoxElement: PolychromosElement = {
  id: 'box1',
  type: 'box',
  width: 200,
  height: 100,
};

export const styledBoxElement: PolychromosElement = {
  id: 'styled-box',
  type: 'box',
  width: 300,
  height: 200,
  style: {
    backgroundColor: '#ff0000',
    borderRadius: 8,
    opacity: 0.5,
  },
};

export const flexBoxElement: PolychromosElement = {
  id: 'flex-box',
  type: 'box',
  layout: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
};

export const gridBoxElement: PolychromosElement = {
  id: 'grid-box',
  type: 'box',
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto',
  },
};

export const textElement: PolychromosElement = {
  id: 'text1',
  type: 'text',
  text: {
    content: 'Hello World',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
};

export const imageElement: PolychromosElement = {
  id: 'img1',
  type: 'image',
  width: 300,
  height: 200,
  image: {
    src: 'https://example.com/image.png',
    alt: 'Test image',
    objectFit: 'cover',
  },
};

export const webglElement: PolychromosElement = {
  id: 'gl1',
  type: 'webgl',
  width: 400,
  height: 300,
  webgl: {
    shaderPath: '/shaders/gradient.frag',
  },
};

export const nestedBoxElement: PolychromosElement = {
  id: 'parent',
  type: 'box',
  children: [
    { id: 'child1', type: 'text', text: { content: 'First' } },
    { id: 'child2', type: 'text', text: { content: 'Second' } },
  ],
};

export const deeplyNestedElement: PolychromosElement = {
  id: 'l1',
  type: 'box',
  children: [{
    id: 'l2',
    type: 'box',
    children: [{
      id: 'l3',
      type: 'text',
      text: { content: 'Deep' },
    }],
  }],
};

export const paddedBoxElement: PolychromosElement = {
  id: 'padded',
  type: 'box',
  padding: 16,
};

export const paddedBox2Tuple: PolychromosElement = {
  id: 'padded-2',
  type: 'box',
  padding: [16, 24],
};

export const paddedBox4Tuple: PolychromosElement = {
  id: 'padded-4',
  type: 'box',
  padding: [8, 16, 24, 32],
};
