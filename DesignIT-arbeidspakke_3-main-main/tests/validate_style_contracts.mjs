import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import CatalogAdapter from '../js/modules/catalog_adapter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function readJson(path) {
    return JSON.parse(await readFile(join(root, path), 'utf8'));
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function assertLegacyCatalogue(name, catalogue) {
    assert.ok(Array.isArray(catalogue), `${name} catalogue must be an array`);
    assert.ok(catalogue.length > 0, `${name} catalogue must not be empty`);

    catalogue.forEach((item, index) => {
        assert.equal(typeof item.Title, 'string', `${name}[${index}].Title must be a string`);
        assert.equal(typeof item.HTML, 'string', `${name}[${index}].HTML must be a string`);
        assert.equal(typeof item.CSS, 'string', `${name}[${index}].CSS must be a string`);
        assert.equal(typeof item.Reference, 'string', `${name}[${index}].Reference must be a string`);
    });
}

const schemaFiles = [
    'schemas/moodboard.schema.json',
    'schemas/style-proposal.schema.json',
    'schemas/style-tokens.schema.json',
    'schemas/component-catalog.schema.json',
    'schemas/package-manifest.schema.json'
];

for (const schemaFile of schemaFiles) {
    const schema = await readJson(schemaFile);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema', `${schemaFile} uses draft 2020-12`);
    assert.ok(schema.title, `${schemaFile} has a title`);
}

const html = await readJson('data/html_components.json');
const js = await readJson('data/js_components.json');
const api = await readJson('data/api_components.json');
assertLegacyCatalogue('HTML', html);
assertLegacyCatalogue('JavaScript', js);
assertLegacyCatalogue('Web API', api);

const classicManifest = await readJson('data/style-packages/classic/manifest.json');
const classicTokens = await readJson('data/style-packages/classic/tokens.json');
const classicHtml = await readJson('data/style-packages/classic/components/html_components.json');
assert.equal(classicManifest.packageId, 'classic');
assert.equal(classicTokens.packageId, 'classic');
assert.equal(sha256(JSON.stringify(classicHtml)), sha256(JSON.stringify(html)), 'classic package mirrors the current HTML catalogue');

const direction = {
    id: 'direction_test',
    name: 'Contract Test',
    summary: 'A deterministic package used by tests.',
    tokens: {
        color: {
            brandPrimary: { value: '#045f6f', role: 'actions' },
            brandAccent: { value: '#c35a2e', role: 'emphasis' },
            surface: { value: '#fffdf7', role: 'background' },
            surfaceMuted: { value: '#f3efe5', role: 'cards' },
            text: { value: '#172124', role: 'body text' }
        },
        font: {
            heading: { value: 'Inter, Arial, sans-serif' },
            body: { value: 'Inter, Arial, sans-serif' }
        },
        space: { '2': '0.5rem', '3': '0.75rem', '4': '1rem', '6': '1.5rem', '8': '2rem' },
        radius: { sm: '0.375rem', md: '0.75rem' },
        shadow: { sm: '0 8px 22px rgba(23, 33, 36, 0.08)' }
    }
};
const board = {
    id: 'mb_test',
    projectId: 'designit-local-demo',
    revision: 2,
    items: []
};
const packageData = CatalogAdapter.createPackageFromDirection(direction, board, {
    proposalId: 'proposal_test',
    proposalVersion: 1,
    packageId: 'style_contract'
});
const validation = CatalogAdapter.validatePackage(packageData);
assert.equal(validation.errors.length, 0, 'generated package validates without errors');
assert.equal(CatalogAdapter.toLegacyComponents(packageData.catalog, packageData.tokensCss).length, 6, 'v2 catalogue maps to legacy entries');

const unsafePackage = structuredClone(packageData);
unsafePackage.catalog.components[0].html = '<button onclick="alert(1)">Bad</button>';
assert.ok(CatalogAdapter.validatePackage(unsafePackage).errors.length > 0, 'unsafe HTML is rejected');

console.log('Style contracts validated.');
