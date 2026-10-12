// Homepage content loaded from src/content/pages/home.json.
// Edit src/content/pages/home.json to update text on the homepage without touching code.
import content from '../content/pages/home.json';
import { release, site } from './site';

export const firmwareRepository = 'https://github.com/Kwiatens/Inventatory-Firmware';

export const hero = content.hero;
export const film = content.film;
export const highlights = content.highlights.items;
export const scanner = content.scanner;

export { site, release };
