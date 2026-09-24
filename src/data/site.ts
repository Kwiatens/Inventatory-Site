export const site = {
  name: 'Inventatory',
  description: 'A local inventory system for electronic components, with a Windows desktop application and integrated handheld scanner.',
  repository: 'https://github.com/Kwiatens/Inventatory-Software',
  releases: 'https://github.com/Kwiatens/Inventatory-Software/releases',
};
export const release = {
  version: 'v0.2.0-rc.2',
  status: 'Prerelease',
  checked: '2026-09-22',
  url: site.releases + '/tag/v0.2.0-rc.2',
  package: site.releases + '/download/v0.2.0-rc.2/Inventatory-win-x64.zip',
};
export const nav = [
  { label: 'Overview', href: '/' },
  { label: 'Features', href: '/features/' },
  { label: 'Documentation', href: '/docs/' },
  { label: 'Download', href: '/download/' },
  { label: 'GitHub', href: site.repository },
];
// Shared page media. Homepage feature visuals are defined with their feature data below.
export const media = {
  screenshot: '/media/stock.png',
  screenshotWidth: 1881,
  screenshotHeight: 970,
  heroVideo: '',
  video: '',
  videoCaptions: '',
  videoDescription: 'The Stock workspace shows component categories, quantities, rack locations, electrical parameters, and the actions for the selected part.',
  scannerPhoto: '',
  scannerPhotoAlt: '',
};
export const features = [
  {
    title: 'Stock management',
    label: 'Stock',
    href: '/docs/desktop/stock/',
    text: 'Keep component records, quantities, electrical parameters, links, and notes together. Search, filter, and count your stock.',
    details: ['Search by part, category, parameter, location, SKU, or quantity.', 'Review selected component details alongside the inventory list.', 'Use per-part reorder thresholds and a guided stocktake.'],
    media: { kind: 'screenshot', src: '/media/stock.png', alt: 'Authentic Inventatory Stock workspace screenshot showing component categories, quantities, and a selected part’s details.', position: 'center', width: 1881, height: 970, video: '' },
  },
  {
    title: 'Physical storage',
    label: 'Racks',
    href: '/docs/desktop/racks/',
    text: 'Assign components to a rack and slot, move them between locations, and print labels for stored parts.',
    details: ['Work with a 5 × 5 rack grid.', 'Place, move, automatically assign, or unassign components.', 'Find project components one rack at a time.'],
    media: { kind: 'screenshot', src: '/media/stock.png', alt: 'Authentic Stock workspace screenshot cropped to the selected component’s assigned rack location.', position: 'right', width: 1881, height: 970, video: '' },
  },
  {
    title: 'Component import',
    label: 'Import',
    href: '/docs/desktop/import/',
    text: 'Review DigiKey order CSVs before accepting parts. Import KiCad BOMs into Projects for comparison with current stock.',
    details: ['File headers determine the import workflow.', 'Accept, correct, or skip DigiKey order rows.', 'Optionally enrich accepted parts with DigiKey metadata.'],
    media: { kind: 'illustration', src: '/media/feature-import.svg', alt: 'Illustration of an order file flowing into a collection of electronic components.', position: 'center', width: 720, height: 450, video: '' },
  },
  {
    title: 'Projects and BOMs',
    label: 'Projects',
    href: '/docs/desktop/projects/',
    text: 'Compare the parts needed for a board with the parts you have, inspect shortages, and follow a rack-by-rack picking workflow.',
    details: ['Adjust board count and choose between matching components.', 'Export shortages to CSV beside the BOM.', 'Confirm stock subtraction after picking; projects persist locally.'],
    media: { kind: 'illustration', src: '/media/feature-projects.svg', alt: 'Illustration of a circuit board and its component footprints.', position: 'center', width: 720, height: 450, video: '' },
  },
  {
    title: 'History and recovery',
    label: 'History',
    href: '/docs/desktop/history/',
    text: 'Inspect inventory changes, create named checkpoints, reverse changes, and make validated backups of the workspace.',
    details: ['Review before-and-after fields for parts and racks.', 'Restore a snapshot without removing earlier history.', 'Validate backup contents before activation and re-pair Scan R1 after restore.'],
    media: { kind: 'illustration', src: '/media/feature-history.svg', alt: 'Illustration of inventory change points and a recoverable checkpoint.', position: 'center', width: 720, height: 450, video: '' },
  },
  {
    title: 'Scanner and printing',
    label: 'Scan R1',
    href: '/docs/scanner/',
    text: 'Connect a paired handheld scanner to the desktop device service. Use the PC printer for component and quick labels.',
    details: ['Physically verified Bluetooth LE pairing, then local-network synchronization.', 'Authenticated device traffic with replay protection.', 'Optional background service keeps the paired PC available after the terminal closes.'],
    media: { kind: 'model', src: '/media/scan-r1-poster.png', alt: 'Three-quarter view of a digital Scan R1 enclosure model rendered from the supplied STEP file.', position: 'center', width: 1600, height: 900, video: '/media/scan-r1-turntable.webm' },
  },
];
export const homepageFeatureOrder = ['Stock', 'Racks', 'Projects', 'Import', 'Scan R1', 'History'];
