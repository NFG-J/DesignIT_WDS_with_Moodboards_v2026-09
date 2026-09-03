import CatalogAdapter from './catalog_adapter.js';

/**
 * ProposalManager - Creates schema-shaped style proposals through a local
 * mock provider. It mirrors the agent contract without calling an AI service.
 */
class ProposalManager {
    constructor(notificationManager, options = {}) {
        this.notificationManager = notificationManager;
        this.storageKey = options.storageKey || 'designit.styleProposals';
        this.proposals = this.loadProposals();
    }

    async generate(board) {
        if (!board) {
            throw new Error('A mood board is required before generating proposals.');
        }

        const proposal = {
            schemaVersion: '1.0',
            id: this.createId('proposal'),
            version: 1,
            boardId: board.id,
            boardRevision: board.revision,
            createdAt: new Date().toISOString(),
            directions: this.createDirections(board)
        };

        this.proposals.unshift(proposal);
        this.proposals = this.proposals.slice(0, 12);
        this.saveProposals();

        return proposal;
    }

    async revise(proposal, directionId, instruction, lockedTokens = {}) {
        const sourceDirection = proposal.directions.find((direction) => direction.id === directionId);
        if (!sourceDirection) {
            throw new Error('Choose a proposal before asking for a revision.');
        }

        const revisedDirection = structuredClone(sourceDirection);
        revisedDirection.id = this.createId('direction');
        revisedDirection.name = `${sourceDirection.name} Refined`;
        revisedDirection.summary = `${sourceDirection.summary} Revision note: ${instruction.trim().slice(0, 180)}`;
        revisedDirection.evidence = [
            ...sourceDirection.evidence,
            {
                itemId: 'revision_request',
                label: 'Revision request',
                observation: instruction.trim().slice(0, 220)
            }
        ];
        revisedDirection.tokens = this.applyRevisionToTokens(revisedDirection.tokens, instruction, lockedTokens);
        revisedDirection.confidence = {
            level: sourceDirection.confidence.level,
            notes: `${sourceDirection.confidence.notes} Locked tokens were preserved during revision.`
        };

        const revisedProposal = {
            ...proposal,
            id: this.createId('proposal'),
            version: proposal.version + 1,
            createdAt: new Date().toISOString(),
            directions: [revisedDirection, ...proposal.directions.filter((direction) => direction.id !== directionId)]
        };

        this.proposals.unshift(revisedProposal);
        this.proposals = this.proposals.slice(0, 12);
        this.saveProposals();
        return revisedProposal;
    }

    createDirections(board) {
        const attributes = board.brief.attributes.length ? board.brief.attributes : ['clear', 'usable', 'structured'];
        const audience = board.brief.audience.length ? board.brief.audience.join(', ') : 'web design learners';
        const colours = this.getBoardColours(board);
        const fontSignals = this.getFontSignals(board);
        const evidence = this.createEvidence(board);
        const confidence = board.items.length >= 8
            ? { level: 'high', notes: 'The board includes several visual and written signals.' }
            : board.items.length >= 4
                ? { level: 'medium', notes: 'The board is usable, but more references would sharpen the direction.' }
                : { level: 'low', notes: 'The board is sparse; this proposal makes conservative assumptions.' };

        const base = {
            audience,
            attributes,
            evidence,
            confidence,
            target: board.brief.accessibilityTarget
        };

        return [
            this.createDirection({
                ...base,
                id: 'direction_primary',
                name: this.nameDirection(attributes, 'Coherent'),
                primary: colours[0] || '#045f6f',
                accent: colours[1] || '#c35a2e',
                surface: '#fffdf7',
                surfaceMuted: '#f3efe5',
                text: '#172124',
                fonts: fontSignals.primary,
                layout: 'Use a measured editorial grid with generous whitespace, strong headings and compact controls.',
                imagery: 'Use selected references as tone signals; avoid assuming factual brand provenance.',
                components: 'Buttons are direct and high contrast; cards use soft borders and reusable token spacing.'
            }),
            this.createDirection({
                ...base,
                id: 'direction_alt_quiet',
                name: this.nameDirection(attributes, 'Quiet System'),
                primary: colours[2] || '#38424a',
                accent: colours[0] || '#0e7490',
                surface: '#f7f8f6',
                surfaceMuted: '#e8ece8',
                text: '#1d2528',
                fonts: fontSignals.quiet,
                layout: 'Use denser panels, restrained spacing and clear information hierarchy for repeated work.',
                imagery: 'Crop references calmly and keep decoration secondary to structure.',
                components: 'Controls stay compact, predictable and easy to scan.'
            }),
            this.createDirection({
                ...base,
                id: 'direction_alt_expressive',
                name: this.nameDirection(attributes, 'Expressive'),
                primary: colours[1] || '#78350f',
                accent: colours[3] || '#0f766e',
                surface: '#fffaf2',
                surfaceMuted: '#f1e4d0',
                text: '#251b14',
                fonts: fontSignals.expressive,
                layout: 'Use larger headings, section rhythm and warm surfaces for stronger personality.',
                imagery: 'Let references influence crops, contrast and page rhythm without copying them.',
                components: 'Cards and CTAs feel more prominent while keeping semantic markup intact.'
            })
        ];
    }

    createDirection(config) {
        return {
            id: config.id,
            name: config.name,
            summary: `${config.name} translates the mood board into a ${config.attributes.slice(0, 3).join(', ')} visual system for ${config.audience}.`,
            evidence: config.evidence,
            brandAttributes: config.attributes,
            tokens: this.createTokens(config),
            rules: {
                layout: config.layout,
                imagery: config.imagery,
                components: config.components,
                motion: 'Use short transitions under 200ms and respect reduced-motion preferences.'
            },
            accessibility: {
                target: config.target,
                observations: [
                    'Primary text and button labels are checked against generated surfaces.',
                    'Locked brand colours are reported if they cannot meet the contrast target.'
                ],
                risks: [
                    'User-uploaded image rights and font licences are not verified by the local mock provider.'
                ]
            },
            confidence: config.confidence
        };
    }

    createTokens(config) {
        return {
            color: {
                brandPrimary: {
                    value: this.ensureStrongColor(config.primary),
                    role: 'primary actions and brand anchors'
                },
                brandAccent: {
                    value: this.ensureDistinctColor(config.accent, config.primary),
                    role: 'secondary emphasis and focus moments'
                },
                surface: {
                    value: config.surface,
                    role: 'page and component background'
                },
                surfaceMuted: {
                    value: config.surfaceMuted,
                    role: 'cards and quiet panels'
                },
                text: {
                    value: config.text,
                    role: 'body and heading text'
                }
            },
            font: {
                heading: {
                    value: config.fonts.heading
                },
                body: {
                    value: config.fonts.body
                },
                mono: {
                    value: 'Consolas, Monaco, monospace'
                }
            },
            space: {
                '2': '0.5rem',
                '3': '0.75rem',
                '4': '1rem',
                '6': '1.5rem',
                '8': '2rem'
            },
            radius: {
                sm: config.fonts.radiusSm,
                md: config.fonts.radiusMd
            },
            shadow: {
                sm: '0 8px 22px rgba(23, 33, 36, 0.08)'
            },
            motion: {
                durationFast: '160ms',
                easing: 'ease'
            }
        };
    }

    applyRevisionToTokens(tokens, instruction, lockedTokens) {
        const revised = structuredClone(tokens);
        const lower = instruction.toLowerCase();
        const color = revised.color;

        if (!lockedTokens.brandPrimary && (lower.includes('bold') || lower.includes('stronger') || lower.includes('contrast'))) {
            color.brandPrimary.value = this.adjustHex(color.brandPrimary.value, -18);
        }
        if (!lockedTokens.brandAccent && (lower.includes('warm') || lower.includes('friend'))) {
            color.brandAccent.value = '#c35a2e';
        }
        if (!lockedTokens.brandAccent && (lower.includes('calm') || lower.includes('cool'))) {
            color.brandAccent.value = '#0e7490';
        }
        if (!lockedTokens.surface && (lower.includes('dark'))) {
            color.surface.value = '#172124';
            color.surfaceMuted.value = '#223038';
            color.text.value = '#f8fbfa';
        }
        if (!lockedTokens.surface && (lower.includes('light') || lower.includes('air'))) {
            color.surface.value = '#fffdf7';
            color.surfaceMuted.value = '#f5f0e7';
            color.text.value = '#172124';
        }
        if (!lockedTokens.typography && (lower.includes('formal') || lower.includes('editorial'))) {
            revised.font.heading.value = 'Georgia, "Times New Roman", serif';
        }
        if (!lockedTokens.typography && (lower.includes('modern') || lower.includes('clean'))) {
            revised.font.heading.value = 'Inter, Arial, sans-serif';
            revised.font.body.value = 'Inter, Arial, sans-serif';
        }

        return revised;
    }

    createEvidence(board) {
        const items = [...board.items]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .slice(0, 6);

        if (!items.length) {
            return [{
                itemId: 'brief',
                label: 'Project brief',
                observation: 'No visual references were supplied, so the proposal relies on the written brief.'
            }];
        }

        return items.map((item) => ({
            itemId: item.id,
            label: item.label,
            observation: this.observationFor(item)
        }));
    }

    observationFor(item) {
        const observations = {
            logo: 'Logo upload informs brand weight and clear-space assumptions.',
            image: 'Image reference informs contrast, texture and composition.',
            colour: `${item.value.toUpperCase()} is treated as an explicit colour signal.`,
            font: `${item.value} informs the typography stack and tone.`,
            layout: 'Layout reference informs spacing and responsive rhythm.',
            keyword: `${item.value} is used as a brand attribute signal.`,
            note: 'Note provides project-specific intent.',
            avoid: 'Avoid item constrains the generated direction.'
        };
        return observations[item.type] || 'Mood-board item used as a style signal.';
    }

    getBoardColours(board) {
        return board.items
            .filter((item) => item.type === 'colour' && /^#[0-9a-f]{6}$/i.test(item.value))
            .map((item) => item.value);
    }

    getFontSignals(board) {
        const fontItem = board.items.find((item) => item.type === 'font');
        const value = fontItem?.value || '';
        const wantsSerif = /serif|classic|editorial|heritage/i.test(value);
        const wantsMono = /mono|code|technical/i.test(value);

        return {
            primary: {
                heading: wantsSerif ? 'Georgia, "Times New Roman", serif' : 'Inter, Arial, sans-serif',
                body: wantsMono ? 'Consolas, Arial, sans-serif' : 'Inter, Arial, sans-serif',
                radiusSm: '0.375rem',
                radiusMd: '0.75rem'
            },
            quiet: {
                heading: 'Verdana, Geneva, sans-serif',
                body: 'Arial, sans-serif',
                radiusSm: '0.25rem',
                radiusMd: '0.5rem'
            },
            expressive: {
                heading: wantsSerif ? 'Georgia, "Times New Roman", serif' : 'Trebuchet MS, Arial, sans-serif',
                body: 'Arial, sans-serif',
                radiusSm: '0.5rem',
                radiusMd: '0.875rem'
            }
        };
    }

    nameDirection(attributes, suffix) {
        const lead = attributes[0] || 'Guided';
        const cleanedLead = lead.charAt(0).toUpperCase() + lead.slice(1);
        return `${cleanedLead} ${suffix}`;
    }

    ensureStrongColor(hex) {
        const safe = CatalogAdapter.hexValue(hex, '#045f6f');
        return CatalogAdapter.contrastRatio(safe, '#ffffff') >= 4.5 || CatalogAdapter.contrastRatio(safe, '#111111') >= 4.5
            ? safe
            : this.adjustHex(safe, -24);
    }

    ensureDistinctColor(accent, primary) {
        const safeAccent = CatalogAdapter.hexValue(accent, '#c35a2e');
        const safePrimary = CatalogAdapter.hexValue(primary, '#045f6f');
        return safeAccent.toLowerCase() === safePrimary.toLowerCase()
            ? '#c35a2e'
            : safeAccent;
    }

    adjustHex(hex, amount) {
        const channels = CatalogAdapter.hexToRgb(hex).map((channel) => {
            const adjusted = channel + amount;
            return Math.max(0, Math.min(255, adjusted));
        });
        return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    loadProposals() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('Could not load proposal history:', error);
            return [];
        }
    }

    saveProposals() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.proposals));
    }

    createId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }
}

export default ProposalManager;
