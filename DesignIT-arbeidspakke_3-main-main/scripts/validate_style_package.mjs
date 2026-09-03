import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CatalogAdapter from '../js/modules/catalog_adapter.js';

const defaultPackageDir = fileURLToPath(new URL('../data/style-packages/classic', import.meta.url));
const argv = globalThis.process?.argv || [];
const packageDir = resolve(argv[2] || defaultPackageDir);

async function readJson(path) {
    return JSON.parse(await readFile(join(packageDir, path), 'utf8'));
}

const manifest = await readJson('manifest.json');
const tokens = await readJson('tokens.json');

assert.equal(manifest.schemaVersion, '1.0', 'manifest schemaVersion must be 1.0');
assert.equal(tokens.schemaVersion, '1.0', 'tokens schemaVersion must be 1.0');

if (manifest.packageId === 'classic') {
    const catalog = JSON.parse(await readFile(join(packageDir, 'components/html_components.json'), 'utf8'));
    assert.ok(Array.isArray(catalog), 'classic package HTML catalogue must be legacy array format');
    catalog.forEach((item, index) => {
        assert.equal(typeof item.Title, 'string', `component ${index} Title must be a string`);
        assert.equal(typeof item.HTML, 'string', `component ${index} HTML must be a string`);
        assert.equal(typeof item.CSS, 'string', `component ${index} CSS must be a string`);
        assert.equal(typeof item.Reference, 'string', `component ${index} Reference must be a string`);
    });
} else {
    const catalog = await readJson('components/html_components.json');
    const packageData = {
        manifest,
        tokens,
        catalog,
        tokensCss: CatalogAdapter.tokensToCss(tokens.tokens, `style-${manifest.packageId}`)
    };
    const validation = CatalogAdapter.validatePackage(packageData);
    assert.equal(validation.errors.length, 0, validation.errors.join('\n'));
}

console.log(`${manifest.name} package validated.`);
