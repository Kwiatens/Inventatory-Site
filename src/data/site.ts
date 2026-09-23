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
// Add only authentic media. A recording is optional; the screenshot remains the fallback.
export const media = {
  screenshot: '/media/stock.png',
  screenshotWidth: 1881,
  screenshotHeight: 970,
  video: '',
  videoCaptions: '',
  videoDescription: 'The Stock workspace shows component categories, quantities, rack locations, electrical parameters, and the actions for the selected part.',
  scannerPhoto: '',
  scannerPhotoAlt: '',
  /** Looping background video for the hero section. */
  heroVideo: '',
  /** Poster image shown while the hero video loads (or as fallback). */
  heroPoster: '',
  /** 3D model of Scan R1 in glTF Binary format for the interactive viewer. */
  scannerModel: '',
  /** Poster image shown while the 3D model loads. */
  scannerModelPoster: '',
};
/** Slides for the features carousel on the landing page. */
export const carouselSlides = [
  { title: 'Stock Management', caption: 'Search, filter, and inspect every component in your inventory.', image: '/media/stock.png', href: '/docs/desktop/stock/' },
  { title: 'Racks & Storage', caption: 'Assign physical locations. Print labels. Find parts fast.', image: '', href: '/docs/desktop/racks/' },
  { title: 'Project BOMs', caption: 'Compare a BOM against stock. Spot shortages instantly.', image: '', href: '/docs/desktop/projects/' },
  { title: 'Order Import', caption: 'Import DigiKey CSVs. Review before accepting.', image: '', href: '/docs/desktop/import/' },
  { title: 'Scan R1', caption: 'A handheld scanner that talks directly to your inventory.', image: '', href: '/docs/scanner/' },
  { title: 'History & Recovery', caption: 'Every change tracked. Named checkpoints. One-click restore.', image: '', href: '/docs/desktop/history/' },
];
export const features = [
  { title: 'Stock management', label: 'Stock', href: '/docs/desktop/stock/', text: 'Keep component records, quantities, electrical parameters, links, and notes together. Search, filter, and count your stock.', details: ['Search by part, category, parameter, location, SKU, or quantity.', 'Review selected component details alongside the inventory list.', 'Use per-part reorder thresholds and a guided stocktake.'] },
  { title: 'Physical storage', label: 'Racks', href: '/docs/desktop/racks/', text: 'Assign components to a rack and slot, move them between locations, and print labels for stored parts.', details: ['Work with a 5 × 5 rack grid.', 'Place, move, automatically assign, or unassign components.', 'Find project components one rack at a time.'] },
  { title: 'Component import', label: 'Import', href: '/docs/desktop/import/', text: 'Review DigiKey order CSVs before accepting parts. Import KiCad BOMs into Projects for comparison with current stock.', details: ['File headers determine the import workflow.', 'Accept, correct, or skip DigiKey order rows.', 'Optionally enrich accepted parts with DigiKey metadata.'] },
  { title: 'Projects and BOMs', label: 'Projects', href: '/docs/desktop/projects/', text: 'Compare the parts needed for a board with the parts you have, inspect shortages, and follow a rack-by-rack picking workflow.', details: ['Adjust board count and choose between matching components.', 'Export shortages to CSV beside the BOM.', 'Confirm stock subtraction after picking; projects persist locally.'] },
  { title: 'History and recovery', label: 'History', href: '/docs/desktop/history/', text: 'Inspect inventory changes, create named checkpoints, reverse changes, and make validated backups of the workspace.', details: ['Review before-and-after fields for parts and racks.', 'Restore a snapshot without removing earlier history.', 'Validate backup contents before activation and re-pair Scan R1 after restore.'] },
  { title: 'Scanner and printing', label: 'Scan R1', href: '/docs/scanner/', text: 'Connect a paired handheld scanner to the desktop device service. Use the PC printer for component and quick labels.', details: ['Physically verified Bluetooth LE pairing, then local-network synchronization.', 'Authenticated device traffic with replay protection.', 'Optional background service keeps the paired PC available after the terminal closes.'] },
];
