import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Wisp',
  tagline: 'The agent runtime you run yourself',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://docs.usewisp.io',
  // The site has an origin of its own, so nothing is prefixed. Docusaurus bakes
  // `baseUrl` into every asset URL at build time — it is pinned for the site's
  // life, and behind a proxy a wrong one 404s every stylesheet.
  baseUrl: '/',

  organizationName: 'ConfidentialCrabComputing',
  projectName: 'wisp-docs',

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // The whole site is the documentation: no landing page in front of it
          // and no `/docs` segment in front of every page.
          routeBasePath: '/',
          editUrl: 'https://github.com/ConfidentialCrabComputing/wisp-docs/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Wisp',
      items: [
        {to: '/quickstart', label: 'Quickstart', position: 'left'},
        {href: 'https://usewisp.io', label: 'usewisp.io', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} Wisp`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
