// Homepage content loaded from src/content/pages/home.json.
// Edit src/content/pages/home.json to update text on the homepage without touching code.
import content from '../content/pages/home.json';
import { release, site } from './site';

export const firmwareRepository = 'https://github.com/Kwiatens/Inventatory-Firmware';

export const hero = content.hero;
export const statement = content.statement;
export const workflow = content.workflow;
/** A step's screenshot or recording; none of them has one at the moment. */
export interface StepMedia { src: string; alt: string; width: number; height: number; position?: string; zoom?: number }
type RawStep = (typeof content.workflow.steps)[number];
export const steps = content.workflow.steps as Array<Omit<RawStep, 'media'> & { media: StepMedia | null }>;
export const scanner = content.scanner;
export const nextSteps = content.nextSteps;

export type Step = (typeof steps)[number];

export { site, release };
