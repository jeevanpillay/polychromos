import type { PolychromosWorkspace } from '../types';

export const minimalWorkspace: PolychromosWorkspace = {
  id: 'ws_minimal',
  version: '1.0',
  name: 'Minimal Workspace',
  components: {
    main: {
      id: 'main',
      name: 'Main Component',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const workspaceWithSettings: PolychromosWorkspace = {
  id: 'ws_settings',
  version: '1.0',
  name: 'Workspace with Settings',
  settings: {
    defaultUnits: 'px',
    rootFontSize: 16,
  },
  components: {
    main: {
      id: 'main',
      name: 'Main',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const workspaceWithTokens: PolychromosWorkspace = {
  id: 'ws_tokens',
  version: '1.0',
  name: 'Workspace with Tokens',
  tokens: {
    colors: { primary: '#3b82f6', background: '#ffffff' },
    spacing: { sm: '8px', md: '16px' },
    fonts: { sans: { family: 'Geist Sans' } },
  },
  components: {
    main: {
      id: 'main',
      name: 'Main',
      width: 1024,
      height: 768,
      root: { id: 'root', type: 'box' },
    },
  },
};

export const fullWorkspace: PolychromosWorkspace = {
  id: 'ws_full',
  version: '1.0',
  name: 'Full Workspace',
  settings: {
    defaultUnits: 'px',
    rootFontSize: 16,
  },
  tokens: {
    colors: {
      primary: '#3b82f6',
      background: '#ffffff',
      foreground: '#000000',
    },
    spacing: {
      sm: '8px',
      md: '16px',
      lg: '24px',
    },
  },
  components: {
    main: {
      id: 'main',
      name: 'Main Component',
      width: 1024,
      height: 768,
      root: {
        id: 'root',
        type: 'box',
        layout: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        },
        width: '100%',
        height: '100%',
        style: {
          backgroundColor: '#ffffff',
        },
        children: [
          {
            id: 'title',
            type: 'text',
            text: {
              content: 'Welcome',
              fontSize: 32,
              fontWeight: 'bold',
              color: '#000000',
            },
          },
          {
            id: 'subtitle',
            type: 'text',
            text: {
              content: 'Edit to see changes',
              fontSize: 16,
              color: '#666666',
            },
            margin: [16, 0, 0, 0],
          },
        ],
      },
    },
  },
};
