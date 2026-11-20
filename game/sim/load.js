import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadContent } from '../src/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const loadNodeContent = () => loadContent(async p => JSON.parse(await readFile(path.join(root, p), 'utf8')));
