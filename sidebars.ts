import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Listed by hand, in reading order: a page's URL is its file name, so
 * regrouping the sidebar never moves a page.
 */
const sidebars: SidebarsConfig = {
  howItWorksSidebar: [
    'index',
    'how-it-works/overview',
    'how-it-works/agent',
    'how-it-works/kernel',
    'how-it-works/encryption',
    'how-it-works/proxy',
    'how-it-works/tee',
    'how-it-works/llm',
    'how-it-works/glossary',
  ],
  desktopSidebar: ['desktop/app', 'desktop/transcript'],
  runtimeSidebar: [
    'runtime',
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
