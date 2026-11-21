import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { optimize, type Config } from 'svgo';
import { APP_ICONS, DIRECTIONAL_APP_ICONS, NON_UI_ICON_FILES, RESERVED_APP_ICONS, isAppIconMirrored } from './appIcons';

const ICON_DIR = join(__dirname, '../../assets/icon');
/** The SVGR options Metro's SVG transformer uses (react-native-svg-transformer reads .svgrrc.js). */
const svgrConfig = require('../../.svgrrc.js') as { svgoConfig: Config };

const uiIconNames = () =>
  readdirSync(ICON_DIR)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.slice(0, -'.svg'.length))
    .filter((name) => !(NON_UI_ICON_FILES as readonly string[]).includes(name))
    .sort();

const read = (name: string) => readFileSync(join(ICON_DIR, `${name}.svg`), 'utf8');
const isIllustration = (name: string) => name.startsWith('learn-illustration-');

describe('APP_ICONS', () => {
  it('has one entry per .svg in assets/icon, named after the file', () => {
    expect(Object.keys(APP_ICONS).sort()).toEqual(uiIconNames());
  });

  it('only marks known icons as directional', () => {
    for (const name of DIRECTIONAL_APP_ICONS) expect(APP_ICONS).toHaveProperty(name);
  });

  it('mirrors the forward chevron in right-to-left, but not up and down', () => {
    expect(DIRECTIONAL_APP_ICONS.has('chevron-forward')).toBe(true);
    expect(DIRECTIONAL_APP_ICONS.has('chevron-up')).toBe(false);
    expect(DIRECTIONAL_APP_ICONS.has('chevron-down')).toBe(false);
  });

  it('points a reversed chevron-forward toward the start of the line in both directions', () => {
    // Drawn pointing right: mirrored means it points left.
    expect(isAppIconMirrored('chevron-forward', { isRTL: false })).toBe(false);
    expect(isAppIconMirrored('chevron-forward', { isRTL: true })).toBe(true);
    expect(isAppIconMirrored('chevron-forward', { isRTL: false, reversed: true })).toBe(true);
    expect(isAppIconMirrored('chevron-forward', { isRTL: true, reversed: true })).toBe(false);
    expect(isAppIconMirrored('chevron-down', { isRTL: true })).toBe(false);
  });

  it('only reserves icons that exist', () => {
    for (const name of RESERVED_APP_ICONS) expect(APP_ICONS).toHaveProperty(name);
  });

  it.each(uiIconNames().filter((name) => !isIllustration(name)))('line icon "%s" draws in currentColor only', (name) => {
    const svg = read(name);
    expect(svg).toContain('currentColor');
    expect(svg).not.toMatch(/(fill|stroke)="#/);
  });

  it.each(uiIconNames().filter(isIllustration))('illustration "%s" keeps its own colours', (name) => {
    const svg = read(name);
    expect(svg).not.toContain('currentColor');
    expect(svg).toMatch(/fill="#/);
  });

  it.each(uiIconNames())('"%s" loses any C2PA metadata through the build-time SVGO config', (name) => {
    const { data } = optimize(read(name), svgrConfig.svgoConfig);
    expect(data).not.toMatch(/c2pa|<metadata/i);
  });
});
