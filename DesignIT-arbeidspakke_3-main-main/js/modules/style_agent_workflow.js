/**
 * StyleAgentWorkflow - Coordinates the four-step Mood Board workspace.
 */
class StyleAgentWorkflow {
    constructor(managers) {
        this.notificationManager = managers.notification;
        this.moodboardManager = managers.moodboard;
        this.assetManager = managers.asset;
        this.proposalManager = managers.proposal;
        this.previewManager = managers.preview;
        this.stylePackageManager = managers.stylePackage;
        this.componentManager = managers.component;
        this.activeStep = 'collect';
        this.selectedProposal = this.proposalManager.proposals[0] || null;
        this.selectedDirectionId = this.selectedProposal?.directions?.[0]?.id || null;
        this.candidate = null;
        this.previewViewport = 'desktop';
        this.saveState = 'Saved locally';
        this.lockedTokens = {
            brandPrimary: false,
            brandAccent: false,
            surface: false,
            typography: false
        };

        this.createShell();
        this.bindEvents();
        this.moodboardManager.onChange((type) => {
            this.saveState = type === 'saving' ? 'Saving...' : type === 'error' ? 'Save failed' : 'Saved locally';
            if (type === 'saved' || type === 'deleted') {
                this.selectedProposal = null;
                this.selectedDirectionId = null;
                this.candidate = null;
            }
            this.updateSaveStateText();
        });
        window.addEventListener('designit:style-package-activated', (event) => this.updateActiveStyleIndicator(event.detail));

        this.render();
        this.updateActiveStyleIndicator(this.componentManager?.activePackage);
    }

    createShell() {
        this.openButton = document.getElementById('moodboard-open');
        this.activeStyleIndicator = document.getElementById('active-style-indicator');
        this.root = document.createElement('section');
        this.root.id = 'moodboard-workspace';
        this.root.className = 'moodboard-workspace hidden';
        this.root.setAttribute('aria-labelledby', 'moodboard-title');
        this.root.setAttribute('aria-modal', 'true');
        this.root.setAttribute('role', 'dialog');
        this.root.innerHTML = `
            <div class="moodboard-backdrop" data-action="close-workspace"></div>
            <div class="moodboard-panel">
                <header class="moodboard-header">
                    <div>
                        <p class="moodboard-kicker">Style Agent</p>
                        <h2 id="moodboard-title">Mood board</h2>
                    </div>
                    <div class="moodboard-header-actions">
                        <span class="moodboard-save-state" id="moodboard-save-state">Saved locally</span>
                        <button class="icon-btn" type="button" data-action="close-workspace" aria-label="Close mood board">x</button>
                    </div>
                </header>
                <nav class="moodboard-steps" aria-label="Mood-board workflow">
                    <button type="button" data-step="collect">Collect</button>
                    <button type="button" data-step="suggest">Suggest</button>
                    <button type="button" data-step="preview">Preview</button>
                    <button type="button" data-step="apply">Apply</button>
                </nav>
                <div class="moodboard-content" id="moodboard-content"></div>
            </div>
        `;
        document.body.appendChild(this.root);
        this.content = this.root.querySelector('#moodboard-content');
    }

    bindEvents() {
        this.openButton?.addEventListener('click', () => this.open());

        this.root.addEventListener('click', async (event) => {
            const actionTarget = event.target.closest('[data-action]');
            const stepTarget = event.target.closest('[data-step]');

            if (stepTarget) {
                this.activeStep = stepTarget.dataset.step;
                this.render();
                return;
            }

            if (!actionTarget) return;
            const action = actionTarget.dataset.action;

            try {
                if (action === 'close-workspace') this.close();
                if (action === 'add-colour') this.addColour();
                if (action === 'add-manual-item') this.addManualItem();
                if (action === 'remove-item') this.removeItem(actionTarget.dataset.itemId);
                if (action === 'move-item') this.moveItem(actionTarget.dataset.itemId, actionTarget.dataset.direction);
                if (action === 'delete-board') this.deleteBoard();
                if (action === 'suggest-style') await this.suggestStyle();
                if (action === 'select-direction') this.selectDirection(actionTarget.dataset.directionId);
                if (action === 'revise-direction') await this.reviseDirection();
                if (action === 'set-preview-viewport') this.setPreviewViewport(actionTarget.dataset.viewport);
                if (action === 'accept-style') await this.acceptStyle();
                if (action === 'export-style') await this.exportStyle();
                if (action === 'rollback-style') await this.rollbackStyle(actionTarget.dataset.version);
            } catch (error) {
                console.error(error);
                this.notificationManager?.showError(error.message || 'The style workflow hit a problem.');
            }
        });

        this.root.addEventListener('input', (event) => {
            const target = event.target;
            if (!target.matches('[data-board-field], [data-token-field], [data-lock-token]')) return;

            if (target.matches('[data-board-field]')) {
                this.updateBoardField(target);
            }
            if (target.matches('[data-token-field]')) {
                this.updateTokenField(target);
            }
            if (target.matches('[data-lock-token]')) {
                this.lockedTokens[target.dataset.lockToken] = target.checked;
            }
        });

        this.root.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.matches('[data-upload-type]')) {
                await this.handleUpload(target);
            }
        });
    }

    open() {
        this.root.classList.remove('hidden');
        this.root.querySelector('.moodboard-panel')?.focus();
        this.render();
    }

    close() {
        this.root.classList.add('hidden');
        this.openButton?.focus();
    }

    render() {
        this.updateSaveStateText();
        this.root.querySelectorAll('[data-step]').forEach((button) => {
            button.classList.toggle('active', button.dataset.step === this.activeStep);
            button.setAttribute('aria-current', button.dataset.step === this.activeStep ? 'step' : 'false');
        });

        const renderers = {
            collect: () => this.renderCollect(),
            suggest: () => this.renderSuggest(),
            preview: () => this.renderPreview(),
            apply: () => this.renderApply()
        };

        this.content.innerHTML = renderers[this.activeStep]();
        if (this.activeStep === 'preview' && this.candidate) {
            requestAnimationFrame(() => {
                this.previewManager.render(
                    this.root.querySelector('#style-preview-frame'),
                    this.root.querySelector('#style-preview-report'),
                    this.candidate,
                    this.previewViewport
                );
            });
        }
    }

    updateSaveStateText() {
        const state = this.root.querySelector('#moodboard-save-state');
        if (state) {
            state.textContent = this.saveState;
        }
    }

    renderCollect() {
        const board = this.moodboardManager.board;
        const summary = this.moodboardManager.getSummary();
        const items = this.moodboardManager.sortedItems();

        return `
            <section class="moodboard-grid moodboard-grid--collect">
                <form class="moodboard-card moodboard-brief" onsubmit="return false;">
                    <div class="moodboard-section-title">
                        <h3>Brand brief</h3>
                        <span>${this.escapeHtml(summary.confidence)} confidence</span>
                    </div>
                    <label>
                        Board title
                        <input data-board-field="title" type="text" value="${this.escapeAttr(board.title)}" maxlength="120">
                    </label>
                    <label>
                        Project purpose
                        <textarea data-board-field="purpose" rows="3" maxlength="500">${this.escapeHtml(board.brief.purpose)}</textarea>
                    </label>
                    <label>
                        Audience
                        <input data-board-field="audience" type="text" value="${this.escapeAttr(board.brief.audience.join(', '))}" placeholder="students, small businesses">
                    </label>
                    <label>
                        Brand attributes
                        <input data-board-field="attributes" type="text" value="${this.escapeAttr(board.brief.attributes.join(', '))}" placeholder="warm, credible, modular">
                    </label>
                    <label>
                        Avoid
                        <input data-board-field="avoid" type="text" value="${this.escapeAttr(board.brief.avoid.join(', '))}" placeholder="generic corporate blue">
                    </label>
                    <label>
                        Accessibility target
                        <select data-board-field="accessibilityTarget">
                            ${['WCAG_2_1_AA', 'WCAG_2_2_AA', 'WCAG_2_2_AAA'].map((value) => (
                                `<option value="${value}" ${board.brief.accessibilityTarget === value ? 'selected' : ''}>${value.replaceAll('_', ' ')}</option>`
                            )).join('')}
                        </select>
                    </label>
                    <label>
                        Notes
                        <textarea data-board-field="notes" rows="3" maxlength="2000">${this.escapeHtml(board.brief.notes)}</textarea>
                    </label>
                    <div class="moodboard-actions">
                        <button class="secondary-btn" type="button" data-action="delete-board">Delete board</button>
                        <button class="primary-btn" type="button" data-action="suggest-style">Suggest style</button>
                    </div>
                </form>

                <div class="moodboard-card">
                    <div class="moodboard-section-title">
                        <h3>Inputs</h3>
                        <span>${summary.itemCount}/30 items</span>
                    </div>
                    <div class="moodboard-upload-row">
                        <label class="upload-tile">
                            Logo
                            <input data-upload-type="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
                        </label>
                        <label class="upload-tile">
                            Images
                            <input data-upload-type="image" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple>
                        </label>
                    </div>
                    <div class="manual-input-row">
                        <input id="mb-colour" type="color" value="#045f6f" aria-label="Colour value">
                        <input id="mb-colour-label" type="text" placeholder="Role label" aria-label="Colour role label">
                        <button type="button" data-action="add-colour">Add colour</button>
                    </div>
                    <div class="manual-input-row">
                        <select id="mb-item-type" aria-label="Item type">
                            <option value="font">Font</option>
                            <option value="layout">Layout</option>
                            <option value="keyword">Keyword</option>
                            <option value="note">Note</option>
                            <option value="avoid">Avoid</option>
                        </select>
                        <input id="mb-item-value" type="text" placeholder="Value or note" aria-label="Mood-board item value">
                        <button type="button" data-action="add-manual-item">Add</button>
                    </div>
                    <p class="moodboard-empty-note ${summary.ready ? 'hidden' : ''}">
                        Minimum useful board: one visual or colour signal plus audience, attributes or notes.
                    </p>
                    <div class="moodboard-items" role="list">
                        ${items.map((item) => this.renderItem(item)).join('') || '<p class="moodboard-empty-note">No items yet.</p>'}
                    </div>
                </div>
            </section>
        `;
    }

    renderItem(item) {
        const preview = ['logo', 'image'].includes(item.type) && item.metadata?.previewUrl
            ? `<img src="${this.escapeAttr(item.metadata.previewUrl)}" alt="">`
            : item.type === 'colour'
                ? `<span class="colour-chip-large" style="background:${this.escapeAttr(item.value)}"></span>`
                : `<span class="item-type-mark">${this.escapeHtml(item.type.slice(0, 2).toUpperCase())}</span>`;

        return `
            <article class="moodboard-item" role="listitem">
                <div class="moodboard-item-preview">${preview}</div>
                <div class="moodboard-item-copy">
                    <strong>${this.escapeHtml(item.label)}</strong>
                    <span>${this.escapeHtml(item.type)}${item.value && item.type !== 'image' && item.type !== 'logo' ? ` - ${this.escapeHtml(item.value)}` : ''}</span>
                </div>
                <div class="moodboard-item-actions">
                    <button class="icon-btn" type="button" data-action="move-item" data-direction="up" data-item-id="${item.id}" aria-label="Move ${this.escapeAttr(item.label)} up">^</button>
                    <button class="icon-btn" type="button" data-action="move-item" data-direction="down" data-item-id="${item.id}" aria-label="Move ${this.escapeAttr(item.label)} down">v</button>
                    <button class="icon-btn" type="button" data-action="remove-item" data-item-id="${item.id}" aria-label="Remove ${this.escapeAttr(item.label)}">x</button>
                </div>
            </article>
        `;
    }

    renderSuggest() {
        if (!this.selectedProposal) {
            return `
                <section class="moodboard-card moodboard-centered">
                    <h3>Proposal queue</h3>
                    <p>The board is revision ${this.moodboardManager.board.revision}. Generate a proposal when the current inputs are ready.</p>
                    <button class="primary-btn" type="button" data-action="suggest-style">Suggest style</button>
                </section>
            `;
        }

        return `
            <section class="moodboard-grid">
                <div class="proposal-list">
                    ${this.selectedProposal.directions.map((direction) => this.renderDirectionCard(direction)).join('')}
                </div>
                <aside class="moodboard-card proposal-detail">
                    ${this.renderSelectedDirectionDetail()}
                </aside>
            </section>
        `;
    }

    renderDirectionCard(direction) {
        const selected = direction.id === this.selectedDirectionId;
        const colors = direction.tokens.color;
        return `
            <article class="proposal-card ${selected ? 'selected' : ''}">
                <div class="proposal-card-header">
                    <h3>${this.escapeHtml(direction.name)}</h3>
                    <span>${this.escapeHtml(direction.confidence.level)}</span>
                </div>
                <p>${this.escapeHtml(direction.summary)}</p>
                <div class="proposal-swatches" aria-hidden="true">
                    ${['brandPrimary', 'brandAccent', 'surface', 'text'].map((key) => (
                        `<span style="background:${this.escapeAttr(colors[key].value)}"></span>`
                    )).join('')}
                </div>
                <button class="${selected ? 'secondary-btn' : 'primary-btn'}" type="button" data-action="select-direction" data-direction-id="${direction.id}">
                    ${selected ? 'Selected' : 'Select'}
                </button>
            </article>
        `;
    }

    renderSelectedDirectionDetail() {
        const direction = this.getSelectedDirection();
        if (!direction) return '<p class="moodboard-empty-note">Choose a proposal to inspect.</p>';

        return `
            <h3>${this.escapeHtml(direction.name)}</h3>
            <p>${this.escapeHtml(direction.summary)}</p>
            <h4>Rationale</h4>
            <ul class="proposal-evidence">
                ${direction.evidence.map((item) => (
                    `<li><strong>${this.escapeHtml(item.label)}:</strong> ${this.escapeHtml(item.observation)}</li>`
                )).join('')}
            </ul>
            <h4>Rules</h4>
            <p>${this.escapeHtml(direction.rules.layout)}</p>
            <p>${this.escapeHtml(direction.rules.components)}</p>
            <div class="token-locks">
                <label><input data-lock-token="brandPrimary" type="checkbox" ${this.lockedTokens.brandPrimary ? 'checked' : ''}> Lock primary</label>
                <label><input data-lock-token="brandAccent" type="checkbox" ${this.lockedTokens.brandAccent ? 'checked' : ''}> Lock accent</label>
                <label><input data-lock-token="surface" type="checkbox" ${this.lockedTokens.surface ? 'checked' : ''}> Lock surfaces</label>
                <label><input data-lock-token="typography" type="checkbox" ${this.lockedTokens.typography ? 'checked' : ''}> Lock type</label>
            </div>
            <label>
                Revision request
                <textarea id="revision-request" rows="3" maxlength="500" placeholder="Make it calmer, warmer, higher contrast..."></textarea>
            </label>
            <div class="moodboard-actions">
                <button class="secondary-btn" type="button" data-action="revise-direction">Request revision</button>
                <button class="primary-btn" type="button" data-step="preview">Preview</button>
            </div>
        `;
    }

    renderPreview() {
        const direction = this.getSelectedDirection();
        if (!direction || !this.candidate) {
            return `
                <section class="moodboard-card moodboard-centered">
                    <h3>Preview</h3>
                    <p>Select a proposal first.</p>
                    <button class="primary-btn" type="button" data-step="suggest">Choose proposal</button>
                </section>
            `;
        }

        return `
            <section class="preview-layout">
                <aside class="moodboard-card token-editor">
                    <div class="moodboard-section-title">
                        <h3>Tokens</h3>
                        <span>${this.escapeHtml(this.candidate.validation.status)}</span>
                    </div>
                    ${this.renderTokenEditor(direction)}
                    <h4>Contrast</h4>
                    <ul class="style-preview-report" id="style-preview-report"></ul>
                </aside>
                <div class="moodboard-card preview-stage">
                    <div class="preview-toolbar">
                        <strong>${this.escapeHtml(direction.name)}</strong>
                        <div class="segmented-control" role="group" aria-label="Preview width">
                            ${['mobile', 'tablet', 'desktop'].map((viewport) => (
                                `<button type="button" data-action="set-preview-viewport" data-viewport="${viewport}" class="${this.previewViewport === viewport ? 'active' : ''}">${viewport}</button>`
                            )).join('')}
                        </div>
                    </div>
                    <div class="iframe-shell">
                        <iframe id="style-preview-frame" title="Candidate style preview"></iframe>
                    </div>
                    <div class="moodboard-actions">
                        <button class="secondary-btn" type="button" data-step="suggest">Back to proposals</button>
                        <button class="primary-btn" type="button" data-step="apply">Review changes</button>
                    </div>
                </div>
            </section>
        `;
    }

    renderTokenEditor(direction) {
        const colors = direction.tokens.color;
        const fonts = direction.tokens.font;
        const colorFields = [
            ['brandPrimary', 'Primary'],
            ['brandAccent', 'Accent'],
            ['surface', 'Surface'],
            ['surfaceMuted', 'Muted surface'],
            ['text', 'Text']
        ];

        return `
            <div class="token-grid">
                ${colorFields.map(([key, label]) => `
                    <label>
                        ${label}
                        <input data-token-field="color.${key}.value" type="color" value="${this.escapeAttr(colors[key].value)}">
                    </label>
                `).join('')}
                <label class="token-grid-wide">
                    Heading font
                    <input data-token-field="font.heading.value" type="text" value="${this.escapeAttr(fonts.heading.value)}">
                </label>
                <label class="token-grid-wide">
                    Body font
                    <input data-token-field="font.body.value" type="text" value="${this.escapeAttr(fonts.body.value)}">
                </label>
            </div>
        `;
    }

    renderApply() {
        const history = this.stylePackageManager.getHistory();
        const validation = this.candidate?.validation;

        return `
            <section class="moodboard-grid">
                <div class="moodboard-card">
                    <div class="moodboard-section-title">
                        <h3>Validation and diff</h3>
                        <span>${validation ? this.escapeHtml(validation.status) : 'No candidate'}</span>
                    </div>
                    ${validation ? this.renderValidation(validation) : '<p class="moodboard-empty-note">Preview a proposal to create a candidate package.</p>'}
                    <div class="moodboard-actions">
                        <button class="secondary-btn" type="button" data-action="export-style" ${this.candidate ? '' : 'disabled'}>Export style ZIP</button>
                        <button class="primary-btn" type="button" data-action="accept-style" ${this.candidate && validation.status !== 'failed' ? '' : 'disabled'}>Accept and apply style</button>
                    </div>
                </div>
                <aside class="moodboard-card">
                    <div class="moodboard-section-title">
                        <h3>Version history</h3>
                        <span>${history.length} versions</span>
                    </div>
                    <div class="version-list">
                        ${history.map((entry) => this.renderHistoryEntry(entry)).join('')}
                    </div>
                </aside>
            </section>
        `;
    }

    renderValidation(validation) {
        return `
            <dl class="diff-grid">
                <div><dt>Added</dt><dd>${validation.diff.added}</dd></div>
                <div><dt>Modified</dt><dd>${validation.diff.modified}</dd></div>
                <div><dt>Removed</dt><dd>${validation.diff.removed}</dd></div>
                <div><dt>Unchanged</dt><dd>${validation.diff.unchanged}</dd></div>
            </dl>
            <ul class="validation-list">
                ${validation.errors.map((message) => `<li class="style-report-fail">${this.escapeHtml(message)}</li>`).join('')}
                ${validation.warnings.map((message) => `<li class="style-report-warn">${this.escapeHtml(message)}</li>`).join('')}
                ${!validation.errors.length && !validation.warnings.length ? '<li class="style-report-pass">All package checks passed.</li>' : ''}
            </ul>
        `;
    }

    renderHistoryEntry(entry) {
        const date = new Date(entry.activatedAt).toLocaleString();
        return `
            <article class="version-entry">
                <div>
                    <strong>${this.escapeHtml(entry.name)}</strong>
                    <span>${this.escapeHtml(entry.eventType)} - ${this.escapeHtml(date)}</span>
                </div>
                <button class="secondary-btn" type="button" data-action="rollback-style" data-version="${this.escapeAttr(entry.version)}">Rollback</button>
            </article>
        `;
    }

    updateBoardField(target) {
        const field = target.dataset.boardField;
        if (field === 'title') {
            this.moodboardManager.updateTitle(target.value);
            return;
        }
        this.moodboardManager.updateBriefField(field, target.value);
    }

    updateTokenField(target) {
        const direction = this.getSelectedDirection();
        if (!direction) return;

        const path = target.dataset.tokenField.split('.');
        let cursor = direction.tokens;
        path.slice(0, -1).forEach((part) => {
            cursor = cursor[part];
        });
        cursor[path[path.length - 1]] = target.value;
        this.candidate = this.stylePackageManager.createCandidate(direction, this.moodboardManager.board, this.selectedProposal);
        this.previewManager.render(
            this.root.querySelector('#style-preview-frame'),
            this.root.querySelector('#style-preview-report'),
            this.candidate,
            this.previewViewport
        );
        const status = this.root.querySelector('.token-editor .moodboard-section-title span');
        if (status) {
            status.textContent = this.candidate.validation.status;
        }
    }

    addColour() {
        const value = this.root.querySelector('#mb-colour')?.value || '#045f6f';
        const label = this.root.querySelector('#mb-colour-label')?.value || value.toUpperCase();
        const existing = this.moodboardManager.board.items.some((item) => item.type === 'colour' && item.value.toLowerCase() === value.toLowerCase());
        if (existing) {
            this.notificationManager?.showInfo('That colour is already on the board.');
            return;
        }
        this.moodboardManager.addManualItem('colour', value, label);
        this.render();
    }

    addManualItem() {
        const type = this.root.querySelector('#mb-item-type')?.value || 'note';
        const valueField = this.root.querySelector('#mb-item-value');
        const value = valueField?.value || '';
        this.moodboardManager.addManualItem(type, value);
        if (valueField) valueField.value = '';
        this.render();
    }

    async handleUpload(input) {
        const type = input.dataset.uploadType;
        const items = await this.assetManager.createItemsFromFiles(input.files, type);
        this.moodboardManager.addItems(items);
        input.value = '';
        this.render();
    }

    removeItem(itemId) {
        this.moodboardManager.removeItem(itemId);
        this.render();
    }

    moveItem(itemId, direction) {
        this.moodboardManager.moveItem(itemId, direction);
        this.render();
    }

    deleteBoard() {
        if (!window.confirm('Delete the current local mood board? Active style packages stay available.')) return;
        this.moodboardManager.deleteBoard();
        this.selectedProposal = null;
        this.selectedDirectionId = null;
        this.candidate = null;
        this.notificationManager?.showInfo('Mood board deleted.');
        this.render();
    }

    async suggestStyle() {
        this.saveState = 'Analysing...';
        this.render();
        await new Promise((resolve) => setTimeout(resolve, 250));
        this.moodboardManager.save({ status: 'analysing', preserveProposals: true, incrementRevision: false });
        const proposal = await this.proposalManager.generate(this.moodboardManager.board);
        this.selectedProposal = proposal;
        this.selectedDirectionId = proposal.directions[0].id;
        this.moodboardManager.save({ status: 'proposed', preserveProposals: true, incrementRevision: false });
        this.candidate = this.stylePackageManager.createCandidate(this.getSelectedDirection(), this.moodboardManager.board, proposal);
        this.activeStep = 'suggest';
        this.notificationManager?.showSuccess('Style proposal ready.');
        this.render();
    }

    selectDirection(directionId) {
        this.selectedDirectionId = directionId;
        this.candidate = this.stylePackageManager.createCandidate(this.getSelectedDirection(), this.moodboardManager.board, this.selectedProposal);
        this.render();
    }

    async reviseDirection() {
        const instruction = this.root.querySelector('#revision-request')?.value?.trim() || '';
        if (!instruction) {
            throw new Error('Add a short revision request first.');
        }
        if (instruction.length > 500) {
            throw new Error('Revision requests are limited to 500 characters.');
        }

        const proposal = await this.proposalManager.revise(
            this.selectedProposal,
            this.selectedDirectionId,
            instruction,
            this.lockedTokens
        );
        this.selectedProposal = proposal;
        this.selectedDirectionId = proposal.directions[0].id;
        this.candidate = this.stylePackageManager.createCandidate(this.getSelectedDirection(), this.moodboardManager.board, proposal);
        this.notificationManager?.showSuccess('Revision created.');
        this.render();
    }

    setPreviewViewport(viewport) {
        this.previewViewport = viewport;
        this.render();
    }

    async acceptStyle() {
        if (!this.candidate) {
            throw new Error('Preview a candidate package before activation.');
        }

        const diff = this.candidate.validation.diff;
        const confirmed = window.confirm(`Activate ${this.candidate.name}? This adds ${diff.added} styled components and keeps the previous style available for rollback.`);
        if (!confirmed) return;

        if (diff.removed > 0) {
            const destructiveConfirmed = window.confirm('This candidate removes components. Confirm removal before activation.');
            if (!destructiveConfirmed) return;
        }

        await this.stylePackageManager.activateCandidate(this.candidate, this.moodboardManager.board);
        this.moodboardManager.save({ status: 'accepted', preserveProposals: true, incrementRevision: false });
        this.notificationManager?.showSuccess('Style package activated.');
        this.render();
    }

    async exportStyle() {
        if (!this.candidate) {
            throw new Error('Create a candidate package before export.');
        }
        await this.stylePackageManager.exportStylePackage(
            this.moodboardManager.toManifest(),
            this.selectedProposal,
            this.candidate
        );
        this.notificationManager?.showSuccess('Style package exported.');
    }

    async rollbackStyle(version) {
        const confirmed = window.confirm('Activate this earlier style version? Current history will be kept.');
        if (!confirmed) return;
        await this.stylePackageManager.rollback(version);
        this.notificationManager?.showSuccess('Style rollback complete.');
        this.render();
    }

    getSelectedDirection() {
        return this.selectedProposal?.directions?.find((direction) => direction.id === this.selectedDirectionId) || null;
    }

    updateActiveStyleIndicator(packageData = {}) {
        if (!this.activeStyleIndicator) return;
        const name = packageData?.name || packageData?.manifest?.name || 'Classic DesignIT';
        const version = packageData?.version || packageData?.manifest?.version || 'classic';
        this.activeStyleIndicator.textContent = `${name} (${version})`;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    escapeAttr(value) {
        return this.escapeHtml(value).replace(/`/g, '&#096;');
    }
}

export default StyleAgentWorkflow;
