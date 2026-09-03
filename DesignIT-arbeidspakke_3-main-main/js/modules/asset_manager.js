/**
 * AssetManager - Handles local upload checks, SVG sanitisation and preview
 * derivatives for the mood-board workflow.
 */
class AssetManager {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.maxRasterBytes = 10 * 1024 * 1024;
        this.maxSvgBytes = 2 * 1024 * 1024;
        this.allowedRasterTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
        this.allowedSvgTypes = new Set(['image/svg+xml']);
    }

    async createItemsFromFiles(fileList, itemType = 'image') {
        const files = Array.from(fileList || []);
        const items = [];

        for (const file of files) {
            const item = await this.createItemFromFile(file, itemType);
            items.push(item);
        }

        return items;
    }

    async createItemFromFile(file, itemType) {
        this.validateFile(file);
        const isSvg = this.isSvg(file);
        const previewUrl = isSvg
            ? await this.createSanitizedSvgPreview(file)
            : await this.createRasterPreview(file);

        return {
            id: this.createId('item'),
            type: itemType,
            source: 'upload',
            assetId: this.createId('asset'),
            label: this.readableFilename(file.name),
            value: previewUrl,
            notes: '',
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            metadata: {
                originalName: file.name,
                mimeType: file.type,
                size: file.size,
                previewUrl,
                provenance: 'user-uploaded local preview derivative'
            }
        };
    }

    validateFile(file) {
        if (!file) {
            throw new Error('No file selected.');
        }

        const mimeType = file.type || '';
        if (!this.allowedRasterTypes.has(mimeType) && !this.allowedSvgTypes.has(mimeType)) {
            throw new Error(`${file.name} is not an accepted image type.`);
        }

        const limit = this.isSvg(file) ? this.maxSvgBytes : this.maxRasterBytes;
        if (file.size > limit) {
            const maxMb = Math.round(limit / 1024 / 1024);
            throw new Error(`${file.name} is larger than the ${maxMb} MB limit.`);
        }
    }

    isSvg(file) {
        return this.allowedSvgTypes.has(file.type);
    }

    async createRasterPreview(file) {
        const dataUrl = await this.readAsDataUrl(file);
        const image = await this.loadImage(dataUrl);
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: true });

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);

        try {
            return canvas.toDataURL('image/webp', 0.86);
        } catch (error) {
            console.warn('WebP preview failed; falling back to PNG preview:', error);
            return canvas.toDataURL('image/png');
        }
    }

    async createSanitizedSvgPreview(file) {
        const svgText = await this.readAsText(file);
        const safeSvg = this.sanitizeSvg(svgText);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSvg)}`;
    }

    sanitizeSvg(svgText) {
        const parser = new DOMParser();
        const documentNode = parser.parseFromString(svgText, 'image/svg+xml');

        if (documentNode.querySelector('parsererror')) {
            throw new Error('SVG could not be parsed.');
        }

        const blockedTags = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'link', 'meta'];
        if (blockedTags.some((tag) => documentNode.querySelector(tag))) {
            throw new Error('SVG contains unsupported embedded content.');
        }

        const elements = Array.from(documentNode.querySelectorAll('*'));
        elements.forEach((element) => {
            Array.from(element.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim().toLowerCase();
                const isExternalReference = ['href', 'xlink:href', 'src'].includes(name)
                    && value
                    && !value.startsWith('#')
                    && !value.startsWith('data:image/');

                if (name.startsWith('on') || value.includes('javascript:') || isExternalReference) {
                    throw new Error('SVG contains scripts or external references.');
                }

                if (name === 'style' && /url\s*\(|@import|expression\s*\(/i.test(attribute.value)) {
                    throw new Error('SVG contains unsafe style references.');
                }
            });
        });

        return new XMLSerializer().serializeToString(documentNode.documentElement);
    }

    readAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
            reader.readAsDataURL(file);
        });
    }

    readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
            reader.readAsText(file);
        });
    }

    loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Image preview could not be created.'));
            image.src = dataUrl;
        });
    }

    readableFilename(filename = 'Image') {
        return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Image';
    }

    createId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    }
}

export default AssetManager;
