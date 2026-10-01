import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Listed by hand, in reading order: a page's URL is its file name, so
 * regrouping the sidebar never moves a page.
 */
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting started',
      collapsed: false,
      items: ['quickstart', 'install'],
    },
    {
      type: 'category',
      label: 'Using Wisp',
      collapsed: false,
      items: ['cli', 'connectors', 'permissions', 'deploy-an-agent'],
    },
    {
      type: 'category',
      label: 'Building on Wisp',
      collapsed: false,
      items: ['adapter-contract', 'incident-bot'],
    },
    {
      type: 'category',
      label: 'Operating',
      collapsed: false,
      items: ['runs-and-restarts', 'runbook', 'security'],
    },
    'reference',
  ],
};

export default sidebars;
