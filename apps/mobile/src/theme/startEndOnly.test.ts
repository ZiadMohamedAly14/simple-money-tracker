/**
 * Guard: layout uses start/end, never left/right, so Arabic gets a correct
 * right-to-left layout for free. Scans app/ and src/ for left/right Tailwind
 * classes and style keys.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const FORBIDDEN = [
  // Tailwind: margin/padding/position/border/radius/text alignment by side
  /(?<![\w.-])-?(?:ml|mr|pl|pr|left|right|scroll-ml|scroll-mr)-[\w./[\]]+/,
  /(?<![\w.-])(?:border-[lr]|rounded-(?:[lr]|tl|tr|bl|br))(?:-[\w./[\]]+)?(?![\w-])/,
  /(?<![\w.-])text-(?:left|right)(?![\w-])/,
  // React Native style keys
  /\b(?:marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)\s*:/,
  /\b(?:left|right)\s*:\s*[-\d]/,
  /textAlign\s*:\s*['"](?:left|right)['"]/,
];

function directionalUsages(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line)) // comments may say "right-to-left"
    .filter((line) => FORBIDDEN.some((pattern) => pattern.test(line)));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('start/end-only layout', () => {
  it.each([
    ['className="ml-2"'],
    ['className="pr-4 flex-1"'],
    ['className="text-left"'],
    ['className="rounded-r-lg"'],
    ['style={{ marginLeft: 4 }}'],
    ['style={{ left: 0 }}'],
    ["style={{ textAlign: 'right' }}"],
  ])('flags %s', (line) => {
    expect(directionalUsages(line)).toEqual([line]);
  });

  it.each([
    ['className="ms-2 pe-4 start-0 end-0 text-start rounded-e-lg border-s"'],
    ['className="flex-1 items-center justify-between"'],
    ['style={{ marginStart: 4, paddingEnd: 2 }}'],
    ["const label = t('common.left');"],
    [' * mirrored in right-to-left layouts'],
  ])('allows %s', (line) => {
    expect(directionalUsages(line)).toEqual([]);
  });

  it('holds for every screen and component', () => {
    const root = join(__dirname, '..', '..');
    const offenders = ['app', 'src']
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .flatMap((file) => directionalUsages(readFileSync(file, 'utf8')).map((line) => `${relative(root, file)}: ${line.trim()}`));
    expect(offenders).toEqual([]);
  });
});
