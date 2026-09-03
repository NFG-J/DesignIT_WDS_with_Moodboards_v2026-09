import CatalogAdapter from './catalog_adapter.js';

/**
 * StylePackageManager - Generates candidate packages, validates them,
 * activates them through a local active pointer, and supports rollback.
 */
class StylePackageManager {
    constructor(componentManager, notificationManager, options = {}) {
        this.componentManager = componentManager;
        this.notificationManager = notificationManager;
        this.adapter = new CatalogAdapter(options);
        this.activeKey = options.localActiveKey || 'designit.activeStylePackage';
        this.historyKey = options.historyKey || 'designit.stylePackageHistory';
        this.auditKey = options.auditKey || 'designit.styleAuditLog';
        this.snapshotKey = options.snapshotKey || 'designit.previousStyleSnapshot';
        this.maxHistory = options.maxHistory || 10;
    }

    createCandidate(direction, board, proposal) {
        const candidate = CatalogAdapter.createPackageFromDirection(direction, board, {
            proposalId: proposal?.id,
            proposalVersion: proposal?.version
        });
        const validation = CatalogAdapter.validatePackage(candidate);
        candidate.manifest.validation = {
            status: validation.status,
            checkedAt: validation.checkedAt,
            messages: [...validation.errors, ...validation.warnings]
        };
        candidate.validation = validation;
        return candidate;
    }

    async activateCandidate(candidate, board) {
        const validation = CatalogAdapter.validatePackage(candidate);
        if (validation.errors.length) {
            throw new Error(validation.errors[0]);
        }

        const previous = localStorage.getItem(this.activeKey);
        localStorage.setItem(this.snapshotKey, previous || JSON.stringify({ packageId: 'classic', version: 'classic' }));
        candidate.manifest.validation = {
            status: validation.status,
            checkedAt: validation.checkedAt,
            messages: [...validation.errors, ...validation.warnings]
        };
        candidate.validation = validation;

        localStorage.setItem(this.activeKey, JSON.stringify(candidate));
        this.addHistory(candidate, {
            eventType: 'activation',
            boardRevision: board?.revision || candidate.source?.boardRevision || 1,
            changeSummary: validation.diff
        });
        this.addAudit('activated', candidate.packageId, `Activated ${candidate.name}`);

        if (this.componentManager?.reloadActiveCatalog) {
            await this.componentManager.reloadActiveCatalog();
        }

        window.dispatchEvent(new CustomEvent('designit:style-package-activated', {
            detail: {
                packageId: candidate.packageId,
                version: candidate.version,
                name: candidate.name
            }
        }));

        return candidate;
    }

    async rollback(version) {
        const history = this.getHistory();
        const entry = history.find((item) => item.version === version || item.packageId === version);

        if (!entry) {
            throw new Error('Selected style version was not found.');
        }

        if (entry.packageId === 'classic') {
            localStorage.removeItem(this.activeKey);
            this.addAudit('rollback', 'classic', 'Rolled back to Classic DesignIT');
        } else {
            localStorage.setItem(this.activeKey, JSON.stringify(entry.package));
            this.addHistory(entry.package, {
                eventType: 'rollback',
                boardRevision: entry.boardRevision,
                changeSummary: entry.changeSummary || { added: 0, modified: 0, removed: 0, unchanged: 0 }
            });
            this.addAudit('rollback', entry.packageId, `Rolled back to ${entry.name}`);
        }

        if (this.componentManager?.reloadActiveCatalog) {
            await this.componentManager.reloadActiveCatalog();
        }

        window.dispatchEvent(new CustomEvent('designit:style-package-activated', {
            detail: {
                packageId: entry.packageId,
                version: entry.version,
                name: entry.name
            }
        }));
    }

    getHistory() {
        let history = [];
        try {
            const raw = localStorage.getItem(this.historyKey);
            history = raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('Could not read style package history:', error);
        }

        const hasClassic = history.some((entry) => entry.packageId === 'classic');
        if (!hasClassic) {
            history.push({
                packageId: 'classic',
                version: 'classic',
                name: 'Classic DesignIT',
                activatedAt: '2026-09-02T00:00:00.000Z',
                eventType: 'baseline',
                boardRevision: 0,
                validationStatus: 'passed',
                changeSummary: { added: 0, modified: 0, removed: 0, unchanged: 0 },
                package: null
            });
        }

        return history;
    }

    addHistory(packageData, details) {
        const entry = {
            packageId: packageData.packageId,
            version: packageData.version,
            name: packageData.name,
            activatedAt: new Date().toISOString(),
            eventType: details.eventType,
            boardRevision: details.boardRevision,
            validationStatus: packageData.validation?.status || packageData.manifest?.validation?.status || 'passed',
            changeSummary: details.changeSummary,
            package: packageData
        };
        const history = this.getHistory()
            .filter((item) => item.packageId !== 'classic' || item.eventType === 'baseline');

        history.unshift(entry);
        const classic = history.find((item) => item.packageId === 'classic') || {
            packageId: 'classic',
            version: 'classic',
            name: 'Classic DesignIT',
            activatedAt: '2026-09-02T00:00:00.000Z',
            eventType: 'baseline',
            boardRevision: 0,
            validationStatus: 'passed',
            changeSummary: { added: 0, modified: 0, removed: 0, unchanged: 0 },
            package: null
        };
        const retained = [
            ...history.filter((item) => item.packageId !== 'classic').slice(0, this.maxHistory),
            classic
        ];

        localStorage.setItem(this.historyKey, JSON.stringify(retained));
    }

    addAudit(action, packageId, message) {
        const events = this.getAuditEvents();
        events.unshift({
            id: this.createId('audit'),
            action,
            packageId,
            message,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem(this.auditKey, JSON.stringify(events.slice(0, 50)));
    }

    getAuditEvents() {
        try {
            const raw = localStorage.getItem(this.auditKey);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('Could not read audit log:', error);
            return [];
        }
    }

    async exportStylePackage(board, proposal, packageData) {
        if (typeof JSZip === 'undefined') {
            throw new Error('ZIP support is unavailable.');
        }

        const zip = new JSZip();
        const legacyComponents = CatalogAdapter.toLegacyComponents(packageData.catalog, packageData.tokensCss);

        zip.file('moodboard.json', JSON.stringify(board, null, 2));
        zip.file('tokens.json', JSON.stringify(packageData.tokens, null, 2));
        zip.file('tokens.css', packageData.tokensCss);
        zip.file('components/html_components.json', JSON.stringify(legacyComponents, null, 2));
        zip.file('manifest.json', JSON.stringify(packageData.manifest, null, 2));
        zip.file('style-guide.html', this.createStyleGuideHtml(board, proposal, packageData));
        zip.file('README.md', this.createReadme(packageData));
        zip.file('LICENSES.md', this.createLicenses(packageData));

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${CatalogAdapter.safeIdentifier(packageData.name)}-${packageData.version}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    createStyleGuideHtml(board, proposal, packageData) {
        const direction = proposal?.directions?.find((item) => item.id === packageData.source?.directionId);
        const tokens = packageData.tokens.tokens;
        const rows = Object.entries(tokens.color).map(([name, token]) => (
            `<tr><th>${this.escapeHtml(name)}</th><td>${this.escapeHtml(token.value)}</td><td>${this.escapeHtml(token.role)}</td></tr>`
        )).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(packageData.name)} Style Guide</title>
  <style>
    body { color: #172124; font-family: Arial, sans-serif; line-height: 1.6; margin: 2rem; max-width: 960px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8dee2; padding: 0.65rem; text-align: left; }
    th { background: #f3f6f7; }
    code { background: #f3f6f7; padding: 0.15rem 0.25rem; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(packageData.name)}</h1>
  <p>${this.escapeHtml(packageData.summary || direction?.summary || '')}</p>
  <h2>Source</h2>
  <p>Board: ${this.escapeHtml(board.title)}. Board revision: ${board.revision}. Proposal: ${this.escapeHtml(packageData.source?.proposalId || '')}.</p>
  <h2>Colour Tokens</h2>
  <table>
    <thead><tr><th>Token</th><th>Value</th><th>Role</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Compatibility</h2>
  <p>The exported HTML catalogue keeps legacy <code>Title</code>, <code>HTML</code>, <code>CSS</code> and <code>Reference</code> fields for the existing Elements menu.</p>
</body>
</html>`;
    }

    createReadme(packageData) {
        return `# ${packageData.name}

This ZIP was exported from the DesignIT Mood Board and Style Agent local MVP.

## Contents

- moodboard.json: normalized source board
- style-guide.html: human-readable accepted style guide
- tokens.json and tokens.css: design tokens
- components/html_components.json: legacy-compatible styled catalogue
- manifest.json: package provenance and validation summary
- LICENSES.md: declared licence/provenance status

Activation in the studio is local and reversible. Production AI, shared projects and durable server storage should be connected through the backend API contracts in the SDD.
`;
    }

    createLicenses(packageData) {
        const entries = packageData.manifest.licenses || [];
        return `# Licences and Provenance

${entries.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')}

User-uploaded assets are not relicensed by this export. Confirm usage rights before publication.
`;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    createId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }
}

export default StylePackageManager;
