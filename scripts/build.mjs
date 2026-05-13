import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

rmSync('dist', { recursive: true, force: true });
mkdirSync(join('dist', 'src'), { recursive: true });
copyFileSync('index.html', join('dist', 'index.html'));
copyFileSync(join('src', 'main.js'), join('dist', 'src', 'main.js'));
copyFileSync(join('src', 'styles.css'), join('dist', 'src', 'styles.css'));
console.log('Built static AEC Compliance Tracker to dist/');
