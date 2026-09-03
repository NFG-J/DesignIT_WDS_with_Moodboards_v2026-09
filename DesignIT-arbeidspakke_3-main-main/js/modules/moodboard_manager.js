/**
 * MoodboardManager - Owns the local mood-board lifecycle and autosave state.
 */
class MoodboardManager {
    constructor(notificationManager, options = {}) {
        this.notificationManager = notificationManager;
        this.storageKey = options.storageKey || 'designit.moodboard.default';
        this.projectId = options.projectId || 'designit-local-demo';
        this.maxItems = 30;
        this.saveDelay = 350;
        this.saveTimer = null;
        this.listeners = new Set();
        this.board = this.load() || this.createDefaultBoard();
    }

    createDefaultBoard() {
        const now = new Date().toISOString();
        return {
            schemaVersion: '1.0',
            id: this.createId('mb'),
            projectId: this.projectId,
            revision: 1,
            title: 'Untitled mood board',
            ownerSession: this.getSessionId(),
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            brief: {
                purpose: '',
                audience: [],
                attributes: [],
                avoid: [],
                accessibilityTarget: 'WCAG_2_2_AA',
                notes: ''
            },
            items: []
        };
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('Could not load mood board:', error);
            return null;
        }
    }

    save({ incrementRevision = true, status, preserveProposals = false } = {}) {
        if (incrementRevision) {
            this.board.revision += 1;
        }
        if (status) {
            this.board.status = status;
        }
        this.board.updatedAt = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(this.board));
        this.emit(preserveProposals ? 'status-saved' : 'saved');
        return this.board;
    }

    scheduleSave() {
        clearTimeout(this.saveTimer);
        this.emit('saving');
        this.saveTimer = setTimeout(() => {
            try {
                this.save();
            } catch (error) {
                this.emit('error', error);
                this.notificationManager?.showError('Mood board could not be saved locally.');
            }
        }, this.saveDelay);
    }

    deleteBoard() {
        localStorage.removeItem(this.storageKey);
        this.board = this.createDefaultBoard();
        this.save({ incrementRevision: false });
        this.emit('deleted');
        return this.board;
    }

    updateTitle(title) {
        this.board.title = title.trim() || 'Untitled mood board';
        this.scheduleSave();
    }

    updateBriefField(field, value) {
        if (!Object.prototype.hasOwnProperty.call(this.board.brief, field)) return;
        this.board.brief[field] = Array.isArray(this.board.brief[field])
            ? this.toList(value)
            : value;
        this.scheduleSave();
    }

    setBrief(updates = {}) {
        Object.entries(updates).forEach(([field, value]) => {
            if (Object.prototype.hasOwnProperty.call(this.board.brief, field)) {
                this.board.brief[field] = Array.isArray(this.board.brief[field])
                    ? this.toList(value)
                    : value;
            }
        });
        this.scheduleSave();
    }

    addManualItem(type, value, label = '', notes = '') {
        if (!value.trim()) {
            throw new Error('Add a value before saving the item.');
        }
        const item = {
            id: this.createId('item'),
            type,
            source: 'manual',
            label: label.trim() || this.defaultLabelFor(type, value),
            value: value.trim(),
            notes: notes.trim(),
            sortOrder: this.nextSortOrder(),
            createdAt: new Date().toISOString(),
            metadata: {}
        };
        this.addItem(item);
        return item;
    }

    addItems(items) {
        items.forEach((item) => this.addItem(item, { deferSave: true }));
        this.resequenceItems();
        this.scheduleSave();
    }

    addItem(item, { deferSave = false } = {}) {
        if (this.board.items.length >= this.maxItems) {
            throw new Error(`Mood boards support up to ${this.maxItems} items.`);
        }
        this.board.items.push({
            ...item,
            sortOrder: item.sortOrder || this.nextSortOrder()
        });
        this.board.status = this.hasMinimumInputs() ? 'ready' : 'draft';
        if (!deferSave) {
            this.scheduleSave();
        }
    }

    removeItem(itemId) {
        this.board.items = this.board.items.filter((item) => item.id !== itemId);
        this.resequenceItems();
        this.board.status = this.hasMinimumInputs() ? 'ready' : 'draft';
        this.scheduleSave();
    }

    moveItem(itemId, direction) {
        const index = this.sortedItems().findIndex((item) => item.id === itemId);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const sorted = this.sortedItems();

        if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) return;

        [sorted[index], sorted[targetIndex]] = [sorted[targetIndex], sorted[index]];
        this.board.items = sorted;
        this.resequenceItems();
        this.scheduleSave();
    }

    updateItem(itemId, updates = {}) {
        const item = this.board.items.find((entry) => entry.id === itemId);
        if (!item) return;
        Object.assign(item, updates);
        this.scheduleSave();
    }

    sortedItems() {
        return [...this.board.items].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    resequenceItems() {
        this.board.items = this.sortedItems().map((item, index) => ({
            ...item,
            sortOrder: (index + 1) * 10
        }));
    }

    nextSortOrder() {
        const max = this.board.items.reduce((highest, item) => Math.max(highest, item.sortOrder || 0), 0);
        return max + 10;
    }

    hasMinimumInputs() {
        const hasVisual = this.board.items.some((item) => ['logo', 'image', 'colour', 'layout'].includes(item.type));
        const hasColour = this.board.items.filter((item) => item.type === 'colour').length >= 1;
        const hasTextSignal = this.board.brief.audience.length
            || this.board.brief.attributes.length
            || this.board.items.some((item) => ['keyword', 'note', 'font'].includes(item.type));

        return hasVisual && (hasColour || hasTextSignal);
    }

    getSummary() {
        const counts = this.board.items.reduce((summary, item) => {
            summary[item.type] = (summary[item.type] || 0) + 1;
            return summary;
        }, {});

        return {
            itemCount: this.board.items.length,
            counts,
            ready: this.hasMinimumInputs(),
            confidence: this.estimateConfidence()
        };
    }

    estimateConfidence() {
        let score = 0;
        const types = new Set(this.board.items.map((item) => item.type));
        if (types.has('logo')) score += 2;
        if (types.has('image')) score += 2;
        if (types.has('colour')) score += Math.min(3, this.board.items.filter((item) => item.type === 'colour').length);
        if (types.has('font')) score += 1;
        if (this.board.brief.audience.length) score += 1;
        if (this.board.brief.attributes.length >= 2) score += 2;
        if (this.board.brief.avoid.length) score += 1;
        if (score >= 8) return 'high';
        if (score >= 4) return 'medium';
        return 'low';
    }

    toManifest() {
        return {
            ...this.board,
            items: this.sortedItems().map((item) => ({
                ...item,
                metadata: {
                    ...item.metadata,
                    previewUrl: item.metadata?.previewUrl ? '[local-preview-derivative]' : undefined
                }
            }))
        };
    }

    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(type, payload) {
        this.listeners.forEach((listener) => listener(type, payload, this.board));
    }

    toList(value) {
        if (Array.isArray(value)) {
            return value.map((item) => String(item).trim()).filter(Boolean);
        }
        return String(value || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    defaultLabelFor(type, value) {
        const cleanValue = String(value || '').trim();
        const labels = {
            colour: cleanValue.toUpperCase(),
            font: cleanValue,
            layout: 'Layout reference',
            keyword: cleanValue,
            note: 'Note',
            avoid: 'Avoid'
        };
        return labels[type] || cleanValue || 'Mood-board item';
    }

    getSessionId() {
        const key = 'designit.localSession';
        const existing = localStorage.getItem(key);
        if (existing) return existing;
        const sessionId = this.createId('session');
        localStorage.setItem(key, sessionId);
        return sessionId;
    }

    createId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }
}

export default MoodboardManager;
