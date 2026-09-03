/**
 * CanvasManager - Handles canvas operations and component dropping
 */
class CanvasManager {
    constructor(historyManager, notificationManager) {
        this.historyManager = historyManager;
        this.notificationManager = notificationManager;
        this.canvas = null;
        this.init();
    }

    /**
     * Initialize canvas manager
     */
    init() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        this.bindEvents();
    }

    /**
     * Bind canvas events
     */
    bindEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
        this.canvas.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        this.canvas.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        
        // Add listener for reordering existing components
        this.canvas.addEventListener('dragstart', (e) => this.handleReorderDragStart(e));
        this.canvas.addEventListener('dragend', (e) => this.handleReorderDragEnd(e));
    }

    /**
     * Handle drag over event
     * @param {DragEvent} e - Drag event
     */
    handleDragOver(e) {
        e.preventDefault();
        
        // Check if we're dragging an existing component for reordering
        const draggedElement = document.querySelector('.dragging');
        if (draggedElement && draggedElement.classList.contains('component-wrapper')) {
            e.dataTransfer.dropEffect = 'move';
            
            // Find the drop target position
            const afterElement = this.getDragAfterElement(e.clientY);
            if (afterElement == null) {
                this.canvas.appendChild(draggedElement);
            } else {
                this.canvas.insertBefore(draggedElement, afterElement);
            }
        } else {
            // Dragging a new component from the elements list
            e.dataTransfer.dropEffect = 'copy';
            
            // Show insertion indicator
            this.showInsertionIndicator(e.clientY);
        }
    }

    /**
     * Show visual indicator of where component will be inserted
     * @param {number} y - Y coordinate of mouse
     */
    showInsertionIndicator(y) {
        // Remove any existing indicator
        this.removeInsertionIndicator();
        
        const afterElement = this.getDragAfterElement(y);
        const indicator = document.createElement('div');
        indicator.className = 'insertion-indicator';
        indicator.style.cssText = 'height: 3px; background-color: #667eea; margin: 5px 0; border-radius: 2px; pointer-events: none;';
        
        if (afterElement == null) {
            this.canvas.appendChild(indicator);
        } else {
            this.canvas.insertBefore(indicator, afterElement);
        }
    }

    /**
     * Remove insertion indicator
     */
    removeInsertionIndicator() {
        const indicator = this.canvas.querySelector('.insertion-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Handle drag enter event
     * @param {DragEvent} e - Drag event
     */
    handleDragEnter(e) {
        e.preventDefault();
        this.canvas.classList.add('drag-over');
    }

    /**
     * Handle drag leave event
     * @param {DragEvent} e - Drag event
     */
    handleDragLeave(e) {
        // Only remove class if we're actually leaving the canvas
        if (!this.canvas.contains(e.relatedTarget)) {
            this.canvas.classList.remove('drag-over');
            this.removeInsertionIndicator();
        }
    }

    /**
     * Handle drop event
     * @param {DragEvent} e - Drop event
     */
    handleDrop(e) {
        e.preventDefault();
        this.canvas.classList.remove('drag-over');
        this.removeInsertionIndicator();

        // Check if we're reordering an existing component
        const draggedElement = document.querySelector('.dragging');
        if (draggedElement && draggedElement.classList.contains('component-wrapper')) {
            // Save state after reordering
            if (this.historyManager) {
                this.historyManager.saveState();
            }
            // Rebuild the HTML and CSS tabs based on new order
            this.rebuildTabs();
            return;
        }

        // Otherwise, handle as new component drop
        try {
            // Read drag data in browser-compatible order (Safari often uses text/plain).
            const dataString =
                e.dataTransfer.getData('application/json') ||
                e.dataTransfer.getData('text/plain') ||
                e.dataTransfer.getData('text/html');
            if (!dataString) {
                throw new Error('No data received');
            }

            const data = JSON.parse(dataString);
            
            // Find the drop position
            const afterElement = this.getDragAfterElement(e.clientY);
            this.addComponent(data, afterElement);

        } catch (error) {
            console.error('Error handling drop:', error);
        }
    }

    /**
     * Add component to canvas
     * @param {Object} data - Component data
     * @param {HTMLElement|null} beforeElement - Element to insert before (null to append at end)
     */
    addComponent(data, beforeElement = null) {
        if (!this.canvas) return;

        // Save current state to history
        if (this.historyManager) {
            this.historyManager.saveState();
        }

        // Add HTML to canvas
        const componentWrapper = this.createComponentWrapper(data);
        
        // Insert at the appropriate position
        if (beforeElement) {
            this.canvas.insertBefore(componentWrapper, beforeElement);
        } else {
            this.canvas.appendChild(componentWrapper);
        }

        // Rebuild tabs to maintain correct order
        this.rebuildTabs();

        // Apply CSS
        this.applyComponentCSS(data.css);

        // Execute JavaScript if present
        if (data.js) {
            this.executeComponentJS(data.js, componentWrapper);
        }
    }

    /**
     * Create a wrapper for the component
     * @param {Object} data - Component data
     * @returns {HTMLElement} Component wrapper
     */
    createComponentWrapper(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'component-wrapper';
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'component-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.setAttribute('aria-label', 'Delete component');
        deleteBtn.setAttribute('title', 'Delete this component');
        deleteBtn.type = 'button';
        
        // Add click handler for delete button
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeComponent(wrapper);
        });
        
        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'component-content';
        contentContainer.innerHTML = data.html;
        
        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(contentContainer);
        
        // Make the wrapper draggable for reordering
        wrapper.draggable = true;
        
        // Add data attributes for identification
        wrapper.setAttribute('data-component-title', data.title || 'Component');
        wrapper.setAttribute('data-component-css', data.css || '');
        wrapper.setAttribute('data-component-js', data.js || '');
        wrapper.setAttribute('data-component-reference', data.reference || '');
        
        return wrapper;
    }

    /**
     * Update tab contents with new component data
     * @param {Object} data - Component data
     */
    updateTabs(data) {
        // Update HTML tab
        const htmlTab = document.getElementById('tab1');
        if (htmlTab) {
            const preElement = htmlTab.querySelector('pre');
            if (preElement) {
                // Add spacing between components if there's already content
                if (preElement.textContent.trim()) {
                    preElement.textContent += "\n\n";
                }
                preElement.textContent += data.html + "\n";
                
                // Update visibility after adding content
                this.updatePreElementVisibility(htmlTab);
            }
        }

        // Update CSS tab
        const cssTab = document.getElementById('tab2');
        if (cssTab) {
            const preElement = cssTab.querySelector('pre');
            if (preElement) {
                // Add spacing between components if there's already content
                if (preElement.textContent.trim()) {
                    preElement.textContent += "\n\n";
                }
                preElement.textContent += data.css + "\n";
                
                // Update visibility after adding content
                this.updatePreElementVisibility(cssTab);
            }
        }

        // Update JS/TS tab (if JS data exists)
        if (data.js) {
            const jsTab = document.getElementById('tab3');
            if (jsTab) {
                const preElement = jsTab.querySelector('pre');
                if (preElement) {
                    // Add spacing between components if there's already content
                    if (preElement.textContent.trim()) {
                        preElement.textContent += "\n\n";
                    }
                    preElement.textContent += data.js + "\n";
                    
                    // Update visibility after adding content
                    this.updatePreElementVisibility(jsTab);
                }
            }
        }

        // Update Reference tab (now tab4)
        const referenceTab = document.getElementById('tab4');
        if (referenceTab) {
            const divElement = referenceTab.querySelector('div');
            if (divElement) {
                // Create a labeled reference entry
                const referenceEntry = document.createElement('div');
                referenceEntry.className = 'reference-entry';
                referenceEntry.style.marginBottom = '1rem';
                referenceEntry.style.paddingBottom = '0.5rem';
                referenceEntry.style.borderBottom = '1px solid #e0e0e0';

                // Add component title as label
                const label = document.createElement('h4');
                label.textContent = data.title;
                label.style.margin = '0 0 0.5rem 0';
                label.style.fontSize = '14px';
                label.style.fontWeight = 'bold';
                label.style.color = '#333';
                referenceEntry.appendChild(label);

                // Process the reference text to make URLs clickable
                const referenceContent = this.createClickableReference(data.reference);
                referenceEntry.appendChild(referenceContent);

                divElement.appendChild(referenceEntry);
            }
        }
    }

    /**
     * Execute JavaScript code for a component
     * @param {string} jsCode - JavaScript code to execute
     * @param {HTMLElement} wrapper - Component wrapper element
     */
    executeComponentJS(jsCode, wrapper) {
        try {
            // Create a scoped function to execute the JS
            // This allows the code to access elements within the component wrapper
            const componentScope = wrapper.querySelector('.component-content');
            
            // Execute the code in a way that gives it access to the component's DOM
            const executeInContext = new Function('componentRoot', jsCode);
            executeInContext(componentScope);
        } catch (error) {
            console.error('Error executing component JavaScript:', error);
            // Don't show notification for every component error, just log it
        }
    }

    /**
     * Check if CSS content already has a comment at the beginning
     * @param {string} css - CSS content to check
     * @returns {boolean} True if CSS starts with a comment
     */
    cssHasComment(css) {
        if (!css) return false;
        const trimmedCss = css.trim();
        return trimmedCss.startsWith('/*');
    }

    /**
     * Add a visual separator between code sections
     * @param {HTMLElement} preElement - The pre element to add separator to
     * @param {string} componentTitle - Title of the component
     */
    addCodeSeparator(preElement, componentTitle) {
        // Check if this is the first element (empty content)
        const isFirstElement = !preElement.textContent.trim();
        
        // Add appropriate separator based on whether it's first or subsequent
        const separatorText = isFirstElement 
            ? `/* ===== ${componentTitle} ===== */\n\n`
            : `\n\n/* ===== ${componentTitle} ===== */\n\n`;
            
        preElement.textContent += separatorText;
    }

    /**
     * Create clickable reference content from reference text
     * @param {string} referenceText - Reference text that may contain URLs
     * @returns {HTMLElement} Element with clickable links
     */
    createClickableReference(referenceText) {
        const container = document.createElement('div');
        container.style.fontSize = '13px';
        container.style.lineHeight = '1.4';

        // URL regex pattern
        const urlPattern = /(https?:\/\/[^\s\n]+)/g;
        
        // Split text by URLs and create elements
        const parts = referenceText.split(urlPattern);
        
        parts.forEach(part => {
            if (part.match(urlPattern)) {
                // This is a URL - create a clickable link
                const link = document.createElement('a');
                link.href = part.trim();
                link.textContent = part.trim();
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.style.color = '#007acc';
                link.style.textDecoration = 'underline';
                link.style.wordBreak = 'break-all';
                container.appendChild(link);
            } else if (part.trim()) {
                // This is regular text
                const textNode = document.createElement('span');
                textNode.textContent = part;
                container.appendChild(textNode);
            }
        });

        return container;
    }

    /**
     * Apply CSS for the component
     * @param {string} css - CSS content
     */
    applyComponentCSS(css) {
        if (!css || !this.canvas) return;

        const style = document.createElement('style');
        style.innerHTML = css;
        style.setAttribute('data-component-style', 'true');
        this.canvas.appendChild(style);
    }

    /**
     * Clear the canvas
     */
    clear() {
        if (!this.canvas) return;

        // Save current state to history
        if (this.historyManager) {
            this.historyManager.saveState();
        }

        // Reset canvas content
        this.canvas.innerHTML = '<h3>Canvas</h3>';

        // Clear tabs
        this.clearTabs();
    }

    /**
     * Clear all tab contents
     */
    clearTabs() {
        const tabs = ['tab1', 'tab2', 'tab3', 'tab4'];
        tabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (tab) {
                const preElement = tab.querySelector('pre');
                const pElement = tab.querySelector('p');
                const divElement = tab.querySelector('div');
                
                if (preElement) {
                    preElement.textContent = '';
                }
                if (pElement) {
                    pElement.textContent = '';
                }
                if (divElement) {
                    divElement.innerHTML = '<p></p>'; // Reset to original structure
                }
                
                // Update visibility of pre elements
                this.updatePreElementVisibility(tab);
            }
        });
    }

    /**
     * Update visibility of pre elements based on content
     * @param {HTMLElement} tab - Tab element to check
     */
    updatePreElementVisibility(tab) {
        const preElement = tab.querySelector('pre');
        if (preElement) {
            const hasContent = preElement.textContent.trim().length > 0;
            preElement.style.display = hasContent ? '' : 'none';
        }
    }

    /**
     * Get canvas content without header
     * @returns {string} Canvas HTML content
     */
    getCanvasContent() {
        if (!this.canvas) return '';
        
        return this.canvas.innerHTML.replace('<h3>Canvas</h3>', '');
    }

    /**
     * Get all component styles
     * @returns {string} Combined CSS content
     */
    getComponentStyles() {
        if (!this.canvas) return '';

        const styles = this.canvas.querySelectorAll('style[data-component-style="true"]');
        return Array.from(styles).map(style => style.innerHTML).join('\n');
    }

    /**
     * Set canvas content
     * @param {string} content - HTML content
     */
    setCanvasContent(content) {
        if (!this.canvas) return;
        
        this.canvas.innerHTML = content;
    }

    /**
     * Handle drag start for reordering existing components
     * @param {DragEvent} e - Drag event
     */
    handleReorderDragStart(e) {
        const target = e.target.closest('.component-wrapper');
        if (!target) return;

        target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'reorder'); // Set some data for Firefox
    }

    /**
     * Handle drag end for reordering
     * @param {DragEvent} e - Drag event
     */
    handleReorderDragEnd(e) {
        const target = e.target.closest('.component-wrapper');
        if (!target) return;

        target.classList.remove('dragging');
    }

    /**
     * Get the element that the dragged item should be inserted before
     * @param {number} y - Y coordinate of mouse
     * @returns {HTMLElement|null} Element to insert before, or null if at end
     */
    getDragAfterElement(y) {
        const draggableElements = [...this.canvas.querySelectorAll('.component-wrapper:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Remove a component from the canvas
     * @param {HTMLElement} wrapper - Component wrapper to remove
     */
    removeComponent(wrapper) {
        if (!wrapper || !this.canvas) return;

        // Save current state to history before removing
        if (this.historyManager) {
            this.historyManager.saveState();
        }

        // Remove the component
        wrapper.remove();

        // Rebuild tabs to reflect the removal
        this.rebuildTabs();
    }

    /**
     * Rebuild tabs based on current canvas order
     */
    rebuildTabs() {
        // Clear current tab contents
        const htmlTab = document.getElementById('tab1');
        const cssTab = document.getElementById('tab2');
        const jsTab = document.getElementById('tab3');
        const referenceTab = document.getElementById('tab4');

        if (htmlTab) {
            const preElement = htmlTab.querySelector('pre');
            if (preElement) {
                preElement.textContent = '';
            }
        }

        if (cssTab) {
            const preElement = cssTab.querySelector('pre');
            if (preElement) {
                preElement.textContent = '';
            }
        }

        if (jsTab) {
            const preElement = jsTab.querySelector('pre');
            if (preElement) {
                preElement.textContent = '';
            }
        }

        if (referenceTab) {
            const divElement = referenceTab.querySelector('div');
            if (divElement) {
                divElement.innerHTML = '';
            }
        }

        // Get all component wrappers in current order
        const components = this.canvas.querySelectorAll('.component-wrapper');
        
        components.forEach((wrapper) => {
            // Get HTML from the content container, not the wrapper (to exclude delete button)
            const contentContainer = wrapper.querySelector('.component-content');
            const html = contentContainer ? contentContainer.innerHTML : wrapper.innerHTML;
            const css = wrapper.getAttribute('data-component-css') || '';
            const js = wrapper.getAttribute('data-component-js') || '';
            const reference = wrapper.getAttribute('data-component-reference') || '';
            const title = wrapper.getAttribute('data-component-title') || 'Component';

            // Update HTML tab
            if (htmlTab) {
                const preElement = htmlTab.querySelector('pre');
                if (preElement) {
                    if (preElement.textContent.trim()) {
                        preElement.textContent += "\n\n";
                    }
                    preElement.textContent += html + "\n";
                    this.updatePreElementVisibility(htmlTab);
                }
            }

            // Update CSS tab
            if (cssTab && css) {
                const preElement = cssTab.querySelector('pre');
                if (preElement) {
                    if (preElement.textContent.trim()) {
                        preElement.textContent += "\n\n";
                    }
                    preElement.textContent += css + "\n";
                    this.updatePreElementVisibility(cssTab);
                }
            }

            // Update JS/TS tab
            if (jsTab && js) {
                const preElement = jsTab.querySelector('pre');
                if (preElement) {
                    if (preElement.textContent.trim()) {
                        preElement.textContent += "\n\n";
                    }
                    preElement.textContent += js + "\n";
                    this.updatePreElementVisibility(jsTab);
                }
            }

            // Update Reference tab
            if (referenceTab && reference) {
                const divElement = referenceTab.querySelector('div');
                if (divElement) {
                    const referenceEntry = document.createElement('div');
                    referenceEntry.className = 'reference-entry';
                    referenceEntry.style.marginBottom = '1rem';
                    referenceEntry.style.paddingBottom = '0.5rem';
                    referenceEntry.style.borderBottom = '1px solid #e0e0e0';

                    const label = document.createElement('h4');
                    label.textContent = title;
                    label.style.margin = '0 0 0.5rem 0';
                    label.style.fontSize = '14px';
                    label.style.fontWeight = 'bold';
                    label.style.color = '#333';
                    referenceEntry.appendChild(label);

                    const referenceContent = this.createClickableReference(reference);
                    referenceEntry.appendChild(referenceContent);

                    divElement.appendChild(referenceEntry);
                }
            }
        });
    }
}

export default CanvasManager;
