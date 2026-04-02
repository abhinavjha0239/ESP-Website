/**
 * ESP Email Template Builder — Interactive Guided Tour
 *
 * Uses driver.js to walk first-time users through the template builder features.
 * Auto-starts on first visit; can be re-triggered via "Take a Tour" button.
 *
 * Depends on: driver.js (IIFE build), espTemplateBuilder
 */
var espEmailTour = (function() {
    'use strict';

    var programUrl = '';
    var driverInstance = null;

    function init(config) {
        programUrl = config.programUrl || '';

        // Auto-start on first visit (after a short delay for page to settle)
        var tourKey = 'esp_tour_seen_' + programUrl;
        if (!localStorage.getItem(tourKey)) {
            setTimeout(function() { start(); }, 1200);
        }
    }

    function start() {
        // Avoid double-init
        if (driverInstance) {
            try { driverInstance.destroy(); } catch(e) {}
        }

        var alreadyInBuilder = espTemplateBuilder.getMode() === 'builder';

        var steps = [];

        // Step 1: Welcome — editor mode toggle
        steps.push({
            element: '#editor-mode-toggle',
            popover: {
                title: 'Two Editor Modes',
                description: '<strong>Simple Editor</strong> = basic HTML editor (like Word).<br><br>' +
                    '<strong>Template Builder</strong> = drag-and-drop with responsive email support for all devices and email clients.',
                side: 'bottom',
                align: 'start'
            }
        });

        // Step 2: Switch to builder (skip if already in builder)
        if (!alreadyInBuilder) {
            steps.push({
                element: '#btn-builder-mode',
                popover: {
                    title: 'Switch to Template Builder',
                    description: 'Click <strong>Next</strong> and we\'ll switch to the Template Builder for you.',
                    side: 'bottom',
                    align: 'start',
                    onNextClick: function() {
                        espTemplateBuilder.switchMode('builder');
                        // Wait for GrapesJS to initialize
                        setTimeout(function() {
                            driverInstance.moveNext();
                        }, 800);
                    }
                }
            });
        }

        // Step 3: Template gallery
        steps.push({
            element: '#template-selector',
            popover: {
                title: 'Template Gallery',
                description: 'Start from a pre-built template. Each one has a responsive layout, greeting with personalization, and an unsubscribe footer built in.',
                side: 'bottom',
                align: 'center'
            }
        });

        // Step 4: Category filters
        steps.push({
            element: '#template-category-tabs',
            popover: {
                title: 'Filter by Category',
                description: 'Filter templates by type: <strong>Announcement</strong>, <strong>Registration</strong>, <strong>Schedule</strong>, <strong>Reminder</strong>, <strong>Newsletter</strong>, or <strong>Custom</strong>.',
                side: 'bottom',
                align: 'start'
            }
        });

        // Step 5: Start from scratch
        steps.push({
            element: '.btn-start-blank',
            popover: {
                title: 'Start from Scratch',
                description: 'Or begin with a blank canvas. Click <strong>Next</strong> and we\'ll load one for you.',
                side: 'top',
                align: 'start',
                onNextClick: function() {
                    espTemplateBuilder.startBlank();
                    setTimeout(function() {
                        driverInstance.moveNext();
                    }, 500);
                }
            }
        });

        // Step 6: Design canvas
        steps.push({
            element: '.gjs-cv-canvas',
            popover: {
                title: 'Design Canvas',
                description: 'This is your email canvas. <strong>Click</strong> any element to edit its text. <strong>Drag</strong> new components from the right panel and drop them here.',
                side: 'left',
                align: 'center'
            }
        });

        // Step 7: Side panel (blocks/styles/layers)
        steps.push({
            element: '.gjs-pn-views-container',
            popover: {
                title: 'Side Panel',
                description: 'Three tabs at the top:<br><br>' +
                    '<strong>Blocks</strong> &mdash; drag email components (sections, text, buttons, images) into the canvas<br>' +
                    '<strong>Styles</strong> &mdash; edit colors, fonts, spacing for selected element<br>' +
                    '<strong>Layers</strong> &mdash; see and reorder the element tree<br><br>' +
                    'Blocks are organized in collapsible categories. Click a category header to expand/collapse.',
                side: 'left',
                align: 'start'
            }
        });

        // Step 8: ESP Variables
        steps.push({
            element: '.gjs-block.esp-var-block',
            popover: {
                title: 'ESP Template Variables',
                description: 'Variables are grouped by type: <strong>User Info</strong>, <strong>Program Info</strong>, <strong>Schedules</strong>, and more.<br><br>' +
                    'Drag any variable into your email &mdash; it\'ll be replaced with real data per recipient.<br>' +
                    'Example: <em>First Name</em> becomes "Alice", "Bob", etc.',
                side: 'left',
                align: 'start'
            }
        });

        // Step 9: Device preview
        steps.push({
            element: '.device-btn-group',
            popover: {
                title: 'Responsive Preview',
                description: 'See how your email looks on <strong>Desktop</strong>, <strong>Tablet</strong>, and <strong>Mobile</strong>. MJML ensures it renders correctly in Gmail, Outlook, Apple Mail, and more.',
                side: 'bottom',
                align: 'start',
                onNextClick: function() {
                    espTemplateBuilder.setDevice('Mobile');
                    setTimeout(function() {
                        espTemplateBuilder.setDevice('Desktop');
                        setTimeout(function() {
                            driverInstance.moveNext();
                        }, 400);
                    }, 600);
                }
            }
        });

        // Step 10: Toolbar — save, test, check, import/export
        steps.push({
            element: '.toolbar-right',
            popover: {
                title: 'Toolbar',
                description: '<strong>Test Email</strong> sends a preview to your inbox.<br>' +
                    '<strong>Check</strong> scans for email client issues.<br>' +
                    '<strong>Import/Export</strong> for HTML &amp; MJML files.<br>' +
                    '<strong>Save as Template</strong> stores for reuse.<br>' +
                    '<strong>History</strong> shows version changes.<br><br>' +
                    'Press <kbd>?</kbd> anytime for keyboard shortcuts.',
                side: 'bottom',
                align: 'end'
            }
        });

        // Step 11: Autosave
        steps.push({
            element: '#autosave-status',
            popover: {
                title: 'Auto-Save',
                description: 'Your draft saves locally every 30 seconds. If you close the tab and come back, you\'ll be prompted to restore it.',
                side: 'bottom',
                align: 'end'
            }
        });

        // Step 12: Preview & send
        steps.push({
            element: 'input[value="Go To Preview"]',
            popover: {
                title: 'Preview & Send',
                description: 'When you\'re done designing, click here. The builder compiles your design into a responsive HTML email.<br><br>' +
                    'You can also <strong>send a test email</strong> from the toolbar before bulk sending.',
                side: 'top',
                align: 'start'
            }
        });

        driverInstance = window.driver.js.driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            stagePadding: 8,
            stageRadius: 8,
            popoverClass: 'esp-tour-popover',
            nextBtnText: 'Next &rarr;',
            prevBtnText: '&larr; Back',
            doneBtnText: 'Done!',
            onDestroyStarted: function() {
                // Clean up: reset device to Desktop if changed during tour
                if (espTemplateBuilder.getMode() === 'builder') {
                    espTemplateBuilder.setDevice('Desktop');
                }
                // Mark tour as seen
                var tourKey = 'esp_tour_seen_' + programUrl;
                localStorage.setItem(tourKey, 'true');
                driverInstance.destroy();
            },
            steps: steps
        });

        driverInstance.drive();
    }

    return {
        init: init,
        start: start
    };
})();
