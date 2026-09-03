/**
 * Runtime patch for CanvasManager behavior used by exported/static builds.
 */
export default function applyCanvasRuntimePatch(CanvasManager) {
    if (!CanvasManager || CanvasManager.__designITRuntimePatchApplied) {
        return;
    }

    const proto = CanvasManager.prototype;
    const originalCreateComponentWrapper = proto.createComponentWrapper;
    const canvasHeadingHTML = '<h2 id="canvas-heading">Canvas</h2><p id="canvas-description" class="sr-only">Drop components from the library here to build the page.</p>';

    proto.handleDrop = function handleDrop(e) {
        e.preventDefault();
        this.canvas.classList.remove('drag-over');
        this.removeInsertionIndicator();

        const draggedElement = document.querySelector('.dragging');
        if (draggedElement && draggedElement.classList.contains('component-wrapper')) {
            if (this.historyManager) {
                this.historyManager.saveState();
            }
            this.rebuildTabs();
            return;
        }

        try {
            const data = this.getDroppedComponentData(e);
            if (!data) {
                throw new Error('No data received');
            }

            const afterElement = this.getDragAfterElement(e.clientY);
            this.addComponent(data, afterElement);
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    };

    proto.getDroppedComponentData = function getDroppedComponentData(e) {
        const transferTypes = ['application/json', 'text/plain', 'text/html'];

        for (const type of transferTypes) {
            const value = e.dataTransfer?.getData(type) || '';
            const parsed = this.parseComponentData(value);
            if (parsed) {
                return parsed;
            }
        }

        if (window.DesignITDraggedComponent) {
            return window.DesignITDraggedComponent;
        }

        const draggedLibraryElement = document.querySelector('.element.dragging');
        if (!draggedLibraryElement) {
            return null;
        }

        return {
            html: draggedLibraryElement.getAttribute('data-html') || '',
            css: draggedLibraryElement.getAttribute('data-css') || '',
            js: draggedLibraryElement.getAttribute('data-js') || '',
            reference: draggedLibraryElement.getAttribute('data-reference') || '',
            title: draggedLibraryElement.getAttribute('data-title') || draggedLibraryElement.textContent.trim(),
            type: draggedLibraryElement.getAttribute('data-type') || 'html'
        };
    };

    proto.parseComponentData = function parseComponentData(value) {
        const trimmedValue = value.trim();
        if (!trimmedValue || !trimmedValue.startsWith('{')) {
            return null;
        }

        try {
            const parsed = JSON.parse(trimmedValue);
            return parsed && parsed.html ? parsed : null;
        } catch (error) {
            return null;
        }
    };

    proto.createComponentWrapper = function createComponentWrapper(data) {
        const wrapper = originalCreateComponentWrapper.call(this, data);
        const componentId = data.id || this.generateComponentId();
        const deleteButton = wrapper.querySelector('.component-delete-btn');

        if (deleteButton) {
            deleteButton.innerHTML = '&times;';
        }

        wrapper.setAttribute('data-component-type', data.type || 'html');
        wrapper.setAttribute('data-builder-component-id', componentId);
        return wrapper;
    };

    proto.generateComponentId = function generateComponentId() {
        if (window.crypto?.randomUUID) {
            return window.crypto.randomUUID();
        }

        return `component-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    };

    proto.resetCanvas = function resetCanvas() {
        if (!this.canvas) return;
        this.canvas.innerHTML = canvasHeadingHTML;
    };

    proto.clear = function clear() {
        if (!this.canvas) return;

        if (this.historyManager) {
            this.historyManager.saveState();
        }

        this.resetCanvas();
        this.clearTabs();
    };

    proto.getCanvasContent = function getCanvasContent() {
        if (!this.canvas) return '';

        const clone = this.canvas.cloneNode(true);
        clone.querySelector('#canvas-heading')?.remove();
        clone.querySelector('#canvas-description')?.remove();
        clone.querySelectorAll('style[data-component-style="true"]').forEach((style) => style.remove());
        return clone.innerHTML;
    };

    proto.extractComponents = function extractComponents() {
        if (!this.canvas) return [];

        return Array.from(this.canvas.querySelectorAll('.component-wrapper')).map((wrapper, index) => {
            const contentContainer = wrapper.querySelector('.component-content');
            return {
                id: wrapper.getAttribute('data-builder-component-id') || `component-${index + 1}`,
                title: wrapper.getAttribute('data-component-title') || 'Component',
                type: wrapper.getAttribute('data-component-type') || 'html',
                html: contentContainer ? contentContainer.innerHTML : '',
                css: wrapper.getAttribute('data-component-css') || '',
                js: wrapper.getAttribute('data-component-js') || '',
                reference: wrapper.getAttribute('data-component-reference') || ''
            };
        });
    };

    proto.getBuilderState = function getBuilderState() {
        return {
            version: 1,
            source: 'builder',
            components: this.extractComponents()
        };
    };

    proto.generateRenderedOutput = function generateRenderedOutput() {
        const components = this.extractComponents();
        const html = components.map((component) => (
            `<div class="agentcms-builder-component" data-builder-component-id="${this.escapeAttribute(component.id)}">${component.html}</div>`
        )).join('\n');
        const css = components
            .map((component) => component.css)
            .filter((cssContent) => cssContent.trim())
            .join('\n\n');
        const js = components
            .filter((component) => component.js.trim())
            .map((component) => {
                const selector = `[data-builder-component-id="${component.id}"]`;
                return `(function() {
  const componentRoot = document.querySelector(${JSON.stringify(selector)});
  if (!componentRoot) {
    return;
  }
${component.js}
}());`;
            })
            .join('\n\n');

        return { html, css, js };
    };

    proto.getBuilderPayload = function getBuilderPayload() {
        return {
            builder_json: this.getBuilderState(),
            rendered: this.generateRenderedOutput()
        };
    };

    proto.escapeAttribute = function escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    CanvasManager.__designITRuntimePatchApplied = true;
}
