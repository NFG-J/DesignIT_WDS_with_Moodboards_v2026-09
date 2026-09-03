import CatalogAdapter from './catalog_adapter.js';

/**
 * PreviewManager - Renders candidate style packages in a sandboxed iframe and
 * reports basic contrast checks before activation.
 */
class PreviewManager {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.widths = {
            mobile: 320,
            tablet: 768,
            desktop: 1120
        };
    }

    render(frame, reportElement, packageData, viewport = 'desktop') {
        if (!frame || !packageData) return;

        const width = this.widths[viewport] || this.widths.desktop;
        frame.setAttribute('sandbox', '');
        frame.style.width = `${width}px`;
        frame.srcdoc = this.createPreviewHtml(packageData);

        if (reportElement) {
            reportElement.innerHTML = '';
            this.createContrastReport(packageData).forEach((item) => {
                const row = document.createElement('li');
                row.className = item.pass ? 'style-report-pass' : 'style-report-fail';
                row.textContent = `${item.label}: ${item.value} (${item.pass ? 'pass' : 'needs work'})`;
                reportElement.appendChild(row);
            });
        }
    }

    createPreviewHtml(packageData) {
        const components = packageData.catalog.components || [];
        const css = [
            packageData.tokensCss,
            ...components.map((component) => component.css)
        ].join('\n\n');
        const body = components.map((component) => component.html).join('\n\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(packageData.name)} Preview</title>
  <style>
    * { box-sizing: border-box; }
    body {
      background: #eef1f3;
      margin: 0;
      padding: 20px;
    }
    main {
      background: transparent;
      display: grid;
      gap: 16px;
      margin: 0 auto;
      max-width: 1080px;
      min-width: 0;
    }
    ${css}
    @media (max-width: 520px) {
      body { padding: 10px; }
      .ds-links { width: 100%; }
      .ds-header { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body>
  <main aria-label="Candidate style preview">
    ${body}
  </main>
</body>
</html>`;
    }

    createContrastReport(packageData) {
        const colors = packageData.tokens.tokens.color;
        const checks = [
            {
                label: 'Body text on surface',
                ratio: CatalogAdapter.contrastRatio(colors.surface.value, colors.text.value),
                threshold: 4.5
            },
            {
                label: 'Body text on muted surface',
                ratio: CatalogAdapter.contrastRatio(colors.surfaceMuted.value, colors.text.value),
                threshold: 4.5
            },
            {
                label: 'Primary action label',
                ratio: CatalogAdapter.contrastRatio(colors.brandPrimary.value, CatalogAdapter.readableTextFor(colors.brandPrimary.value)),
                threshold: 4.5
            },
            {
                label: 'Accent action label',
                ratio: CatalogAdapter.contrastRatio(colors.brandAccent.value, CatalogAdapter.readableTextFor(colors.brandAccent.value)),
                threshold: 4.5
            }
        ];

        return checks.map((check) => ({
            label: check.label,
            value: `${check.ratio.toFixed(2)}:1`,
            pass: check.ratio >= check.threshold
        }));
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

export default PreviewManager;
