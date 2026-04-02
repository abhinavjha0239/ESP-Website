/**
 * ESP Email Template Builder — GrapesJS + MJML Integration
 *
 * Provides a drag-and-drop email template builder using GrapesJS with the
 * grapesjs-mjml plugin. Manages dual-mode editing (Simple/Builder), template
 * gallery CRUD, autosave to localStorage, and form submit interception.
 *
 * Depends on: jQuery ($j), csrf_init.js (csrf_token, refresh_csrf_cookie),
 *             grapesjs, grapesjs-mjml (loaded via CDN in step2.html)
 */
var espTemplateBuilder = (function() {
    'use strict';

    var gjsEditor = null;
    var currentMode = 'simple';
    var programUrl = '';
    var currentTemplateId = null;
    var autosaveInterval = null;
    var currentCategoryFilter = '';
    var editorDirty = false;

    // ESP template variables available for GrapesJS blocks
    // Grouped by category with icons for the blocks panel
    var ESP_TEMPLATE_VARS = [
        { key: 'user.first_name', label: "First Name", category: "User Info", icon: "\uD83D\uDC64" },
        { key: 'user.last_name', label: "Last Name", category: "User Info", icon: "\uD83D\uDC64" },
        { key: 'user.name', label: "Full Name", category: "User Info", icon: "\uD83D\uDC64" },
        { key: 'user.username', label: "Username", category: "User Info", icon: "\uD83D\uDC64" },
        { key: 'user.unsubscribe_link', label: "Unsubscribe Link", category: "User Info", icon: "\uD83D\uDD17" },
        { key: 'program.date', label: "Program Date", category: "Program Info", icon: "\uD83D\uDCC5" },
        { key: 'program.date_range', label: "Date Range", category: "Program Info", icon: "\uD83D\uDCC5" },
        { key: 'program.teacher_reg_deadline', label: "Teacher Reg Deadline", category: "Program Info", icon: "\u23F0" },
        { key: 'request.public_url', label: "Public URL", category: "Program Info", icon: "\uD83C\uDF10" },
        { key: 'program.student_schedule', label: "Student Schedule", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.student_schedule_norooms', label: "Student Schedule (no rooms)", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.teacher_schedule', label: "Teacher Schedule", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.teacher_schedule_dates', label: "Teacher Schedule (dates)", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.teachermoderator_schedule', label: "Teacher/Moderator Schedule", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.teachermoderator_schedule_dates', label: "Teacher/Mod Schedule (dates)", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.moderator_schedule', label: "Moderator Schedule", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.moderator_schedule_dates', label: "Moderator Schedule (dates)", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.volunteer_schedule', label: "Volunteer Schedule", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.volunteer_schedule_dates', label: "Volunteer Schedule (dates)", category: "Schedules", icon: "\uD83D\uDCCB" },
        { key: 'program.transcript', label: "Transcript", category: "Other Data", icon: "\uD83D\uDCC4" },
        { key: 'program.receipt', label: "Receipt", category: "Other Data", icon: "\uD83E\uDDFE" },
        { key: 'program.full_classes', label: "Full Classes", category: "Other Data", icon: "\uD83D\uDCCA" },
    ];

    // Built-in starter templates (MJML)
    var STARTER_TEMPLATES = [
        {
            id: 'builtin-announcement',
            name: 'Event Announcement',
            description: 'Hero header + greeting + event details + CTA button + unsubscribe footer',
            category: 'announcement',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#2c3e50" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Event Announcement</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Hello {{ user.first_name }},</mj-text>' +
                            '<mj-text font-size="14px">We are excited to announce an upcoming event! Here are the details:</mj-text>' +
                            '<mj-text font-size="14px"><strong>Date:</strong> {{ program.date_range }}</mj-text>' +
                            '<mj-button background-color="#3498db" href="#">Learn More</mj-button>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        },
        {
            id: 'builtin-registration',
            name: 'Registration Reminder',
            description: 'Deadline callout + registration link + unsubscribe footer',
            category: 'registration',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#e74c3c" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Registration Reminder</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Hi {{ user.first_name }},</mj-text>' +
                            '<mj-text font-size="14px">This is a reminder that registration is open. Don\'t miss your chance to sign up!</mj-text>' +
                            '<mj-text font-size="14px" font-weight="bold" color="#e74c3c">Deadline: {{ program.teacher_reg_deadline }}</mj-text>' +
                            '<mj-button background-color="#e74c3c" href="#">Register Now</mj-button>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        },
        {
            id: 'builtin-schedule',
            name: 'Schedule Notification',
            description: 'Student schedule variable block + date range + unsubscribe footer',
            category: 'schedule',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#27ae60" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Your Schedule</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Hi {{ user.first_name }},</mj-text>' +
                            '<mj-text font-size="14px">Here is your schedule for the program on {{ program.date_range }}:</mj-text>' +
                            '<mj-text font-size="14px">{{ program.student_schedule }}</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        },
        {
            id: 'builtin-newsletter',
            name: 'Simple Newsletter',
            description: '2-column content layout + CTA button + unsubscribe footer',
            category: 'newsletter',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#8e44ad" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Newsletter</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column width="50%">' +
                            '<mj-text font-size="16px" font-weight="bold">Section One</mj-text>' +
                            '<mj-text font-size="14px">Write your first section content here.</mj-text>' +
                        '</mj-column>' +
                        '<mj-column width="50%">' +
                            '<mj-text font-size="16px" font-weight="bold">Section Two</mj-text>' +
                            '<mj-text font-size="14px">Write your second section content here.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="10px 20px">' +
                        '<mj-column>' +
                            '<mj-button background-color="#8e44ad" href="#">Read More</mj-button>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        },
        {
            id: 'builtin-reminder',
            name: 'Friendly Reminder',
            description: 'Urgency callout + deadline + action button + unsubscribe footer',
            category: 'reminder',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#f39c12" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Friendly Reminder</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Hi {{ user.first_name }},</mj-text>' +
                            '<mj-text font-size="14px">Just a quick reminder about an important upcoming deadline. Please make sure to take action before it passes!</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#fef9e7" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="14px" font-weight="bold" color="#e67e22" align="center">Deadline: {{ program.teacher_reg_deadline }}</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="14px">Don\'t miss out \u2014 click below to take action now:</mj-text>' +
                            '<mj-button background-color="#f39c12" color="#ffffff" href="#">Take Action Now</mj-button>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        },
        {
            id: 'builtin-welcome',
            name: 'Welcome / Onboarding',
            description: 'Welcome greeting + 3 getting-started steps + CTA + unsubscribe footer',
            category: 'custom',
            builtin: true,
            mjml: '<mjml>' +
                '<mj-body background-color="#f4f4f4">' +
                    '<mj-section background-color="#3498db" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text color="#ffffff" font-size="24px" align="center" font-weight="bold">Welcome!</mj-text>' +
                            '<mj-text color="#d6eaf8" font-size="14px" align="center">We\'re glad to have you on board.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Hi {{ user.first_name }},</mj-text>' +
                            '<mj-text font-size="14px">Welcome to the program running {{ program.date_range }}! Here\'s how to get started:</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#f8f9fa" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="14px"><strong>Step 1:</strong> Complete your profile and make sure your information is up to date.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="14px"><strong>Step 2:</strong> Browse the catalog and sign up for classes that interest you.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#f8f9fa" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-text font-size="14px"><strong>Step 3:</strong> Check your schedule closer to the event date.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ffffff" padding="15px 20px">' +
                        '<mj-column>' +
                            '<mj-button background-color="#3498db" href="{{ request.public_url }}">Get Started</mj-button>' +
                        '</mj-column>' +
                    '</mj-section>' +
                    '<mj-section background-color="#ecf0f1" padding="10px">' +
                        '<mj-column>' +
                            '<mj-text font-size="11px" color="#7f8c8d" align="center">You received this email because you have an account on our website. <a href="{{ user.unsubscribe_link }}">Unsubscribe</a>.</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        }
    ];

    /**
     * Initialize the template builder module.
     */
    function init(config) {
        programUrl = config.programUrl || '';
        setupFormSubmitHandler();

        // Restore editor mode if returning from preview
        if (config.initialEditorMode === 'builder') {
            switchMode('builder');
            if (config.initialGjsData) {
                // Wait for GrapesJS init, then load the data
                setTimeout(function() {
                    try {
                        var data = JSON.parse(config.initialGjsData);
                        if (gjsEditor) {
                            gjsEditor.loadProjectData(data);
                            document.getElementById('template-selector').style.display = 'none';
                        }
                    } catch (e) {
                        console.error('Failed to restore GrapesJS state:', e);
                    }
                }, 500);
            }
        } else {
            // Set simple mode as active by default
            document.getElementById('btn-simple-mode').classList.add('active');
        }
    }

    /**
     * Initialize GrapesJS editor (lazy — called on first switch to builder mode).
     */
    function initGrapesJS() {
        if (gjsEditor) return;

        // Resolve the plugin — UMD build sets window['grapesjs-mjml']
        // The module exports { default: fn }, so extract .default if needed
        var mjmlRaw = window['grapesjs-mjml'];
        var mjmlPlugin = null;
        if (mjmlRaw) {
            mjmlPlugin = typeof mjmlRaw === 'function' ? mjmlRaw : (mjmlRaw.default || mjmlRaw);
        }
        if (!mjmlPlugin) {
            console.error('grapesjs-mjml plugin not found on window. Template builder will work without MJML components.');
        }

        var gjsConfig = {
            container: '#gjs-editor',
            height: '600px',
            plugins: mjmlPlugin ? [mjmlPlugin] : [],
            pluginsOpts: {},
            storageManager: false,
            deviceManager: {
                devices: [
                    { name: 'Desktop', width: '' },
                    { name: 'Tablet', width: '768px', widthMedia: '992px' },
                    { name: 'Mobile', width: '375px', widthMedia: '480px' }
                ]
            },
            // Keep default panels (blocks, layers, styles) — device panel hidden via CSS
            // panels: { defaults: [] },
            assetManager: {
                upload: '/admin/ajax_qsd_image_upload/',
                uploadName: 'files[0]',
                headers: {},
                multiUpload: false,
                autoAdd: true,
                customFetch: function(url, options) {
                    if (typeof refresh_csrf_cookie === 'function') {
                        refresh_csrf_cookie();
                    }
                    options.headers = options.headers || {};
                    options.headers['X-CSRFToken'] = csrf_token();
                    return fetch(url, options).then(function(resp) {
                        return resp.json().then(function(body) {
                            // Server returns Jodit format: {success, data:{files:[urls]}}
                            // GrapesJS expects: {data:[urls]}
                            if (body.success && body.data && body.data.files) {
                                return { data: body.data.files };
                            }
                            var msg = (body.data && body.data.messages) ? body.data.messages.join(', ') : 'Upload failed';
                            throw new Error(msg);
                        });
                    });
                }
            },
            canvas: {
                styles: []
            }
        };

        if (mjmlPlugin) {
            gjsConfig.pluginsOpts[mjmlPlugin] = {};
        }

        gjsEditor = grapesjs.init(gjsConfig);

        // Open Blocks panel by default (not Style Manager)
        var blocksBtn = gjsEditor.Panels.getButton('views', 'open-blocks');
        if (blocksBtn) blocksBtn.set('active', true);

        // Add tooltips and text labels to GrapesJS panel buttons after render
        setupToolbarEnhancements(gjsEditor);

        // Add ESP template variable blocks
        addTemplateVarBlocks(gjsEditor);

        // Add unsubscribe footer block (prominent)
        gjsEditor.BlockManager.add('esp-unsubscribe-footer', {
            label: 'Unsubscribe Footer',
            category: 'ESP Essentials',
            content: '<mj-section background-color="#ecf0f1" padding="10px">' +
                '<mj-column>' +
                    '<mj-text font-size="11px" color="#7f8c8d" align="center">' +
                        'You received this email because you have an account on our website. ' +
                        'If you no longer wish to receive emails, ' +
                        '<a href="{{ user.unsubscribe_link }}">click here to unsubscribe</a>.' +
                    '</mj-text>' +
                '</mj-column>' +
            '</mj-section>',
            media: '<div style="font-size:20px;padding:5px 0;">&#128279;</div>',
            attributes: { class: 'esp-var-block' }
        });

        // Mark ESP variable blocks for CSS targeting (full-width layout)
        setTimeout(function() {
            var blocks = document.querySelectorAll('#gjs-editor .gjs-block[title*="{{"]');
            for (var i = 0; i < blocks.length; i++) {
                blocks[i].classList.add('esp-var-block');
            }
        }, 200);

        // Track editor changes for unsaved-changes warning + size indicator
        gjsEditor.on('change:changesCount', function() {
            editorDirty = true;
            updateSizeIndicator();
        });

        // Initial size update after load
        gjsEditor.on('load', function() {
            setTimeout(updateSizeIndicator, 500);
        });

        // === Auto-switch to Styles panel on element selection ===
        // Like EmailBuilder.js "Inspect" and GrapesJS demo — when you click
        // any element in the canvas, auto-open the Style Manager with the
        // relevant section expanded for that component type.
        gjsEditor.on('component:selected', function(component) {
            // Switch to Style Manager panel:
            // 1. Stop the currently active panel command
            // 2. Run open-sm command
            // 3. Sync button active states
            try { gjsEditor.stopCommand('open-blocks'); } catch(e) {}
            try { gjsEditor.stopCommand('open-layers'); } catch(e) {}
            gjsEditor.runCommand('open-sm');
            var viewsPanel = gjsEditor.Panels.getPanel('views');
            if (viewsPanel) {
                viewsPanel.get('buttons').each(function(btn) {
                    btn.set('active', btn.get('id') === 'open-sm', { silent: false });
                });
            }

            // Auto-expand the relevant style sector based on component type
            setTimeout(function() {
                var type = component.get('type') || '';
                var tagName = (component.get('tagName') || '').toLowerCase();
                var isText = type === 'text' || type === 'mj-text' || type === 'mj-button' ||
                             tagName === 'p' || tagName === 'h1' || tagName === 'h2' ||
                             tagName === 'h3' || tagName === 'span' || tagName === 'a';
                var isImage = type === 'image' || type === 'mj-image';
                var isSection = type === 'mj-section' || type === 'mj-column' ||
                                type === 'mj-body' || type === 'mj-wrapper';

                // Find all style sectors and auto-expand the most relevant one
                var sectors = document.querySelectorAll('#gjs-editor .gjs-sm-sector');
                sectors.forEach(function(sector) {
                    var title = sector.querySelector('.gjs-sm-sector-title');
                    if (!title) return;
                    var sectorName = title.textContent.trim().toLowerCase();
                    var isOpen = sector.classList.contains('gjs-sm-open');

                    var shouldOpen = false;
                    if (isText && (sectorName.indexOf('typograph') !== -1 ||
                                   sectorName.indexOf('font') !== -1)) {
                        shouldOpen = true;
                    } else if (isImage && sectorName.indexOf('dimension') !== -1) {
                        shouldOpen = true;
                    } else if (isSection && (sectorName.indexOf('general') !== -1 ||
                                             sectorName.indexOf('decoration') !== -1)) {
                        shouldOpen = true;
                    }

                    if (shouldOpen && !isOpen) {
                        title.click();
                    }
                });
            }, 150);
        });

        // When selection is cleared, switch back to Blocks panel
        gjsEditor.on('component:deselected', function() {
            try { gjsEditor.stopCommand('open-sm'); } catch(e) {}
            try { gjsEditor.stopCommand('open-layers'); } catch(e) {}
            gjsEditor.runCommand('open-blocks');
            var viewsPanel = gjsEditor.Panels.getPanel('views');
            if (viewsPanel) {
                viewsPanel.get('buttons').each(function(btn) {
                    btn.set('active', btn.get('id') === 'open-blocks', { silent: false });
                });
            }
        });

        // === Auto-name MJML sections in Layers panel ===
        // Gives friendly names ("Header Section", "Content Section 1", etc.)
        // instead of the default "Section" for every mj-section.
        function nameSections() {
            var wrapper = gjsEditor.DomComponents.getWrapper();
            if (!wrapper) return;
            // GrapesJS find() doesn't match MJML types; traverse manually
            var sections = [];
            function collectSections(comp) {
                if (comp.get('type') === 'mj-section') {
                    sections.push(comp);
                }
                comp.components().each(function(child) {
                    collectSections(child);
                });
            }
            collectSections(wrapper);
            for (var i = 0; i < sections.length; i++) {
                var name;
                if (i === 0) name = 'Header Section';
                else if (i === sections.length - 1 && sections.length > 1) name = 'Footer Section';
                else name = 'Content Section ' + i;
                sections[i].set('custom-name', name);
            }
        }
        gjsEditor.on('load', function() { setTimeout(nameSections, 300); });
        gjsEditor.on('component:add', function(comp) {
            if (comp.get('type') === 'mj-section') setTimeout(nameSections, 100);
        });
        gjsEditor.on('component:remove', function(comp) {
            if (comp.get('type') === 'mj-section') setTimeout(nameSections, 100);
        });

        // Reorder block categories: MJML building blocks first, ESP vars after
        // Also collapse ESP variable categories by default
        reorderBlockCategories();

        // Restore block category collapse states from localStorage
        restoreBlockCategoryStates();

        // Start autosave
        setupAutosave();

        // Setup keyboard shortcuts (only once)
        if (!setupKeyboardShortcuts._done) {
            setupKeyboardShortcuts();
            setupKeyboardShortcuts._done = true;
        }

        // Warn on page leave if there are unsaved changes
        if (!initGrapesJS._beforeUnloadSet) {
            window.addEventListener('beforeunload', function(e) {
                if (currentMode === 'builder' && editorDirty) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });
            initGrapesJS._beforeUnloadSet = true;
        }
    }

    /**
     * Add tooltips and text labels to GrapesJS toolbar buttons.
     */
    function setupToolbarEnhancements(editor) {
        // Custom descriptive tooltips for GrapesJS panel buttons
        var tooltipMap = {
            'Open Style Manager': 'Style Manager — edit colors, fonts, spacing',
            'Settings': 'Traits — edit element attributes',
            'Open Layer Manager': 'Layers — view element tree',
            'Open Blocks': 'Blocks — drag components into canvas',
            'View components': 'Toggle component borders',
            'Preview': 'Preview mode (hide panels)',
            'Fullscreen': 'Fullscreen editor',
            'View code': 'View / export code',
            'Import MJML': 'Import MJML code',
            'Undo': 'Undo (Ctrl+Z)',
            'Redo': 'Redo (Ctrl+Shift+Z)'
        };

        // Text labels for Views panel buttons (identified by default title)
        var textLabelMap = {
            'Open Blocks': ' Blocks',
            'Open Style Manager': ' Styles',
            'Open Layer Manager': ' Layers'
        };

        editor.on('load', function() {
            // GrapesJS renders button DOM asynchronously; wait for it
            setTimeout(function() {
                // Apply custom tooltips by matching existing title attributes
                var allBtns = document.querySelectorAll('#gjs-editor .gjs-pn-btn');
                allBtns.forEach(function(btnEl) {
                    var currentTitle = btnEl.getAttribute('title') || '';
                    if (tooltipMap[currentTitle]) {
                        btnEl.setAttribute('title', tooltipMap[currentTitle]);
                    }
                });

                // Add text labels to Views panel buttons
                var viewsBtns = document.querySelectorAll('.gjs-pn-views .gjs-pn-btn');
                viewsBtns.forEach(function(btnEl) {
                    var currentTitle = btnEl.getAttribute('title') || '';
                    // Match against original titles (before tooltip replacement)
                    var labelKeys = Object.keys(textLabelMap);
                    for (var i = 0; i < labelKeys.length; i++) {
                        var origTitle = labelKeys[i];
                        // Check both original and already-replaced title
                        if (currentTitle === origTitle || currentTitle === tooltipMap[origTitle]) {
                            var textSpan = document.createElement('span');
                            textSpan.className = 'gjs-btn-label';
                            textSpan.textContent = textLabelMap[origTitle];
                            btnEl.appendChild(textSpan);
                            break;
                        }
                    }
                });
            }, 300);
        });
    }

    /**
     * Register GrapesJS blocks for ESP template variables.
     */
    function addTemplateVarBlocks(editor) {
        ESP_TEMPLATE_VARS.forEach(function(v) {
            var blockId = 'esp-var-' + v.key.replace(/\./g, '-');
            var preview = '{{ ' + v.key + ' }}';
            var catName = v.category ? ('\u2709 ' + v.category) : '\u2709 ESP Variables';
            editor.BlockManager.add(blockId, {
                label: v.label,
                category: catName,
                content: '<mj-text>' + preview + '</mj-text>',
                media: '<div style="font-size:16px;line-height:1;">' + (v.icon || '\u2709') + '</div>',
                attributes: { title: preview + ' \u2014 drag into your email', class: 'esp-var-block' }
            });
        });
    }

    /**
     * Switch between simple (Jodit) and builder (GrapesJS) editor modes.
     */
    function switchMode(mode) {
        currentMode = mode;
        document.getElementById('editor_mode').value = mode;

        var simpleContainer = document.getElementById('simple-editor-container');
        var builderContainer = document.getElementById('builder-container');
        var templateSelector = document.getElementById('template-selector');
        var btnSimple = document.getElementById('btn-simple-mode');
        var btnBuilder = document.getElementById('btn-builder-mode');

        if (mode === 'simple') {
            simpleContainer.style.display = '';
            builderContainer.style.display = 'none';
            templateSelector.style.display = 'none';
            btnSimple.classList.add('active');
            btnBuilder.classList.remove('active');
        } else {
            simpleContainer.style.display = 'none';
            builderContainer.style.display = '';
            btnSimple.classList.remove('active');
            btnBuilder.classList.add('active');

            initGrapesJS();

            // Check for autosaved draft
            var draftKey = 'esp_email_draft_' + programUrl;
            var savedDraft = localStorage.getItem(draftKey);
            if (savedDraft && !gjsEditor.getComponents().length) {
                showDraftRestoreModal(savedDraft, draftKey, templateSelector);
            } else if (!gjsEditor.getComponents().length) {
                templateSelector.style.display = '';
                loadTemplateGallery();
            }
        }
    }

    /**
     * Load the template gallery from the server + built-in starters.
     */
    function loadTemplateGallery() {
        var url = '/manage/' + programUrl + '/email_template_list';
        if (currentCategoryFilter) {
            url += '?category=' + encodeURIComponent(currentCategoryFilter);
        }

        $j.ajax({
            url: url,
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                var gallery = document.getElementById('template-gallery');
                gallery.innerHTML = '';

                // Add built-in starters first
                var filteredStarters = STARTER_TEMPLATES.filter(function(s) {
                    return !currentCategoryFilter || s.category === currentCategoryFilter;
                });
                filteredStarters.forEach(function(s) {
                    gallery.appendChild(buildTemplateCard(s));
                });

                // Add user-saved templates
                if (resp.templates && resp.templates.length > 0) {
                    resp.templates.forEach(function(t) {
                        gallery.appendChild(buildTemplateCard(t));
                    });
                }

                if (!filteredStarters.length && (!resp.templates || !resp.templates.length)) {
                    gallery.innerHTML = '<p class="text-muted" style="padding: 10px;">No templates found for this category.</p>';
                }
            },
            error: function() {
                var gallery = document.getElementById('template-gallery');
                gallery.innerHTML = '<p class="text-muted" style="padding: 10px;">Failed to load templates.</p>';
            }
        });
    }

    // Category color map for template card headers
    var CATEGORY_COLORS = {
        announcement: '#2c3e50',
        registration: '#e74c3c',
        schedule: '#27ae60',
        reminder: '#f39c12',
        newsletter: '#8e44ad',
        custom: '#3498db'
    };

    // Category icon map
    var CATEGORY_ICONS = {
        announcement: 'glyphicon-bullhorn',
        registration: 'glyphicon-pencil',
        schedule: 'glyphicon-calendar',
        reminder: 'glyphicon-bell',
        newsletter: 'glyphicon-envelope',
        custom: 'glyphicon-cog'
    };

    /**
     * Build a template card DOM element.
     */
    function buildTemplateCard(template) {
        var card = document.createElement('div');
        card.className = 'template-card';

        var isBuiltin = !!template.builtin;
        var cat = template.category || 'custom';
        var catColor = CATEGORY_COLORS[cat] || '#3498db';
        var catIcon = CATEGORY_ICONS[cat] || 'glyphicon-file';

        var thumb = template.thumbnail
            ? '<img src="' + escapeHtml(template.thumbnail) + '" />'
            : '<span class="glyphicon ' + catIcon + ' thumb-placeholder" style="color:' + catColor + ';"></span>';

        var badgeStyle = 'background-color:' + catColor + ';';
        var badges = '<span class="label" style="' + badgeStyle + '">' + escapeHtml(cat) + '</span>';
        if (isBuiltin) {
            badges += ' <span class="label label-default">Built-in</span>';
        } else {
            badges += ' <span class="label label-info" title="Available across all programs">Shared</span>';
        }

        var loadId = escapeHtml(String(template.id));
        var actions = '<button type="button" class="btn btn-xs btn-primary" onclick="espTemplateBuilder.loadTemplate(\'' +
            loadId + '\', ' + (isBuiltin ? 'true' : 'false') + ')">Use this</button>';

        if (!isBuiltin) {
            actions += ' <button type="button" class="btn btn-xs btn-default" onclick="espTemplateBuilder.duplicateTemplate(' +
                template.id + ')">Copy</button>';
            actions += ' <button type="button" class="btn btn-xs btn-danger" onclick="espTemplateBuilder.deleteTemplate(' +
                template.id + ')">Delete</button>';
        }

        var creatorLine = '';
        if (!isBuiltin && template.creator_name) {
            creatorLine = '<div class="card-creator">by ' + escapeHtml(template.creator_name) + '</div>';
        }

        card.innerHTML =
            '<div class="template-card-header cat-' + escapeHtml(cat) + '"></div>' +
            '<div class="template-card-thumb">' + thumb + '</div>' +
            '<div class="template-card-body">' +
                '<div class="card-title">' + escapeHtml(template.name) + '</div>' +
                '<div class="card-badges">' + badges + '</div>' +
                (template.description ? '<div class="card-desc">' + escapeHtml(template.description) + '</div>' : '') +
                creatorLine +
            '</div>' +
            '<div class="template-card-footer">' + actions + '</div>';
        return card;
    }

    /**
     * Filter template gallery by category.
     */
    function filterCategory(category) {
        currentCategoryFilter = category;

        // Update active tab
        var tabs = document.getElementById('template-category-tabs').querySelectorAll('button');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('active');
            if ((category === '' && i === 0) || tabs[i].textContent.toLowerCase() === category) {
                tabs[i].classList.add('active');
            }
        }

        loadTemplateGallery();
    }

    /**
     * Load a template into the GrapesJS editor.
     */
    function loadTemplate(id, isBuiltin) {
        if (!gjsEditor) return;

        if (isBuiltin) {
            // Find the built-in template by ID
            var starter = null;
            for (var i = 0; i < STARTER_TEMPLATES.length; i++) {
                if (STARTER_TEMPLATES[i].id === id) {
                    starter = STARTER_TEMPLATES[i];
                    break;
                }
            }
            if (starter) {
                gjsEditor.setComponents(starter.mjml);
                currentTemplateId = null;
                document.getElementById('template-selector').style.display = 'none';
                scrollToEditor();
            }
            return;
        }

        // Load from server
        $j.ajax({
            url: '/manage/' + programUrl + '/email_template_load?id=' + encodeURIComponent(id),
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                if (resp.success && resp.template) {
                    try {
                        var data = JSON.parse(resp.template.gjs_data);
                        gjsEditor.loadProjectData(data);
                    } catch (e) {
                        // If gjs_data is not valid JSON, try loading as MJML
                        gjsEditor.setComponents(resp.template.gjs_data);
                    }
                    currentTemplateId = resp.template.id;
                    document.getElementById('template-selector').style.display = 'none';
                    scrollToEditor();
                }
            },
            error: function() {
                alert('Failed to load template.');
            }
        });
    }

    /**
     * Start with a blank MJML template.
     */
    function startBlank() {
        if (!gjsEditor) initGrapesJS();

        gjsEditor.setComponents(
            '<mjml>' +
                '<mj-body>' +
                    '<mj-section background-color="#ffffff">' +
                        '<mj-column>' +
                            '<mj-text font-size="16px">Start typing your email here...</mj-text>' +
                        '</mj-column>' +
                    '</mj-section>' +
                '</mj-body>' +
            '</mjml>'
        );
        currentTemplateId = null;
        document.getElementById('template-selector').style.display = 'none';
        scrollToEditor();
    }

    /**
     * Smooth-scroll to the builder editor area.
     */
    function scrollToEditor() {
        var el = document.getElementById('builder-container');
        if (el) {
            setTimeout(function() {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    /**
     * Show the template gallery.
     */
    function showGallery() {
        document.getElementById('template-selector').style.display = '';
        loadTemplateGallery();
        setTimeout(function() {
            document.getElementById('template-selector').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function hideGallery() {
        document.getElementById('template-selector').style.display = 'none';
    }

    /**
     * Save current GrapesJS design as a reusable template.
     */
    function saveTemplate() {
        if (!gjsEditor) return;

        // Reset modal fields
        document.getElementById('save-tpl-name').value = '';
        document.getElementById('save-tpl-desc').value = '';
        document.getElementById('save-tpl-category').value = 'custom';

        var modal = $j('#save-template-modal');

        $j('#save-tpl-confirm').off('click').on('click', function() {
            var name = document.getElementById('save-tpl-name').value.trim();
            if (!name) {
                document.getElementById('save-tpl-name').focus();
                return;
            }
            var category = document.getElementById('save-tpl-category').value;
            var desc = document.getElementById('save-tpl-desc').value.trim();

            var confirmBtn = $j('#save-tpl-confirm');
            confirmBtn.prop('disabled', true).text('Saving...');

            refresh_csrf_cookie();
            var gjsData = JSON.stringify(gjsEditor.getProjectData());
            var mjmlCode = gjsEditor.runCommand('mjml-code-to-html');
            var htmlContent = (mjmlCode && mjmlCode.html) ? mjmlCode.html : '';

            // Capture thumbnail then save
            captureThumbnail(function(thumbnailData) {
                var postData = {
                    name: name,
                    category: category,
                    description: desc,
                    gjs_data: gjsData,
                    html_content: htmlContent
                };
                if (thumbnailData) {
                    postData.thumbnail = thumbnailData;
                }
                if (currentTemplateId) {
                    postData.id = currentTemplateId;
                }

                $j.ajax({
                    url: '/manage/' + programUrl + '/email_template_save',
                    type: 'POST',
                    data: postData,
                    headers: { 'X-CSRFToken': csrf_token() },
                    success: function(resp) {
                        if (resp.success) {
                            currentTemplateId = resp.id;
                            editorDirty = false;
                            modal.modal('hide');
                            var status = document.getElementById('autosave-status');
                            if (status) status.textContent = 'Template saved!';
                        } else {
                            alert('Error: ' + (resp.error || 'Unknown error'));
                        }
                    },
                    error: function() {
                        alert('Failed to save. Please try again.');
                    },
                    complete: function() {
                        confirmBtn.prop('disabled', false).text('Save Template');
                    }
                });
            });
        });

        modal.modal('show');
    }

    /**
     * Duplicate a template.
     */
    function duplicateTemplate(id) {
        refresh_csrf_cookie();
        $j.ajax({
            url: '/manage/' + programUrl + '/email_template_duplicate',
            type: 'POST',
            data: { id: id },
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                if (resp.success) {
                    loadTemplateGallery();
                }
            }
        });
    }

    /**
     * Delete a template (soft delete).
     */
    function deleteTemplate(id) {
        if (!confirm('Are you sure you want to delete this template?')) return;
        refresh_csrf_cookie();
        $j.ajax({
            url: '/manage/' + programUrl + '/email_template_delete',
            type: 'POST',
            data: { id: id },
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                if (resp.success) {
                    loadTemplateGallery();
                    if (currentTemplateId === id) {
                        currentTemplateId = null;
                    }
                }
            }
        });
    }

    /**
     * Set the GrapesJS responsive preview device and update button active states.
     */
    function setDevice(device) {
        if (gjsEditor) {
            gjsEditor.setDevice(device);
        }
        // Update device button active states
        var deviceMap = { Desktop: 'device-desktop', Tablet: 'device-tablet', Mobile: 'device-mobile' };
        Object.keys(deviceMap).forEach(function(key) {
            var btn = document.getElementById(deviceMap[key]);
            if (btn) {
                if (key === device) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    /**
     * Show Bootstrap modal to restore or discard an autosaved draft.
     */
    function showDraftRestoreModal(savedDraft, draftKey, templateSelector) {
        var modal = $j('#draft-restore-modal');

        // Wire up restore button
        $j('#draft-restore-btn').off('click').on('click', function() {
            try {
                gjsEditor.loadProjectData(JSON.parse(savedDraft));
                templateSelector.style.display = 'none';
            } catch (e) {
                console.error('Failed to load draft:', e);
                templateSelector.style.display = '';
                loadTemplateGallery();
            }
            modal.modal('hide');
        });

        // Wire up discard button
        $j('#draft-discard-btn').off('click').on('click', function() {
            localStorage.removeItem(draftKey);
            templateSelector.style.display = '';
            loadTemplateGallery();
            modal.modal('hide');
        });

        // If modal is dismissed (X or backdrop click), treat as "show gallery"
        modal.off('hidden.bs.modal').on('hidden.bs.modal', function() {
            if (templateSelector.style.display === 'none' && !gjsEditor.getComponents().length) {
                templateSelector.style.display = '';
                loadTemplateGallery();
            }
        });

        modal.modal('show');
    }

    /**
     * Setup localStorage autosave for GrapesJS editor state.
     */
    function setupAutosave() {
        if (autosaveInterval) clearInterval(autosaveInterval);

        autosaveInterval = setInterval(function() {
            if (currentMode !== 'builder' || !gjsEditor) return;

            try {
                var data = JSON.stringify(gjsEditor.getProjectData());
                var draftKey = 'esp_email_draft_' + programUrl;
                localStorage.setItem(draftKey, data);

                var statusEl = document.getElementById('autosave-status');
                if (statusEl) {
                    var now = new Date();
                    statusEl.textContent = 'Draft saved ' + now.toLocaleTimeString();
                }
            } catch (e) {
                console.error('Autosave failed:', e);
            }
        }, 30000); // Every 30 seconds
    }

    /**
     * Setup form submit interception to populate body from GrapesJS.
     */
    function setupFormSubmitHandler() {
        var form = document.getElementById('comm2-form');
        if (!form) return;

        // Use a click handler on the submit button instead of the form's
        // submit event. Jodit calls stopImmediatePropagation() in its own
        // submit handler, which prevents any later submit listeners from
        // firing. The click event on the button fires BEFORE the form
        // submit event, so we can set up form data here reliably.
        var submitBtn = form.querySelector('input[name="submitform"]');
        if (!submitBtn) return;

        submitBtn.addEventListener('click', function(e) {
            if (currentMode !== 'builder' || !gjsEditor) return;

            // Compile MJML to HTML
            var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
            var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';

            if (!html) {
                e.preventDefault();
                alert('Failed to compile email template. Please check your design for errors.');
                return;
            }

            // Strip the name from the textarea so Jodit's sync on the
            // subsequent submit event is irrelevant (it writes to a
            // nameless element). Use a hidden input for the body instead.
            var bodyEl = document.getElementById('emailbody');
            bodyEl.removeAttribute('name');

            var hiddenBody = form.querySelector('input[name="body"]');
            if (!hiddenBody) {
                hiddenBody = document.createElement('input');
                hiddenBody.type = 'hidden';
                hiddenBody.name = 'body';
                form.appendChild(hiddenBody);
            }
            hiddenBody.value = html;

            // Store GrapesJS JSON for round-trip through preview
            document.getElementById('gjs_data').value = JSON.stringify(gjsEditor.getProjectData());

            // Unsubscribe link check
            if (html.indexOf('unsubscribe_link') === -1) {
                if (!confirm('Your email does not include an unsubscribe link. ' +
                    'CAN-SPAM regulations require one for bulk emails.\n\n' +
                    'Continue anyway?')) {
                    e.preventDefault();
                    return;
                }
            }

            // Clear autosaved draft and dirty flag on successful submit
            editorDirty = false;
            var draftKey = 'esp_email_draft_' + programUrl;
            localStorage.removeItem(draftKey);
        });
    }

    /**
     * Update the compiled email size indicator in the toolbar.
     */
    function updateSizeIndicator() {
        var el = document.getElementById('email-size-indicator');
        if (!el || !gjsEditor) return;
        try {
            var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
            var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
            var sizeKB = (html.length / 1024).toFixed(1);
            el.textContent = sizeKB + ' KB';
            if (html.length > 102000) {
                el.className = 'email-size-indicator size-danger';
                el.title = 'Gmail will clip this email (>102KB)';
            } else if (html.length > 80000) {
                el.className = 'email-size-indicator size-warning';
                el.title = 'Approaching Gmail 102KB clip limit';
            } else {
                el.className = 'email-size-indicator';
                el.title = 'Compiled HTML size (Gmail clips at 102KB)';
            }
        } catch (e) { /* ignore compile errors during editing */ }
    }

    /**
     * Persist block category collapse states to localStorage.
     * GrapesJS renders block categories as <div class="gjs-block-category">
     * with a header that toggles an "open" class. We observe clicks on
     * category headers and store which categories are open or closed.
     */
    // ==================== Brand Colors ====================
    var BRAND_COLORS_STORAGE_KEY = 'esp_email_brand_colors';
    var DEFAULT_BRAND_COLORS = [
        { name: 'Primary', hex: '#337ab7' },
        { name: 'Success', hex: '#27ae60' },
        { name: 'Warning', hex: '#f39c12' },
        { name: 'Danger', hex: '#e74c3c' },
        { name: 'Dark', hex: '#2c3e50' },
        { name: 'Light Gray', hex: '#ecf0f1' }
    ];

    function getBrandColors() {
        try {
            var stored = localStorage.getItem(BRAND_COLORS_STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
        return DEFAULT_BRAND_COLORS.slice();
    }

    function saveBrandColors(colors) {
        try {
            localStorage.setItem(BRAND_COLORS_STORAGE_KEY, JSON.stringify(colors));
        } catch (e) { /* ignore */ }
    }

    /**
     * Show the brand color palette management modal.
     */
    function showBrandColors() {
        renderBrandColorList();
        $j('#brand-colors-modal').modal('show');
    }

    function renderBrandColorList() {
        var colors = getBrandColors();
        var listEl = document.getElementById('brand-color-list');
        if (!listEl) return;

        var html = '';
        colors.forEach(function(c, i) {
            html += '<div class="brand-color-row" data-index="' + i + '">' +
                '<input type="color" class="brand-color-swatch" value="' + escapeHtml(c.hex) + '" ' +
                    'onchange="espTemplateBuilder._updateBrandColor(' + i + ', \'hex\', this.value)" />' +
                '<input type="text" class="brand-color-name" value="' + escapeHtml(c.name) + '" placeholder="Color name" ' +
                    'onchange="espTemplateBuilder._updateBrandColor(' + i + ', \'name\', this.value)" />' +
                '<input type="text" class="brand-color-hex" value="' + escapeHtml(c.hex) + '" ' +
                    'onchange="espTemplateBuilder._updateBrandColor(' + i + ', \'hex\', this.value)" />' +
                '<button type="button" class="btn btn-xs btn-link" style="color:#e74c3c;" ' +
                    'onclick="espTemplateBuilder._removeBrandColor(' + i + ')" title="Remove">' +
                    '<span class="glyphicon glyphicon-remove"></span></button>' +
                '</div>';
        });
        listEl.innerHTML = html;
    }

    function _updateBrandColor(index, field, value) {
        var colors = getBrandColors();
        if (index >= 0 && index < colors.length) {
            colors[index][field] = value;
            saveBrandColors(colors);
            renderBrandColorList();
        }
    }

    function _removeBrandColor(index) {
        var colors = getBrandColors();
        colors.splice(index, 1);
        saveBrandColors(colors);
        renderBrandColorList();
    }

    function _addBrandColor() {
        var colors = getBrandColors();
        colors.push({ name: 'New Color', hex: '#3498db' });
        saveBrandColors(colors);
        renderBrandColorList();
    }

    function _resetBrandColors() {
        saveBrandColors(DEFAULT_BRAND_COLORS.slice());
        renderBrandColorList();
    }

    /**
     * Copy a brand color hex to clipboard and show feedback.
     */
    function _copyBrandColor(hex) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(hex);
        }
    }

    // ==================== Block Category Persistence ====================
    var BLOCK_CAT_STORAGE_KEY = 'esp_email_block_categories';

    function saveBlockCategoryStates() {
        try {
            var categories = document.querySelectorAll('#gjs-editor .gjs-block-category');
            var states = {};
            categories.forEach(function(catEl) {
                var titleEl = catEl.querySelector('.gjs-title');
                if (!titleEl) return;
                var name = titleEl.textContent.trim();
                if (!name) return;
                // GrapesJS adds "open" class when expanded
                states[name] = catEl.classList.contains('gjs-open');
            });
            localStorage.setItem(BLOCK_CAT_STORAGE_KEY, JSON.stringify(states));
        } catch (e) { /* ignore storage errors */ }
    }

    /**
     * Reorder block panel so MJML building blocks come first,
     * ESP variable categories come after (collapsed by default).
     *
     * GrapesJS DOM structure:
     *   .gjs-blocks-cs
     *     ├── .gjs-block-categories  (ESP categories we registered)
     *     └── .gjs-blocks-no-cat     (MJML blocks — uncategorized)
     *
     * We move .gjs-blocks-no-cat BEFORE .gjs-block-categories.
     */
    /**
     * Collapse ESP variable categories by default so users see
     * MJML building blocks first. Visual reordering (MJML blocks
     * before ESP categories) is handled purely via CSS flexbox order
     * on .gjs-blocks-cs, which survives GrapesJS re-renders.
     */
    function reorderBlockCategories() {
        function collapseEspCategories() {
            var blocksCs = document.querySelector('#gjs-editor .gjs-blocks-cs');
            if (!blocksCs) return false;

            var categoriesContainer = blocksCs.querySelector('.gjs-block-categories');
            if (!categoriesContainer) return false;

            // Only collapse if user has no stored preference
            var stored = localStorage.getItem(BLOCK_CAT_STORAGE_KEY);
            var hasPrefs = false;
            try { hasPrefs = stored && Object.keys(JSON.parse(stored)).length > 0; } catch(e) {}
            if (!hasPrefs) {
                var espCats = categoriesContainer.querySelectorAll('.gjs-block-category');
                espCats.forEach(function(cat) {
                    if (cat.classList.contains('gjs-open')) {
                        var titleEl = cat.querySelector('.gjs-title');
                        if (titleEl) titleEl.click();
                    }
                });
            }
            return true;
        }

        // Poll until the block categories are rendered
        var attempts = 0;
        var checkInterval = setInterval(function() {
            attempts++;
            if (collapseEspCategories() || attempts > 50) {
                clearInterval(checkInterval);
            }
        }, 100);
    }

    function restoreBlockCategoryStates() {
        // Delay to let GrapesJS render block categories
        setTimeout(function() {
            try {
                var stored = localStorage.getItem(BLOCK_CAT_STORAGE_KEY);
                if (!stored) return;
                var states = JSON.parse(stored);

                var categories = document.querySelectorAll('#gjs-editor .gjs-block-category');
                categories.forEach(function(catEl) {
                    var titleEl = catEl.querySelector('.gjs-title');
                    if (!titleEl) return;
                    var name = titleEl.textContent.trim();
                    if (name in states) {
                        if (states[name] && !catEl.classList.contains('gjs-open')) {
                            // Should be open but is closed — click to open
                            titleEl.click();
                        } else if (!states[name] && catEl.classList.contains('gjs-open')) {
                            // Should be closed but is open — click to close
                            titleEl.click();
                        }
                    }
                });

                // Attach click listeners to persist future toggles
                categories.forEach(function(catEl) {
                    var titleEl = catEl.querySelector('.gjs-title');
                    if (titleEl && !titleEl._espCatListener) {
                        titleEl.addEventListener('click', function() {
                            // Small delay so GrapesJS toggles class first
                            setTimeout(saveBlockCategoryStates, 50);
                        });
                        titleEl._espCatListener = true;
                    }
                });
            } catch (e) { /* ignore */ }
        }, 600);
    }

    /**
     * Setup keyboard shortcuts for builder mode.
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (currentMode !== 'builder') return;

            var tag = (e.target.tagName || '').toLowerCase();
            var isInput = (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable);

            // Ctrl+S / Cmd+S — save template (works even in inputs)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveTemplate();
                return;
            }

            // Ctrl+Shift+P — live preview
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                showLivePreview();
                return;
            }

            // Don't intercept other keys when in form fields
            if (isInput) return;

            // ? — show shortcuts help
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                showShortcutsHelp();
            }
        });
    }

    /**
     * Undo the last action in GrapesJS.
     */
    function undo() {
        if (gjsEditor) gjsEditor.runCommand('core:undo');
    }

    /**
     * Redo the last undone action in GrapesJS.
     */
    function redo() {
        if (gjsEditor) gjsEditor.runCommand('core:redo');
    }

    /**
     * Show keyboard shortcuts help modal.
     */
    function showShortcutsHelp() {
        $j('#shortcuts-help-modal').modal('show');
    }

    // Default sample values for ESP template variables (used in preview)
    var SAMPLE_VAR_VALUES = {
        'user.first_name': 'Jane',
        'user.last_name': 'Doe',
        'user.name': 'Jane Doe',
        'user.username': 'janedoe',
        'user.unsubscribe_link': '#unsubscribe',
        'program.date': 'March 15, 2025',
        'program.date_range': 'March 15-16, 2025',
        'program.teacher_reg_deadline': 'February 28, 2025',
        'request.public_url': 'https://example.com/program',
        'program.student_schedule': '<em>(Student schedule will appear here)</em>',
        'program.student_schedule_norooms': '<em>(Student schedule without rooms)</em>',
        'program.teacher_schedule': '<em>(Teacher schedule will appear here)</em>',
        'program.teacher_schedule_dates': '<em>(Teacher schedule with dates)</em>',
        'program.teachermoderator_schedule': '<em>(Teacher/moderator schedule)</em>',
        'program.teachermoderator_schedule_dates': '<em>(Teacher/mod schedule with dates)</em>',
        'program.moderator_schedule': '<em>(Moderator schedule)</em>',
        'program.moderator_schedule_dates': '<em>(Moderator schedule with dates)</em>',
        'program.volunteer_schedule': '<em>(Volunteer schedule)</em>',
        'program.volunteer_schedule_dates': '<em>(Volunteer schedule with dates)</em>',
        'program.transcript': '<em>(Transcript data)</em>',
        'program.receipt': '<em>(Receipt data)</em>',
        'program.full_classes': '<em>(Full classes list)</em>'
    };

    /**
     * Replace {{ variable }} placeholders with sample values.
     */
    function substituteVariables(html) {
        return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, function(match, key) {
            // Check custom inputs first
            var inputEl = document.getElementById('var-preview-' + key.replace(/\./g, '-'));
            if (inputEl && inputEl.value.trim()) {
                return escapeHtml(inputEl.value.trim());
            }
            return SAMPLE_VAR_VALUES[key] || match;
        });
    }

    /**
     * Build the variable substitution panel HTML for the preview modal.
     */
    function buildVarSubstitutionPanel() {
        // Find which variables are actually used in the current template
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        var usedVars = [];
        var seen = {};
        var varPattern = /\{\{\s*([\w.]+)\s*\}\}/g;
        var m;
        while ((m = varPattern.exec(html)) !== null) {
            if (!seen[m[1]]) {
                usedVars.push(m[1]);
                seen[m[1]] = true;
            }
        }

        if (usedVars.length === 0) {
            return '<p class="text-muted" style="font-size:12px;margin:0;">No template variables detected.</p>';
        }

        var panelHtml = '<div class="var-sub-grid">';
        usedVars.forEach(function(varKey) {
            var label = varKey;
            // Find friendly label from ESP_TEMPLATE_VARS
            for (var i = 0; i < ESP_TEMPLATE_VARS.length; i++) {
                if (ESP_TEMPLATE_VARS[i].key === varKey) {
                    label = ESP_TEMPLATE_VARS[i].label;
                    break;
                }
            }
            var inputId = 'var-preview-' + varKey.replace(/\./g, '-');
            var defaultVal = SAMPLE_VAR_VALUES[varKey] || '';
            // Strip HTML from default for input placeholder
            var placeholder = defaultVal.replace(/<[^>]+>/g, '');
            panelHtml += '<div class="var-sub-item">' +
                '<label for="' + inputId + '" title="{{ ' + escapeHtml(varKey) + ' }}">' + escapeHtml(label) + '</label>' +
                '<input type="text" id="' + inputId + '" class="var-sub-input" placeholder="' + escapeHtml(placeholder) + '" />' +
                '</div>';
        });
        panelHtml += '</div>';
        return panelHtml;
    }

    /**
     * Refresh the preview iframe with current variable substitutions.
     */
    function refreshPreview() {
        if (!gjsEditor) return;
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        html = substituteVariables(html);
        var iframe = document.getElementById('preview-iframe');
        if (iframe) {
            iframe.srcdoc = html;
            iframe.onload = function() {
                try { iframe.contentWindow.scrollTo(0, 0); } catch(e) {}
            };
        }
    }

    /**
     * Show live compiled HTML preview in a modal with variable substitution.
     */
    function showLivePreview() {
        if (!gjsEditor) return;
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        if (!html) {
            alert('Unable to compile email. Please check your template for errors.');
            return;
        }

        // Build variable substitution panel
        var varPanel = document.getElementById('preview-var-panel');
        if (varPanel) {
            varPanel.innerHTML = buildVarSubstitutionPanel();
            // Attach change listeners to variable inputs
            var inputs = varPanel.querySelectorAll('.var-sub-input');
            inputs.forEach(function(inp) {
                inp.addEventListener('input', function() {
                    refreshPreview();
                });
            });
        }

        // Apply substitutions and show
        var substituted = substituteVariables(html);
        var iframe = document.getElementById('preview-iframe');
        iframe.srcdoc = substituted;
        iframe.onload = function() {
            try { iframe.contentWindow.scrollTo(0, 0); } catch(e) {}
        };
        iframe.style.width = '100%';
        iframe.style.maxWidth = '100%';

        // Reset device buttons
        var btns = document.querySelectorAll('#preview-modal .preview-device-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
            if (btns[i].getAttribute('data-width') === '100%') {
                btns[i].classList.add('active');
            }
        }

        $j('#preview-modal').modal('show');
    }

    /**
     * Set the preview iframe width for responsive preview.
     */
    function setPreviewWidth(width, btn) {
        var iframe = document.getElementById('preview-iframe');
        if (iframe) {
            iframe.style.width = width;
            iframe.style.maxWidth = '100%';
        }
        // Update button states
        var btns = document.querySelectorAll('#preview-modal .preview-device-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
        }
        if (btn) btn.classList.add('active');
    }

    /**
     * Download a file to the user's browser.
     */
    function downloadFile(filename, content, mimeType) {
        var blob = new Blob([content], { type: mimeType });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Export compiled HTML email.
     */
    function exportHTML() {
        if (!gjsEditor) return;
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        if (!html) {
            alert('Unable to compile email. Please check your template for errors.');
            return;
        }
        downloadFile('email-template.html', html, 'text/html');
    }

    /**
     * Export MJML source.
     */
    function exportMJML() {
        if (!gjsEditor) return;
        var mjml = gjsEditor.runCommand('mjml-code');
        if (!mjml) {
            alert('No template content to export.');
            return;
        }
        downloadFile('email-template.mjml', mjml, 'text/xml');
    }

    /**
     * Show import MJML modal.
     */
    function importMJML() {
        document.getElementById('import-mjml-textarea').value = '';
        $j('#import-mjml-modal').modal('show');
    }

    /**
     * Execute MJML import from textarea.
     */
    function doImportMJML() {
        var mjml = document.getElementById('import-mjml-textarea').value.trim();
        if (!mjml) return;

        if (!gjsEditor) initGrapesJS();
        gjsEditor.setComponents(mjml);
        document.getElementById('template-selector').style.display = 'none';
        $j('#import-mjml-modal').modal('hide');
    }

    // Email client compatibility rules
    var COMPAT_RULES = [
        {
            check: function(html) {
                var matches = html.match(/<style[\s>]/gi);
                return matches && matches.length > 1;
            },
            severity: 'warning',
            message: 'Multiple &lt;style&gt; blocks detected \u2014 Gmail may strip all but the first.',
            clients: 'Gmail'
        },
        {
            check: function(html) { return /background-image\s*:/i.test(html); },
            severity: 'warning',
            message: 'CSS background-image found \u2014 not supported in Outlook.',
            clients: 'Outlook'
        },
        {
            check: function(html) { return /<video|<audio/i.test(html); },
            severity: 'error',
            message: 'HTML5 video/audio found \u2014 not supported in any email client.',
            clients: 'All clients'
        },
        {
            check: function(html) { return /position\s*:\s*(absolute|fixed)/i.test(html); },
            severity: 'warning',
            message: 'CSS position:absolute/fixed found \u2014 not supported in most email clients.',
            clients: 'Outlook, Gmail, Yahoo'
        },
        {
            check: function(html) { return /display\s*:\s*flex/i.test(html); },
            severity: 'warning',
            message: 'CSS flexbox found \u2014 not supported in Outlook.',
            clients: 'Outlook'
        },
        {
            check: function(html) { return /display\s*:\s*grid/i.test(html); },
            severity: 'error',
            message: 'CSS Grid found \u2014 not supported in most email clients.',
            clients: 'Outlook, Gmail'
        },
        {
            check: function(html) { return /<form[\s>]/i.test(html); },
            severity: 'warning',
            message: 'HTML form element found \u2014 most email clients strip forms.',
            clients: 'Gmail, Outlook, Yahoo'
        },
        {
            check: function(html) { return /<script[\s>]/i.test(html); },
            severity: 'error',
            message: 'JavaScript found \u2014 all email clients strip scripts.',
            clients: 'All clients'
        },
        {
            check: function(html) {
                return html.indexOf('unsubscribe_link') === -1 && html.toLowerCase().indexOf('unsubscribe') === -1;
            },
            severity: 'error',
            message: 'No unsubscribe link \u2014 required by CAN-SPAM for bulk emails.',
            clients: 'Legal requirement'
        },
        {
            check: function(html) {
                // Check for <img> tags without alt or with empty alt
                var imgPattern = /<img\b[^>]*>/gi;
                var imgs = html.match(imgPattern) || [];
                for (var i = 0; i < imgs.length; i++) {
                    if (!/alt\s*=\s*"[^"]+"/i.test(imgs[i]) && !/alt\s*=\s*'[^']+'/i.test(imgs[i])) {
                        return true;
                    }
                }
                return false;
            },
            severity: 'info',
            message: 'Some images may be missing alt text \u2014 important for accessibility.',
            clients: 'Accessibility'
        },
        {
            check: function(html) { return html.length > 102000; },
            severity: 'warning',
            message: 'Email HTML exceeds 102KB \u2014 Gmail will clip the message.',
            clients: 'Gmail'
        },
        {
            check: function(html) { return /@media\s/i.test(html); },
            severity: 'info',
            message: '@media queries found \u2014 some older email clients ignore them (MJML handles this via inline styles).',
            clients: 'Older Outlook, Yahoo'
        }
    ];

    /**
     * Check compiled HTML for email client compatibility issues.
     */
    function checkCompatibility() {
        if (!gjsEditor) return;
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        if (!html) {
            alert('Unable to compile email. Please check your template for errors.');
            return;
        }

        var results = [];
        COMPAT_RULES.forEach(function(rule) {
            if (rule.check(html)) {
                results.push(rule);
            }
        });

        // Build results HTML
        var resultsEl = document.getElementById('compat-results');
        if (results.length === 0) {
            resultsEl.innerHTML =
                '<div class="alert alert-success">' +
                    '<span class="glyphicon glyphicon-ok-sign"></span> ' +
                    '<strong>All checks passed!</strong> Your email looks good for major email clients.' +
                '</div>';
        } else {
            var errors = results.filter(function(r) { return r.severity === 'error'; }).length;
            var warnings = results.filter(function(r) { return r.severity === 'warning'; }).length;
            var infos = results.filter(function(r) { return r.severity === 'info'; }).length;

            var summaryParts = [];
            if (errors) summaryParts.push(errors + ' error' + (errors > 1 ? 's' : ''));
            if (warnings) summaryParts.push(warnings + ' warning' + (warnings > 1 ? 's' : ''));
            if (infos) summaryParts.push(infos + ' info');

            var html_out = '<p><strong>' + summaryParts.join(', ') + '</strong> found:</p>';
            results.forEach(function(r) {
                var alertClass = r.severity === 'error' ? 'alert-danger' :
                    (r.severity === 'warning' ? 'alert-warning' : 'alert-info');
                var icon = r.severity === 'error' ? 'glyphicon-remove-sign' :
                    (r.severity === 'warning' ? 'glyphicon-exclamation-sign' : 'glyphicon-info-sign');
                html_out += '<div class="alert ' + alertClass + '" style="padding:8px 12px;margin-bottom:8px;">' +
                    '<span class="glyphicon ' + icon + '"></span> ' +
                    r.message +
                    '<span class="pull-right" style="font-size:11px;color:#888;">' + (r.clients || '') + '</span>' +
                    '</div>';
            });
            resultsEl.innerHTML = html_out;
        }

        // Also show HTML size info
        var sizeInfo = document.getElementById('compat-size-info');
        if (sizeInfo) {
            var sizeKB = (html.length / 1024).toFixed(1);
            sizeInfo.textContent = 'Email HTML size: ' + sizeKB + ' KB';
        }

        $j('#compat-modal').modal('show');
    }

    /**
     * Send a test email to the logged-in user.
     */
    function sendTestEmail() {
        if (!gjsEditor) return;
        var mjmlOutput = gjsEditor.runCommand('mjml-code-to-html');
        var html = (mjmlOutput && mjmlOutput.html) ? mjmlOutput.html : '';
        if (!html) {
            alert('Unable to compile email. Please check your template for errors.');
            return;
        }

        // Reset modal state
        $j('#test-email-result').html('');
        var btn = $j('#send-test-confirm');
        btn.prop('disabled', false).text('Send Test Email').removeClass('btn-success').addClass('btn-primary');

        $j('#send-test-confirm').off('click').on('click', function() {
            var sendBtn = $j(this);
            sendBtn.prop('disabled', true).text('Sending...');

            var subject = document.getElementById('subject').value || 'Test Email';
            var fromAddr = document.getElementById('from').value || '';
            var replyTo = document.getElementById('replyto').value || '';
            var customTo = (document.getElementById('test-email-to') || {}).value || '';

            refresh_csrf_cookie();
            var postData = { subject: subject, body: html, from: fromAddr, replyto: replyTo };
            if (customTo.trim()) postData.to = customTo.trim();
            $j.ajax({
                url: '/manage/' + programUrl + '/email_send_test',
                type: 'POST',
                data: postData,
                headers: { 'X-CSRFToken': csrf_token() },
                success: function(resp) {
                    if (resp.success) {
                        sendBtn.text('Sent!').removeClass('btn-primary').addClass('btn-success');
                        $j('#test-email-result').html(
                            '<div class="alert alert-success" style="margin-top:10px;">' +
                                '<span class="glyphicon glyphicon-ok-sign"></span> ' +
                                'Test email sent to <strong>' + escapeHtml(resp.sent_to) + '</strong>. Check your inbox!' +
                            '</div>'
                        );
                        setTimeout(function() {
                            $j('#test-email-modal').modal('hide');
                        }, 3000);
                    } else {
                        $j('#test-email-result').html(
                            '<div class="alert alert-danger" style="margin-top:10px;">Error: ' +
                                escapeHtml(resp.error || 'Unknown error') +
                            '</div>'
                        );
                        sendBtn.prop('disabled', false).text('Send Test Email');
                    }
                },
                error: function() {
                    $j('#test-email-result').html(
                        '<div class="alert alert-danger" style="margin-top:10px;">Request failed. Please try again.</div>'
                    );
                    sendBtn.prop('disabled', false).text('Send Test Email');
                }
            });
        });

        $j('#test-email-modal').modal('show');
    }

    /**
     * Show version history for the currently loaded template.
     */
    function showVersionHistory() {
        if (!currentTemplateId) {
            alert('No saved template is loaded. Save a template first to track versions.');
            return;
        }

        var listEl = document.getElementById('version-history-list');
        listEl.innerHTML = '<p class="text-muted">Loading...</p>';
        $j('#version-history-modal').modal('show');

        $j.ajax({
            url: '/manage/' + programUrl + '/email_template_versions?id=' + encodeURIComponent(currentTemplateId),
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                if (resp.success && resp.versions.length > 0) {
                    var html = '<table class="table table-condensed table-striped" style="margin-bottom:0;">';
                    html += '<thead><tr><th>Date</th><th>User</th><th></th></tr></thead><tbody>';
                    resp.versions.forEach(function(v, i) {
                        html += '<tr>';
                        html += '<td>' + escapeHtml(v.date) + '</td>';
                        html += '<td>' + escapeHtml(v.user) + '</td>';
                        html += '<td>';
                        if (i === 0) {
                            html += '<span class="label label-success">Current</span>';
                        } else {
                            html += '<button type="button" class="btn btn-xs btn-default" onclick="espTemplateBuilder.restoreVersion(' + v.id + ')">Restore</button>';
                        }
                        html += '</td>';
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                    listEl.innerHTML = html;
                } else if (resp.success) {
                    listEl.innerHTML = '<p class="text-muted">No version history yet. Save the template to start tracking changes.</p>';
                } else {
                    listEl.innerHTML = '<p class="text-danger">Error: ' + escapeHtml(resp.error || 'Unknown') + '</p>';
                }
            },
            error: function() {
                listEl.innerHTML = '<p class="text-danger">Failed to load version history.</p>';
            }
        });
    }

    /**
     * Restore a template to a specific version.
     */
    function restoreVersion(versionId) {
        if (!confirm('Restore this version? Your current unsaved changes will be lost.')) return;

        refresh_csrf_cookie();
        $j.ajax({
            url: '/manage/' + programUrl + '/email_template_restore_version',
            type: 'POST',
            data: { version_id: versionId },
            headers: { 'X-CSRFToken': csrf_token() },
            success: function(resp) {
                if (resp.success && resp.gjs_data && gjsEditor) {
                    try {
                        gjsEditor.loadProjectData(JSON.parse(resp.gjs_data));
                        $j('#version-history-modal').modal('hide');
                        var status = document.getElementById('autosave-status');
                        if (status) status.textContent = 'Restored version from ' + resp.date;
                    } catch (e) {
                        alert('Failed to load version data.');
                    }
                } else {
                    alert('Error: ' + (resp.error || 'Could not restore version'));
                }
            },
            error: function() {
                alert('Failed to restore version. Please try again.');
            }
        });
    }

    /**
     * Capture a thumbnail of the current GrapesJS canvas.
     */
    function captureThumbnail(callback) {
        if (!window.html2canvas || !gjsEditor) {
            callback('');
            return;
        }
        try {
            var canvasFrame = gjsEditor.Canvas.getFrameEl();
            if (!canvasFrame || !canvasFrame.contentDocument) {
                callback('');
                return;
            }
            var iframeBody = canvasFrame.contentDocument.body;
            html2canvas(iframeBody, {
                scale: 0.3,
                width: 600,
                height: 400,
                useCORS: true,
                logging: false,
                allowTaint: true
            }).then(function(canvas) {
                callback(canvas.toDataURL('image/jpeg', 0.6));
            }).catch(function() {
                callback('');
            });
        } catch (e) {
            callback('');
        }
    }

    // Utility: escape HTML for safe insertion
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Public API
    return {
        init: init,
        switchMode: switchMode,
        loadTemplate: loadTemplate,
        startBlank: startBlank,
        showGallery: showGallery,
        hideGallery: hideGallery,
        saveTemplate: saveTemplate,
        duplicateTemplate: duplicateTemplate,
        deleteTemplate: deleteTemplate,
        filterCategory: filterCategory,
        setDevice: setDevice,
        getMode: function() { return currentMode; },
        getGjsEditor: function() { return gjsEditor; },
        showLivePreview: showLivePreview,
        setPreviewWidth: setPreviewWidth,
        exportHTML: exportHTML,
        exportMJML: exportMJML,
        importMJML: importMJML,
        doImportMJML: doImportMJML,
        checkCompatibility: checkCompatibility,
        sendTestEmail: sendTestEmail,
        showShortcutsHelp: showShortcutsHelp,
        showVersionHistory: showVersionHistory,
        restoreVersion: restoreVersion,
        undo: undo,
        redo: redo,
        showBrandColors: showBrandColors,
        _updateBrandColor: _updateBrandColor,
        _removeBrandColor: _removeBrandColor,
        _addBrandColor: _addBrandColor,
        _resetBrandColors: _resetBrandColors,
        _copyBrandColor: _copyBrandColor
    };
})();
