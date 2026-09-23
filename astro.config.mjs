import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Set SITE_URL and BASE_PATH for a custom domain; CI derives both from Pages.
export default defineConfig({
  site: process.env.SITE_URL || 'https://kwiatens.github.io',
  base: process.env.BASE_PATH ?? '/Inventatory-Site',
  output: 'static',
  prefetch: false,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [starlight({
    title: 'inventatory',
    disable404Route: true,
    description: 'Local electronic component inventory. Desktop application and Scan R1 documentation.',
    favicon: '/favicon.svg',
    credits: false,
    customCss: ['./src/styles/docs.css'],
    components: {
      Header: './src/components/DocsHeader.astro',
      ThemeProvider: './src/components/DarkTheme.astro',
      ThemeSelect: './src/components/Empty.astro',
    },
    sidebar: [
      { label: 'Getting started', items: [
        { label: 'Introduction', slug: 'docs' },
        { label: 'Install on Windows', slug: 'docs/getting-started/installation' },
        { label: 'Your first inventory', slug: 'docs/getting-started/first-inventory' },
        { label: 'Navigation and controls', slug: 'docs/getting-started/basic-usage' },
      ]},
      { label: 'Desktop application', items: [
        { label: 'Stock management', slug: 'docs/desktop/stock' },
        { label: 'Racks and storage', slug: 'docs/desktop/racks' },
        { label: 'Component import', slug: 'docs/desktop/import' },
        { label: 'Projects and BOMs', slug: 'docs/desktop/projects' },
        { label: 'Inventory history', slug: 'docs/desktop/history' },
        { label: 'Backups and restore', slug: 'docs/desktop/backups' },
        { label: 'Settings and printing', slug: 'docs/desktop/settings' },
      ]},
      { label: 'Handheld scanner', items: [
        { label: 'Scan R1 overview', slug: 'docs/scanner' },
        { label: 'Connection and setup', slug: 'docs/scanner/setup' },
        { label: 'Using a paired scanner', slug: 'docs/scanner/usage' },
        { label: 'Hardware and firmware status', slug: 'docs/scanner/status' },
      ]},
      { label: 'Project resources', items: [
        { label: 'Contributing and support', slug: 'docs/resources' },
        { label: 'Downloads', link: '/download/' },
      ]},
    ],
  })],
});
