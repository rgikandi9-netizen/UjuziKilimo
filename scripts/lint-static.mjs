import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';

const files = [];
for await (const file of glob('{src,test,scripts}/**/*.{js,mjs,css}')) files.push(file);

const failures = [];
for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  if (/try\s*{[\s\S]{0,300}import\s*\(/.test(contents)) {
    failures.push(`${file}: dynamic import inside try/catch is not allowed`);
  }
  if (/console\.log\(/.test(contents)) {
    failures.push(`${file}: remove console.log before commit`);
  }
}

if (failures.length) {
  throw new Error(failures.join('\n'));
}
