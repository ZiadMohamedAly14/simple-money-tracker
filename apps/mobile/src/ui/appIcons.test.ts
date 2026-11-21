import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ICONS, DIRECTIONAL_APP_ICONS, NON_UI_ICON_FILES } from './appIcons';

const ICON_DIR = join(__dirname, '../../assets/icon');

describe('APP_ICONS', () => {
  it('has one entry per .svg in assets/icon, named after the file', () => {
    const files = readdirSync(ICON_DIR)
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.slice(0, -'.svg'.length))
      .filter((name) => !(NON_UI_ICON_FILES as readonly string[]).includes(name))
      .sort();
    expect(Object.keys(APP_ICONS).sort()).toEqual(files);
  });

  it('only marks known icons as directional', () => {
    for (const name of DIRECTIONAL_APP_ICONS) expect(APP_ICONS).toHaveProperty(name);
  });
});
