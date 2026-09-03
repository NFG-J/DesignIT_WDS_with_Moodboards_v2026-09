/**
 * CatalogAdapter - Bridges style-package v2 catalogues to the legacy
 * Title/HTML/CSS/Reference shape used by ComponentManager.
 */
class CatalogAdapter {
    constructor(options = {}) {
        this.activePointerUrl = options.activePointerUrl || './data/style-packages/active.json';
        this.localActiveKey = options.localActiveKey || 'designit.activeStylePackage';
    }

    async loadActiveLegacyCatalog() {
        const localPackage = this.getStoredActivePackage();
        if (localPackage) {
            return {
                components: CatalogAdapter.toLegacyComponents(localPackage.catalog, localPackage.tokensCss),
                package: localPackage
            };
        }

        const pointer = await this.fetchJSON(this.activePointerUrl);
        const [manifest, tokens, catalog] = await Promise.all([
            this.fetchJSON(pointer.manifestUrl),
            this.fetchJSON(pointer.tokensUrl),
            this.fetchJSON(pointer.catalogUrl)
        ]);

        const packageData = {
            schemaVersion: '1.0',
            packageId: manifest.packageId,
            version: pointer.activeVersion,
            name: manifest.name,
            manifest,
            tokens,
            catalog,
            tokensCss: CatalogAdapter.tokensToCss(tokens.tokens, `style-${manifest.packageId}`)
        };

        return {
            components: Array.isArray(catalog)
                ? CatalogAdapter.normalizeLegacyComponents(catalog)
                : CatalogAdapter.toLegacyComponents(catalog, packageData.tokensCss),
            package: packageData
        };
    }

    async fetchJSON(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Unable to load ${url}: ${response.status}`);
        }
        return response.json();
    }

    getStoredActivePackage() {
        if (typeof localStorage === 'undefined') return null;

        try {
            const raw = localStorage.getItem(this.localActiveKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Could not read active style package from local storage:', error);
            return null;
        }
    }

    static normalizeLegacyComponents(catalog) {
        if (!Array.isArray(catalog)) return [];

        return catalog.map((item, index) => ({
            Title: String(item.Title || item.title || `Component ${index + 1}`),
            HTML: String(item.HTML || item.html || ''),
            CSS: String(item.CSS || item.css || ''),
            Reference: String(item.Reference || item.reference || ''),
            JS: item.JS || item.javascript || ''
        }));
    }

    static toLegacyComponents(catalog, tokensCss = '') {
        if (Array.isArray(catalog)) {
            return CatalogAdapter.normalizeLegacyComponents(catalog);
        }

        const components = Array.isArray(catalog?.components) ? catalog.components : [];
        return components.map((component) => ({
            Title: component.title,
            HTML: component.html,
            CSS: [tokensCss, component.css].filter(Boolean).join('\n\n'),
            Reference: component.reference || 'Generated from accepted DesignIT style package.',
            JS: component.javascript || '',
            StylePackageId: component.stylePackageId
        }));
    }

    static createPackageFromDirection(direction, board, options = {}) {
        const now = new Date().toISOString();
        const packageId = options.packageId || `style_${Date.now()}`;
        const version = options.version || now.replace(/[:.]/g, '-');
        const scope = `style-${CatalogAdapter.safeIdentifier(packageId)}`;
        const tokensDocument = {
            schemaVersion: '1.0',
            packageId,
            name: direction.name,
            tokens: direction.tokens
        };
        const tokensCss = CatalogAdapter.tokensToCss(direction.tokens, scope);
        const catalog = {
            schemaVersion: '2.0',
            components: CatalogAdapter.createStyledComponents(direction, packageId, scope)
        };
        const manifest = {
            schemaVersion: '1.0',
            packageId,
            version,
            name: direction.name,
            projectId: board.projectId || 'designit-local-demo',
            sourceBoardRevision: board.revision || 1,
            sourceProposalId: options.proposalId || direction.proposalId || 'proposal_local',
            sourceProposalVersion: options.proposalVersion || direction.proposalVersion || 1,
            createdAt: now,
            generator: {
                type: 'mock-style-agent',
                model: 'local-deterministic-v1',
                notes: 'Generated locally from mood-board inputs. No provider credentials are stored in browser code.'
            },
            components: {
                html: 'localStorage://designit.activeStylePackage/catalog',
                javascript: './data/js_components.json',
                api: './data/api_components.json'
            },
            assets: CatalogAdapter.collectAssets(board),
            hashes: CatalogAdapter.createManifestHashes(tokensDocument, catalog),
            licenses: [
                {
                    name: 'User supplied mood-board assets',
                    status: 'provenance captured; user confirmation required before external reuse'
                },
                {
                    name: 'Generated style package',
                    status: 'local deterministic mock provider output'
                }
            ],
            validation: {
                status: 'passed',
                checkedAt: now,
                messages: []
            }
        };

        return {
            schemaVersion: '1.0',
            packageId,
            version,
            name: direction.name,
            summary: direction.summary,
            manifest,
            tokens: tokensDocument,
            catalog,
            tokensCss,
            source: {
                boardId: board.id,
                boardRevision: board.revision,
                proposalId: manifest.sourceProposalId,
                proposalVersion: manifest.sourceProposalVersion,
                directionId: direction.id
            }
        };
    }

    static createStyledComponents(direction, packageId, scope) {
        const ns = CatalogAdapter.safeIdentifier(packageId);
        const reference = 'Generated from accepted DesignIT mood-board style package.';
        const wrap = (modifier, inner) => `<section class="ds-pack ${scope} ds-${modifier}" data-style-package="${packageId}">\n${inner}\n</section>`;

        return [
            {
                id: `cmp_${ns}_nav`,
                title: `${direction.name} Header`,
                category: 'Styled Components',
                html: wrap('nav', '  <header class="ds-header">\n    <a class="ds-brand" href="#">Brand Studio</a>\n    <nav class="ds-links" aria-label="Primary">\n      <a href="#">Work</a>\n      <a href="#">Services</a>\n      <a href="#">Contact</a>\n    </nav>\n  </header>'),
                css: CatalogAdapter.componentCss(scope, 'nav'),
                javascript: '',
                reference,
                assets: [],
                tags: ['header', 'navigation', 'brand'],
                stylePackageId: packageId
            },
            {
                id: `cmp_${ns}_hero`,
                title: `${direction.name} Hero`,
                category: 'Styled Components',
                html: wrap('hero', '  <div class="ds-hero__body">\n    <p class="ds-kicker">Design direction</p>\n    <h1>Build a page with a clear visual voice</h1>\n    <p>Use reusable tokens for colour, type, spacing and component rhythm.</p>\n    <div class="ds-actions">\n      <a class="ds-btn ds-btn--primary" href="#">Start now</a>\n      <a class="ds-btn ds-btn--secondary" href="#">View details</a>\n    </div>\n  </div>'),
                css: CatalogAdapter.componentCss(scope, 'hero'),
                javascript: '',
                reference,
                assets: [],
                tags: ['hero', 'layout', 'cta'],
                stylePackageId: packageId
            },
            {
                id: `cmp_${ns}_buttons`,
                title: `${direction.name} Buttons`,
                category: 'Styled Components',
                html: wrap('buttons', '  <div class="ds-actions">\n    <button class="ds-btn ds-btn--primary" type="button">Continue</button>\n    <button class="ds-btn ds-btn--secondary" type="button">Secondary</button>\n    <button class="ds-btn ds-btn--ghost" type="button">Cancel</button>\n  </div>'),
                css: CatalogAdapter.componentCss(scope, 'buttons'),
                javascript: '',
                reference: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button',
                assets: [],
                tags: ['button', 'action'],
                stylePackageId: packageId
            },
            {
                id: `cmp_${ns}_cards`,
                title: `${direction.name} Card Grid`,
                category: 'Styled Components',
                html: wrap('cards', '  <div class="ds-card-grid">\n    <article class="ds-card">\n      <p class="ds-kicker">01</p>\n      <h2>Reusable foundations</h2>\n      <p>Tokens keep component styling consistent across the catalogue.</p>\n    </article>\n    <article class="ds-card">\n      <p class="ds-kicker">02</p>\n      <h2>Accessible contrast</h2>\n      <p>Colour roles are checked before a package can be activated.</p>\n    </article>\n  </div>'),
                css: CatalogAdapter.componentCss(scope, 'cards'),
                javascript: '',
                reference: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article',
                assets: [],
                tags: ['card', 'grid', 'content'],
                stylePackageId: packageId
            },
            {
                id: `cmp_${ns}_form`,
                title: `${direction.name} Form`,
                category: 'Styled Components',
                html: wrap('form', '  <form class="ds-form">\n    <label for="ds-name">Name</label>\n    <input id="ds-name" name="name" type="text" placeholder="Your name">\n    <label for="ds-message">Message</label>\n    <textarea id="ds-message" name="message" rows="3" placeholder="Short message"></textarea>\n    <button class="ds-btn ds-btn--primary" type="submit">Send</button>\n  </form>'),
                css: CatalogAdapter.componentCss(scope, 'form'),
                javascript: '',
                reference: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form',
                assets: [],
                tags: ['form', 'input', 'label'],
                stylePackageId: packageId
            },
            {
                id: `cmp_${ns}_footer`,
                title: `${direction.name} Footer`,
                category: 'Styled Components',
                html: wrap('footer', '  <footer class="ds-footer">\n    <strong>Brand Studio</strong>\n    <p>Reusable style package generated from an accepted mood board.</p>\n  </footer>'),
                css: CatalogAdapter.componentCss(scope, 'footer'),
                javascript: '',
                reference: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/footer',
                assets: [],
                tags: ['footer', 'content'],
                stylePackageId: packageId
            }
        ];
    }

    static componentCss(scope, variant = 'base') {
        const base = `
.${scope}.ds-pack {
  color: var(--ds-text);
  background: var(--ds-surface);
  border-radius: var(--ds-radius-md);
  font-family: var(--ds-font-body);
  line-height: 1.55;
  margin: 0 0 var(--ds-space-4) 0;
}

.${scope} h1,
.${scope} h2,
.${scope} h3 {
  color: var(--ds-text);
  font-family: var(--ds-font-heading);
  letter-spacing: 0;
}

.${scope} a {
  color: var(--ds-primary);
}

.${scope} .ds-kicker {
  color: var(--ds-accent);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0 0 var(--ds-space-2) 0;
  text-transform: uppercase;
}

.${scope} .ds-btn {
  align-items: center;
  border: 1px solid var(--ds-primary);
  border-radius: var(--ds-radius-sm);
  cursor: pointer;
  display: inline-flex;
  font: 700 0.95rem/1 var(--ds-font-body);
  gap: 0.4rem;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.78rem 1rem;
  text-decoration: none;
}

.${scope} .ds-btn--primary {
  background: var(--ds-primary);
  color: var(--ds-on-primary);
}

.${scope} .ds-btn--secondary {
  background: var(--ds-accent);
  border-color: var(--ds-accent);
  color: var(--ds-on-accent);
}

.${scope} .ds-btn--ghost {
  background: transparent;
  color: var(--ds-primary);
}

.${scope} .ds-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-2);
}`;

        const variants = {
            nav: `
.${scope} .ds-header {
  align-items: center;
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-md);
  display: flex;
  gap: var(--ds-space-4);
  justify-content: space-between;
  padding: var(--ds-space-3) var(--ds-space-4);
}

.${scope} .ds-brand {
  color: var(--ds-text);
  font-family: var(--ds-font-heading);
  font-size: 1.05rem;
  font-weight: 800;
  text-decoration: none;
}

.${scope} .ds-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-3);
}

.${scope} .ds-links a {
  color: var(--ds-muted-text);
  font-size: 0.9rem;
  text-decoration: none;
}`,
            hero: `
.${scope}.ds-hero {
  background: linear-gradient(135deg, var(--ds-surface) 0%, var(--ds-surface-muted) 100%);
  border: 1px solid var(--ds-border);
  padding: clamp(1.5rem, 5vw, 4rem);
}

.${scope} .ds-hero__body {
  max-width: 46rem;
}

.${scope} h1 {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;
  margin: 0 0 var(--ds-space-3) 0;
}

.${scope} .ds-hero__body > p:not(.ds-kicker) {
  color: var(--ds-muted-text);
  font-size: 1.08rem;
  max-width: 38rem; 
}`,
            buttons: `
.${scope}.ds-buttons {
  border: 1px solid var(--ds-border);
  padding: var(--ds-space-4);
}`,
            cards: `
.${scope} .ds-card-grid {
  display: grid;
  gap: var(--ds-space-3);
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.${scope} .ds-card {
  background: var(--ds-surface-muted);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-md);
  box-shadow: var(--ds-shadow-sm);
  padding: var(--ds-space-4);
}

.${scope} .ds-card h2 {
  font-size: 1.18rem;
  margin: 0 0 var(--ds-space-2) 0;
}

.${scope} .ds-card p:last-child {
  color: var(--ds-muted-text);
  margin-bottom: 0;
}`,
            form: `
.${scope} .ds-form {
  background: var(--ds-surface-muted);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-md);
  display: grid;
  gap: var(--ds-space-2);
  max-width: 34rem;
  padding: var(--ds-space-4);
}

.${scope} label {
  font-weight: 700;
}

.${scope} input,
.${scope} textarea {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border);
  border-radius: var(--ds-radius-sm);
  color: var(--ds-text);
  font: inherit;
  padding: 0.75rem;
  width: 100%;
}

.${scope} input:focus,
.${scope} textarea:focus {
  outline: 3px solid color-mix(in srgb, var(--ds-accent), transparent 65%);
  outline-offset: 1px;
}`,
            footer: `
.${scope} .ds-footer {
  background: var(--ds-primary);
  border-radius: var(--ds-radius-md);
  color: var(--ds-on-primary);
  padding: var(--ds-space-4);
}

.${scope} .ds-footer p {
  margin-bottom: 0;
  opacity: 0.86;
}`
        };

        return `${base}\n${variants[variant] || ''}`.trim();
    }

    static tokensToCss(tokens, scope = 'style-package') {
        const colors = tokens?.color || {};
        const fonts = tokens?.font || {};
        const space = tokens?.space || {};
        const radius = tokens?.radius || {};
        const shadow = tokens?.shadow || {};
        const primary = CatalogAdapter.hexValue(colors.brandPrimary?.value, '#045f6f');
        const accent = CatalogAdapter.hexValue(colors.brandAccent?.value, '#c35a2e');
        const surface = CatalogAdapter.hexValue(colors.surface?.value, '#fffdf7');
        const surfaceMuted = CatalogAdapter.hexValue(colors.surfaceMuted?.value, '#f2f0e6');
        const text = CatalogAdapter.hexValue(colors.text?.value, '#172124');

        return `
.${scope} {
  --ds-primary: ${primary};
  --ds-accent: ${accent};
  --ds-surface: ${surface};
  --ds-surface-muted: ${surfaceMuted};
  --ds-text: ${text};
  --ds-muted-text: ${CatalogAdapter.mixHex(text, surface, 0.28)};
  --ds-border: ${CatalogAdapter.mixHex(text, surface, 0.78)};
  --ds-on-primary: ${CatalogAdapter.readableTextFor(primary)};
  --ds-on-accent: ${CatalogAdapter.readableTextFor(accent)};
  --ds-font-heading: ${fonts.heading?.value || 'Georgia, serif'};
  --ds-font-body: ${fonts.body?.value || 'Arial, sans-serif'};
  --ds-space-2: ${space['2'] || '0.5rem'};
  --ds-space-3: ${space['3'] || '0.75rem'};
  --ds-space-4: ${space['4'] || '1rem'};
  --ds-space-6: ${space['6'] || '1.5rem'};
  --ds-space-8: ${space['8'] || '2rem'};
  --ds-radius-sm: ${radius.sm || '0.375rem'};
  --ds-radius-md: ${radius.md || '0.75rem'};
  --ds-shadow-sm: ${shadow.sm || '0 8px 22px rgba(23, 33, 36, 0.08)'};
}`.trim();
    }

    static validatePackage(packageData) {
        const errors = [];
        const warnings = [];
        const components = packageData?.catalog?.components || [];
        const ids = new Set();

        if (!packageData?.manifest || !packageData?.tokens || !packageData?.catalog) {
            errors.push('Package is missing manifest, tokens or component catalogue.');
        }

        if (!components.length) {
            errors.push('Package must contain at least one HTML component.');
        }

        components.forEach((component, index) => {
            const label = component.title || `component ${index + 1}`;
            if (!component.id || ids.has(component.id)) {
                errors.push(`${label} has a missing or duplicate component id.`);
            }
            ids.add(component.id);

            if (CatalogAdapter.hasUnsafeHtml(component.html)) {
                errors.push(`${label} contains unsafe HTML.`);
            }
            if (CatalogAdapter.hasUnsafeCss(component.css)) {
                errors.push(`${label} contains unsafe CSS.`);
            }
            if (component.javascript?.trim()) {
                warnings.push(`${label} includes JavaScript; MVP activation keeps styled HTML components script-free.`);
            }
        });

        const colors = packageData?.tokens?.tokens?.color || {};
        const surface = colors.surface?.value;
        const text = colors.text?.value;
        const primary = colors.brandPrimary?.value;
        const textContrast = CatalogAdapter.contrastRatio(surface, text);
        const primaryContrast = CatalogAdapter.contrastRatio(primary, CatalogAdapter.readableTextFor(primary));

        if (Number.isFinite(textContrast) && textContrast < 4.5) {
            errors.push(`Body text contrast is ${textContrast.toFixed(2)}:1; WCAG AA needs at least 4.5:1.`);
        }
        if (Number.isFinite(primaryContrast) && primaryContrast < 4.5) {
            errors.push(`Primary button contrast is ${primaryContrast.toFixed(2)}:1; WCAG AA needs at least 4.5:1.`);
        }

        const status = errors.length ? 'failed' : warnings.length ? 'warnings' : 'passed';
        return {
            status,
            errors,
            warnings,
            checkedAt: new Date().toISOString(),
            diff: {
                added: components.length,
                modified: 0,
                removed: 0,
                unchanged: 0
            }
        };
    }

    static hasUnsafeHtml(html = '') {
        const source = String(html).toLowerCase();
        return /<\s*script\b/.test(source)
            || /\son[a-z]+\s*=/.test(source)
            || /javascript\s*:/.test(source)
            || /<\s*(iframe|object|embed|link|meta)\b/.test(source);
    }

    static hasUnsafeCss(css = '') {
        const source = String(css).toLowerCase();
        return /@import/.test(source)
            || /expression\s*\(/.test(source)
            || /javascript\s*:/.test(source)
            || /behavior\s*:/.test(source)
            || /url\s*\(\s*['"]?\s*data:/ .test(source);
    }

    static collectAssets(board) {
        return (board.items || [])
            .filter((item) => item.assetId)
            .map((item) => ({
                path: `localStorage://${item.assetId}`,
                mimeType: item.metadata?.mimeType || 'application/octet-stream',
                provenance: item.metadata?.provenance || item.source || 'user supplied'
            }));
    }

    static createManifestHashes(tokensDocument, catalog) {
        return {
            tokens: CatalogAdapter.simpleHash(JSON.stringify(tokensDocument)),
            htmlComponents: CatalogAdapter.simpleHash(JSON.stringify(catalog))
        };
    }

    static simpleHash(value = '') {
        let hash = 5381;
        for (let i = 0; i < value.length; i += 1) {
            hash = ((hash << 5) + hash) + value.charCodeAt(i);
            hash >>>= 0;
        }
        return `djb2-${hash.toString(16).padStart(8, '0')}`;
    }

    static safeIdentifier(value = '') {
        return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'style';
    }

    static hexValue(value, fallback) {
        return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
    }

    static readableTextFor(background) {
        const black = '#111111';
        const white = '#ffffff';
        return CatalogAdapter.contrastRatio(background, black) >= CatalogAdapter.contrastRatio(background, white)
            ? black
            : white;
    }

    static contrastRatio(hexA, hexB) {
        if (!/^#[0-9a-f]{6}$/i.test(String(hexA || '')) || !/^#[0-9a-f]{6}$/i.test(String(hexB || ''))) {
            return Number.NaN;
        }
        const lumA = CatalogAdapter.relativeLuminance(hexA);
        const lumB = CatalogAdapter.relativeLuminance(hexB);
        const lighter = Math.max(lumA, lumB);
        const darker = Math.min(lumA, lumB);
        return (lighter + 0.05) / (darker + 0.05);
    }

    static relativeLuminance(hex) {
        const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
        const channels = rgb.map((channel) => (
            channel <= 0.03928
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
        ));
        return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
    }

    static mixHex(hexA, hexB, weight = 0.5) {
        const a = CatalogAdapter.hexToRgb(hexA);
        const b = CatalogAdapter.hexToRgb(hexB);
        const mixed = a.map((channel, index) => Math.round((channel * weight) + (b[index] * (1 - weight))));
        return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    static hexToRgb(hex) {
        const safeHex = CatalogAdapter.hexValue(hex, '#000000');
        return [1, 3, 5].map((index) => parseInt(safeHex.slice(index, index + 2), 16));
    }
}

export default CatalogAdapter;
