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

// Title-block cells along the bottom edge of the hero, like the corner of a drawing sheet.
export const titleBlock = [
  { label: 'Release', value: release.version, note: release.status },
  { label: 'License', value: 'GPL-3.0-only', note: 'Source on GitHub' },
  { label: 'Platform', value: 'Windows x64', note: 'Ubuntu 24.04 x86-64' },
  { label: 'Storage', value: 'Local SQLite', note: 'Your data folder' },
  { label: 'Scanner', value: 'Scan R1', note: 'Optional' },
];

export type StepFigure =
  | { kind: 'label' }
  | { kind: 'rack'; rack: string; slot: string }
  | { kind: 'bom' }
  | { kind: 'history' };

export interface Step {
  id: string;
  title: string;
  text: string;
  specs: { key: string; value: string }[];
  figure: StepFigure;
  media: { src: string; alt: string; width: number; height: number; position: string; zoom?: number } | null;
  mediaCaption: string;
  href: string;
}

export const steps: Step[] = [
  {
    id: 'receive',
    title: 'Receive parts',
    text: 'Scan a supported vendor label to fill in component details, or import your order.',
    specs: [
      { key: 'Input', value: 'DigiKey order CSV, vendor label scan' },
      { key: 'Review', value: 'Accept, correct, or skip each row' },
      { key: 'Enrich', value: 'DigiKey metadata, optional' },
    ],
    figure: { kind: 'label' },
    media: { src: '/media/stock.png', alt: 'Stock workspace with a capacitor created from a DigiKey code scan, showing its parameters, rack location, and links.', width: 1881, height: 970, position: '100% 0%', zoom: 1.9 },
    mediaCaption: 'Stock workspace, part created from a label scan',
    href: '/docs/desktop/import/',
  },
  {
    id: 'store',
    title: 'Put them away',
    text: 'Inventatory assigns eligible parts to rack slots and can print their labels automatically.',
    specs: [
      { key: 'Grid', value: '5 × 5 slots per rack' },
      { key: 'Assign', value: 'Manual, move, or automatic' },
      { key: 'Labels', value: 'Printed per component' },
    ],
    figure: { kind: 'rack', rack: 'R1', slot: 'B3' },
    media: null,
    mediaCaption: 'Racks workspace',
    href: '/docs/desktop/racks/',
  },
  {
    id: 'build',
    title: 'Build a board',
    text: 'Import your KiCad BOM and see exactly which rack slots hold the parts you need.',
    specs: [
      { key: 'Input', value: 'KiCad BOM' },
      { key: 'Compare', value: 'Need / Have per line, any board count' },
      { key: 'Shortages', value: 'Exported to CSV beside the BOM' },
      { key: 'Picking', value: 'One rack at a time' },
    ],
    figure: { kind: 'bom' },
    media: null,
    mediaCaption: 'Projects workspace',
    href: '/docs/desktop/projects/',
  },
  {
    id: 'recover',
    title: 'Undo anything',
    text: 'Every inventory change is recorded. Name a checkpoint, reverse a mistake, restore a validated backup.',
    specs: [
      { key: 'History', value: 'Before and after for each field' },
      { key: 'Checkpoints', value: 'Named snapshots' },
      { key: 'Backups', value: 'Validated before activation' },
    ],
    figure: { kind: 'history' },
    media: null,
    mediaCaption: 'History workspace',
    href: '/docs/desktop/history/',
  },
];

// Datasheet page: dense, factual feature list next to the system block diagram.
export const sheet = {
  title: 'Inventatory',
  subtitle: 'Local component inventory for electronics workbenches',
  description: 'A keyboard-driven terminal application that keeps stock, physical locations, board BOMs, and change history in one local database. The handheld scanner and label printer are optional.',
  features: [
    'Search by part, category, parameter, location, SKU, or quantity',
    'Per-part reorder thresholds and a guided stocktake',
    '5 × 5 rack grids with automatic slot assignment',
    'DigiKey order CSV import with per-row review',
    'KiCad BOM comparison with adjustable board count',
    'Rack-by-rack picking with confirmed stock subtraction',
    'Field-level history, named checkpoints, reversible changes',
    'Validated workspace backups',
    'Component and quick labels on the PC printer',
    'Paired handheld scanner over the local network',
  ],
  requirements: [
    { key: 'OS', value: 'Windows x64, Ubuntu 24.04 LTS x86-64' },
    { key: 'Interface', value: 'Terminal, keyboard first' },
    { key: 'Data', value: 'Local SQLite in your chosen folder' },
    { key: 'Network', value: 'Optional: DigiKey lookup, scanner sync' },
    { key: 'License', value: 'GPL-3.0-only' },
  ],
};

export const scanner = {
  title: 'Inventatory Scan R1',
  summary: 'A handheld companion for the bench. Scan a bag, set the quantity on the keypad, and the desktop inventory updates.',
  specs: [
    { key: 'Controller', value: 'ESP32-S3 (Tenstar ESP32-S3-Zero)' },
    { key: 'Scan engine', value: 'GM65 barcode module' },
    { key: 'Display', value: 'GMG12864-06D, 128 × 64 LCD' },
    { key: 'Input', value: '4 × 4 matrix keypad' },
    { key: 'Pairing', value: 'Bluetooth LE, six-digit code' },
    { key: 'Sync', value: 'Local network, authenticated' },
    { key: 'Offline', value: 'Scans queued until reconnect' },
    { key: 'Firmware', value: 'GPL-3.0-only, PlatformIO' },
  ],
  open: {
    title: 'Build it yourself',
    text: 'Everything needed to make a scanner is public. Take the firmware and wiring, and house it however you like.',
    cost: 'Free',
    // Real top-level entries of the firmware repository.
    tree: [
      { name: 'src/', note: 'Firmware, PlatformIO + Arduino' },
      { name: 'boards/', note: 'ESP32-S3-Zero definition' },
      { name: 'examples/', note: 'Display smoke test' },
      { name: 'test/', note: 'On-device Unity tests' },
      { name: 'README.md', note: 'Wiring and GPIO map' },
    ],
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
