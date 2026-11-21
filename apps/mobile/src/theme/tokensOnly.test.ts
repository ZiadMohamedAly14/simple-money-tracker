/**
 * Guard: screens and components colour themselves with theme tokens only
 * (bg-surface, text-muted, theme.colors.primary…), so the light and dark
 * palettes reach everything. Scans app/ and src/ for raw hex/rgb colours and
 * Tailwind's built-in palette classes. Colours live in src/theme/themes.ts.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const FORBIDDEN = [
  /#[0-9a-fA-F]{3,8}\b(?=['"`\s;,)}])/,
  /\b(?:rgba?|hsla?)\(/,
  /(?<![\w-])(?:bg|text|border|fill|stroke|ring|divide|from|to|via|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?![\w-])/,
  /(?<![\w-])(?:bg|text|border|fill|stroke|ring|divide|from|to|via|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/,
  /\b(?:color|backgroundColor|borderColor|tintColor|shadowColor)\s*:\s*['"](?:white|black|gr[ae]y|red|green|blue|yellow|orange|pink)['"]/,
];

function rawColours(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line))
    .filter((line) => FORBIDDEN.some((pattern) => pattern.test(line)));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('token-only colours', () => {
  it.each([
    ["style={{ color: '#FFFFFF' }}"],
    ["const shade = '#fff';"],
    ["backgroundColor: 'rgba(0, 0, 0, 0.4)'"],
    ['className="bg-black/40"'],
    ['className="text-white"'],
    ['className="border-gray-200"'],
    ["style={{ backgroundColor: 'white' }}"],
  ])('flags %s', (line) => {
    expect(rawColours(line)).toEqual([line]);
  });

  it.each([
    ['className="bg-surface text-muted border-primary bg-on-primary/15"'],
    ["contentStyle: { backgroundColor: 'transparent' }"],
    ['color={theme.colors.primary}'],
    ['className="border-transparent bg-scrim/40"'],
    ["router.push('/kid/#history')"],
  ])('allows %s', (line) => {
    expect(rawColours(line)).toEqual([]);
  });

  it('holds for every screen and component', () => {
    const root = join(__dirname, '..', '..');
    const offenders = ['app', 'src']
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((file) => !file.endsWith(join('theme', 'themes.ts')))
      .flatMap((file) => rawColours(readFileSync(file, 'utf8')).map((line) => `${relative(root, file)}: ${line.trim()}`));
    expect(offenders).toEqual([]);
  });
});
