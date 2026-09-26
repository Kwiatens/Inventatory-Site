// Homepage content.
// PLACEHOLDER COPY: every human-readable sentence in this file is temporary and will be
// replaced by the owner's own writing. Facts (formats, pins, versions) are sourced from the
// Inventatory-Software and Inventatory-Firmware repositories and should be re-checked on release.
import { release, site } from './site';

export const firmwareRepository = 'https://github.com/Kwiatens/Inventatory-Firmware';

export const hero = {
  title: ['Every component,', 'accounted for.'],
  summary: 'Open-source, terminal based hardware inventory management system.',
  primary: 'Choose your system',
  secondary: 'Explore features',
};

export interface Step {
  id: string;
  title: string;
  text: string;
  media: { src: string; alt: string; width: number; height: number; position: string; zoom?: number } | null;
  mediaCaption: string;
  href: string;
}

export const steps: Step[] = [
  {
    id: 'receive',
    title: 'Receive parts',
    text: 'Scan a supported vendor label to fill in component details, or import your order.',
    media: { src: '/media/stock.png', alt: 'Stock workspace with a capacitor created from a DigiKey code scan, showing its parameters, rack location, and links.', width: 1881, height: 970, position: '100% 0%', zoom: 1.9 },
    mediaCaption: 'Stock workspace, part created from a label scan',
    href: '/docs/desktop/import/',
  },
  {
    id: 'store',
    title: 'Put them away',
    text: 'Inventatory assigns eligible parts to rack slots and can print their labels automatically.',
    media: null,
    mediaCaption: 'Racks workspace',
    href: '/docs/desktop/racks/',
  },
  {
    id: 'build',
    title: 'Build a board',
    text: 'Import your KiCad BOM and see exactly which rack slots hold the parts you need.',
    media: null,
    mediaCaption: 'Projects workspace',
    href: '/docs/desktop/projects/',
  },
  {
    id: 'recover',
    title: 'Undo anything',
    text: 'Every inventory change is recorded. Name a checkpoint, reverse a mistake, restore a validated backup.',
    media: null,
    mediaCaption: 'History workspace',
    href: '/docs/desktop/history/',
  },
];

export const scanner = {
  title: 'Inventatory Scan R1',
  summary: 'A handheld companion for the bench. Scan a bag, set the quantity on the keypad, and the desktop inventory updates.',
  open: {
    title: 'Build it yourself',
    text: 'Everything needed to make a scanner is public. Take the firmware and wiring, and house it however you like.',
    cost: 'Free',
    links: [
      { label: 'Firmware on GitHub', href: firmwareRepository },
      { label: 'Scanner documentation', href: '/docs/scanner/' },
    ],
  },
  bundle: {
    title: 'Official CAD bundle',
    text: 'The enclosure and charging dock designed and tested alongside the firmware. Print it and it fits. Your purchase supports Inventatory.',
    revision: 'Rev A',
    contents: [
      { qty: '1', item: 'Scanner enclosure', note: 'Tested fit' },
      { qty: '1', item: 'Charging dock', note: 'Tested fit' },
      { qty: '—', item: 'Print-ready files', note: 'STL / 3MF' },
      { qty: '—', item: 'Source CAD', note: 'STEP' },
    ],
    price: '€ —',
    cta: 'Get the bundle',
    href: '#',
  },
};

export const nextSteps = [
  { label: 'Installation', href: '/docs/getting-started/installation/' },
  { label: 'Your first inventory', href: '/docs/getting-started/first-inventory/' },
  { label: 'Organize physical storage', href: '/docs/desktop/racks/' },
];

export { site, release };
