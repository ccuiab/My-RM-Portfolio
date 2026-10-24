import { execFileSync } from 'node:child_process';
import { ROOT } from './paths.mjs';

// Include inputs to the build and tooling, including newly created source files.
const BUILD_INPUTS = [
  'src', 'scripts', 'materials', 'package.json', 'package-lock.json',
  'astro.config.mjs', 'tsconfig.json', '.github', '.gitignore',
];

export function readSourceState(root = ROOT) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const sourceCommit = git(['rev-parse', 'HEAD']);
  const changes = git(['status', '--porcelain', '--untracked-files=normal', '--', ...BUILD_INPUTS]);
  return { sourceCommit, sourceState: changes ? 'working-tree' : 'committed' };
}
