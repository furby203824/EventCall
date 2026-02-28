/**
 * EventCall Event Management - Enhanced with Sync Integration
 * Handles event creation, editing, management, and RSVP sync functionality
 */

class EventManager {
    constructor() {
        this.currentEvent = null;
        this.editMode = false;
        // RSVP pagination state
        this.rsvpPagination = {
            pageSize: 25,
            shownByEvent: {} // eventId -> number of RSVPs shown
        };
        // IntersectionObserver for infinite scroll
        this._loadMoreObserver = null;
        this._setupInfiniteScroll();
    }

    /**
     * Setup IntersectionObserver for infinite scroll
     * Automatically loads more RSVPs when user scrolls near the load more button
     */
    _setupInfiniteScroll() {
        if (typeof IntersectionObserver === 'undefined') return;

        this._loadMoreObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const eventId = entry.target.dataset.eventId;
                        if (eventId) {
                            // Small delay to prevent rapid-fire loading
                            setTimeout(() => this.loadMoreRsvps(eventId), 100);
                        }
                    }
                });
            },
            {
                root: null, // viewport
                rootMargin: '200px', // trigger 200px before visible
                threshold: 0
            }
        );
    }

    /**
     * Observe a "Load More" button for infinite scroll
     * @param {string} eventId - Event ID
     */
    observeLoadMore(eventId) {
        if (!this._loadMoreObserver) return;
        const container = document.getElementById(`rsvp-load-more-${eventId}`);
        if (container) {
            container.dataset.eventId = eventId;
            this._loadMoreObserver.observe(container);
        }
    }

    /**
     * Stop observing a "Load More" button
     * @param {string} eventId - Event ID
     */
    unobserveLoadMore(eventId) {
        if (!this._loadMoreObserver) return;
        const container = document.getElementById(`rsvp-load-more-${eventId}`);
        if (container) {
            this._loadMoreObserver.unobserve(container);
        }
    }

    /**
     * Reset RSVP pagination for an event
     * @param {string} eventId - Event ID
     */
    resetRsvpPagination(eventId) {
        this.rsvpPagination.shownByEvent[eventId] = this.rsvpPagination.pageSize;
    }

    /**
     * Load more RSVPs for an event
     * @param {string} eventId - Event ID
     */
    loadMoreRsvps(eventId) {
        const current = this.rsvpPagination.shownByEvent[eventId] || this.rsvpPagination.pageSize;

        // Prevent loading if already at max
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        if (current >= eventResponses.length) {
            this.unobserveLoadMore(eventId);
            return;
        }

        this.rsvpPagination.shownByEvent[eventId] = current + this.rsvpPagination.pageSize;

        // Re-render the response table
        const event = window.events ? window.events[eventId] : null;

        if (event && eventResponses.length > 0) {
            const stats = calculateEventStats(eventResponses);
            const tableBody = document.getElementById(`response-table-body-${eventId}`);
            const loadMoreContainer = document.getElementById(`rsvp-load-more-${eventId}`);

            if (tableBody) {
                // Render additional rows
                const shown = this.rsvpPagination.shownByEvent[eventId];
                const newRows = this.generateResponseRows(event, eventResponses, stats, current, shown);
                tableBody.insertAdjacentHTML('beforeend', newRows);

                // Update or remove load more button
                if (loadMoreContainer) {
                    if (shown >= eventResponses.length) {
                        // Stop observing and remove button
                        this.unobserveLoadMore(eventId);
                        loadMoreContainer.remove();
                    } else {
                        const remaining = eventResponses.length - shown;
                        const btn = loadMoreContainer.querySelector('button');
                        if (btn) {
                            btn.textContent = `Load More RSVPs (${remaining} remaining)`;
                        }
                    }
                }

                // Update stats display
                const statsEl = document.getElementById(`search-stats-${eventId}`);
                if (statsEl) {
                    statsEl.textContent = `Showing ${Math.min(shown, eventResponses.length)} of ${eventResponses.length} responses`;
                }
            }
        }
    }
    
    /**
     * Get invite roster for an event from localStorage
     * @param {string} eventId - Event ID
     * @returns {Array} Roster of invited people
     */
    getInviteRoster(eventId) {
        const key = `eventcall_invite_roster_${eventId}`;
        try {
            const storageSync = window.utils && window.utils.secureStorageSync;
            if (storageSync) {
                const roster = storageSync.get(key);
                return Array.isArray(roster) ? roster : [];
            } else {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : [];
            }
        } catch (e) {
            console.warn('Failed to load roster:', e);
            return [];
        }
    }

    /**
     * Show event management page with sync functionality
     * @param {string} eventId - Event ID
     */
    async showEventManagement(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        this.currentEvent = event;
        const stats = calculateEventStats(eventResponses);

        let responseTableHTML = '';
        if (eventResponses.length > 0) {
            responseTableHTML = this.generateResponseTable(event, eventResponses, stats);
        } else {
            responseTableHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-color);">
                    <h3 style="color: var(--semper-navy);">No RSVPs Yet</h3>
                    <p>No RSVPs yet. Share your invite link to start collecting responses!</p>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-success" onclick="syncWithGitHub()" style="margin-right: 0.5rem;">
                            Check for New RSVPs
                        </button>
                        <button class="btn" onclick="copyInviteLink('${eventId}')">
                            Share Invite Link
                        </button>
                    </div>
                </div>
            `;
        }

        const detailsContainer = document.getElementById('event-details');
        detailsContainer.innerHTML = window.utils.sanitizeHTML(this.generateEventDetailsHTML(event, eventId, responseTableHTML));
        // Ensure Back button works even if DOMPurify strips inline handlers
        const backBtn = detailsContainer.querySelector('.btn-back');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // In list/detail layout: switch detail panel back to welcome view
                const managePage = document.getElementById('manage');
                const dashboardPage = document.getElementById('dashboard');
                if (managePage) managePage.classList.remove('active');
                if (dashboardPage) dashboardPage.classList.add('active');
                // Clear card selection
                document.querySelectorAll('.event-card-v2').forEach(c => c.classList.remove('event-card--selected'));
            }, { once: true });
        }

        // Wire More menu (all actions consolidated here)
        const qaMore = document.getElementById('qa-more');
        const qaMoreMenu = document.getElementById('qa-more-menu');
        if (qaMore && qaMoreMenu) {
            qaMore.addEventListener('click', () => {
                const expanded = qaMore.getAttribute('aria-expanded') === 'true';
                qaMore.setAttribute('aria-expanded', String(!expanded));
                qaMoreMenu.hidden = expanded;
            });
            qaMoreMenu.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const act = btn.dataset.action;
                    if (act === 'edit-event') this.editEvent(eventId);
                    if (act === 'send-reminder') this.showReminderOptionsModal(event, eventResponses);
                    if (act === 'copy-link') this.copyInviteLink(eventId);
                    if (act === 'sync-rsvps') syncWithGitHub();
                    if (act === 'export-list') {
                        if (window.exportEventData) { window.exportEventData(eventId); }
                        else if (window.calendarExport && window.calendarExport.exportEvent) { window.calendarExport.exportEvent(eventId); }
                        else showToast('Export not available', 'warning');
                    }
                    if (act === 'delete-event') deleteEvent(eventId);
                    qaMoreMenu.hidden = true;
                    qaMore.setAttribute('aria-expanded', 'false');
                });
            });
            document.addEventListener('click', (e) => {
                if (!qaMoreMenu.contains(e.target) && e.target !== qaMore) {
                    qaMoreMenu.hidden = true;
                    qaMore.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Wire Add Guest button (in People tab toolbar)
        const qaAddGuest = document.getElementById('qa-add-guest');
        if (qaAddGuest) qaAddGuest.addEventListener('click', () => this.promptAddGuest(eventId));

        // Setup flat tabs (At a Glance / People / Seating)
        this.setupManageTabs();

        // Populate recent activity timeline
        this.populateTimeline(event, eventResponses);

        // Setup event delegation for remove buttons in seating chart
        this.setupSeatingChartEventDelegation();

        // Initialize filter controls for People tab
        this.initFilterControls();

        // Render charts (async, non-blocking)
        this._renderChartSafe(() => this.renderAttendanceChart(stats), 'attendance chart');
        this._renderChartSafe(() => this.renderResponsesChart(eventResponses), 'responses chart');
        const rangeSel = document.getElementById('time-range');
        if (rangeSel) rangeSel.addEventListener('change', () => {
            this._renderChartSafe(() => this.renderResponsesChart(eventResponses), 'responses chart');
        });

        // Initialize photo upload for manage page
        if (window.setupPhotoUpload) {
            window.setupPhotoUpload();
        }

        // Setup infinite scroll for RSVP list
        if (eventResponses.length > this.rsvpPagination.pageSize) {
            requestAnimationFrame(() => this.observeLoadMore(eventId));
        }
    }

    /**
     * Generate event details HTML with enhanced sync controls
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @param {string} responseTableHTML - Response table HTML
     * @returns {string} HTML content
     */
    /**
 * Generate Mission Control event details HTML - V2 Improved Design
 * Paste this function into event-manager.js to replace the existing generateEventDetailsHTML
 */

generateEventDetailsHTML(event, eventId, responseTableHTML) {
    const inviteURL = generateInviteURL(event);
    const timeUntil = getTimeUntilEvent(event.date, event.time);
    const isPast = isEventInPast(event.date, event.time);
    const eventResponses = window.responses ? window.responses[eventId] || [] : [];
    const stats = calculateEventStats(eventResponses);
    
    // Get invite roster data
    const roster = this.getInviteRoster(eventId);
    const rosterEmails = new Set((roster || []).map(i => i.email?.toLowerCase().trim()).filter(Boolean));
    const respondedEmails = new Set(eventResponses.filter(r => r.email).map(r => r.email.toLowerCase().trim()));
    const invitedTotal = roster.length;
    const respondedFromRoster = [...respondedEmails].filter(e => rosterEmails.has(e)).length;
    const pendingFromRoster = Math.max(invitedTotal - respondedFromRoster, 0);
    const unlistedResponses = [...respondedEmails].filter(e => !rosterEmails.has(e)).length;
    
    // XSS Protection helper
    const h = window.utils.escapeHTML;
    
    // Calculate response rate
    const responseRate = eventResponses.length > 0 
        ? Math.round(((stats.attending + stats.notAttending) / eventResponses.length) * 100)
        : 0;
    
    // Calculate pending (people who viewed but haven't responded)
    const pending = eventResponses.length - (stats.attending + stats.notAttending);
    
    // Get last RSVP time
    const lastRSVP = eventResponses.length > 0 
        ? new Date(Math.max(...eventResponses.map(r => r.timestamp || 0)))
        : null;
    const lastRSVPText = lastRSVP 
        ? formatRelativeTime(lastRSVP.getTime())
        : 'No RSVPs yet';

    return `
        <div class="mission-control-container">
            <!-- Compact Header -->
            <div class="mission-control-header">
                <div class="mission-control-title">
                    <h1>${h(event.title)}</h1>
                    <div class="mission-control-subtitle">
                        ${isPast ? 'Past Event' : 'Active Event'} · ${formatDate(event.date)} · ${formatTime(event.time)} · ${h(event.location) || 'No location'}
                    </div>
                </div>
                <div class="mission-control-actions">
                    <button class="btn-back" onclick="goToDashboard()">
                        ← Back
                    </button>
                    <div class="btn-group more-group">
                        <button class="btn-more" id="qa-more" aria-haspopup="true" aria-expanded="false">&#x22EF; More</button>
                        <div class="dropdown" id="qa-more-menu" hidden>
                            <button class="btn-tertiary" data-action="edit-event">Edit Event</button>
                            <button class="btn-tertiary" data-action="send-reminder">Send Reminder</button>
                            <button class="btn-tertiary" data-action="copy-link">Copy Invite Link</button>
                            <button class="btn-tertiary" data-action="sync-rsvps">Sync RSVPs</button>
                            <button class="btn-tertiary" data-action="export-list">Export List</button>
                            <div class="dropdown-divider"></div>
                            <button class="btn-tertiary danger" data-action="delete-event">Delete Event</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Flat Tabs: At a Glance / People / Seating -->
            <div class="manage-tabs" role="tablist" aria-label="Manage tabs">
                <button class="tab-btn active" role="tab" aria-selected="true" aria-controls="tab-glance" id="tab-glance-btn">At a Glance</button>
                <button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-people" id="tab-people-btn">People</button>
                ${event.seatingChart && event.seatingChart.enabled ? `<button class="tab-btn" role="tab" aria-selected="false" aria-controls="tab-seating" id="tab-seating-btn">Seating</button>` : ''}
            </div>

            <!-- ============ AT A GLANCE TAB ============ -->
            <div class="tab-panel tab-panel--glance" id="tab-glance">
                <!-- Stat Cards -->
                <div class="rsvp-stats-cards">
                    <div class="stat-card-large stat-card-headcount">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.totalHeadcount}</div>
                        <div class="stat-card-label">Total Headcount</div>
                        ${event.allowGuests ? `
                            <div class="stat-card-detail">${stats.attending} attendees + ${stats.attendingWithGuests} guests</div>
                        ` : ''}
                    </div>
                    <div class="stat-card-large stat-card-attending">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.attending}</div>
                        <div class="stat-card-label">Attending</div>
                    </div>
                    <div class="stat-card-large stat-card-declined">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.notAttending}</div>
                        <div class="stat-card-label">Declined</div>
                    </div>
                    <div class="stat-card-large stat-card-pending">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${pending}</div>
                        <div class="stat-card-label">Pending</div>
                    </div>
                </div>

                <!-- Response Rate Progress -->
                <div class="response-rate-section">
                    <div class="response-rate-header">
                        <span class="response-rate-label">Response Rate</span>
                        <span class="response-rate-value">${responseRate}%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${responseRate}%">
                            ${responseRate > 10 ? `<span class="progress-bar-text">${responseRate}%</span>` : ''}
                        </div>
                    </div>
                    <div class="last-rsvp-info">
                        Last RSVP: ${lastRSVPText}
                    </div>
                </div>

                <!-- Charts -->
                <div class="charts-grid">
                    <div class="chart-card">
                        <h3>Attendance Breakdown</h3>
                        <canvas id="attendanceChart" aria-label="Attendance breakdown chart"></canvas>
                    </div>
                    <div class="chart-card">
                        <div class="time-filter">
                            <label for="time-range">Time range</label>
                            <select id="time-range" class="filter-select">
                                <option value="7">7 days</option>
                                <option value="14">14 days</option>
                                <option value="30" selected>30 days</option>
                                <option value="90">90 days</option>
                            </select>
                        </div>
                        <h3>Responses Over Time</h3>
                        <canvas id="responsesOverTimeChart" aria-label="Responses over time chart"></canvas>
                    </div>
                </div>

                <!-- Recent Activity (inline, compact) -->
                <div class="recent-activity-section">
                    <h3 class="recent-activity-title">Recent Activity</h3>
                    <div id="timeline-list" class="timeline-list"></div>
                </div>

                <!-- Event Info (collapsible details) -->
                <details class="event-info-details">
                    <summary class="event-info-summary">Event Details</summary>
                    <div class="event-info-body">
                        <div class="event-meta-grid">
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Date</div>
                                    <div class="meta-value">${formatDate(event.date)}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Time</div>
                                    <div class="meta-value">${formatTime(event.time)}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Location</div>
                                    <div class="meta-value">${h(event.location) || 'Not specified'}</div>
                                </div>
                            </div>
                            <div class="meta-item-v2">
                                <span class="meta-icon-v2">${isPast ? '' : ''}</span>
                                <div class="meta-content">
                                    <div class="meta-label">${isPast ? 'Status' : 'Time Until'}</div>
                                    <div class="meta-value">${isPast ? 'Event Passed' : h(timeUntil)}</div>
                                </div>
                            </div>
                        </div>
                        ${event.description ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1; margin-top: 1rem;">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Description</div>
                                    <div class="meta-value">${h(event.description)}</div>
                                </div>
                            </div>
                        ` : ''}
                        ${(event.askReason || event.allowGuests || event.requiresMealChoice) ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1; margin-top: 1rem;">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">RSVP Settings</div>
                                    <div class="meta-value">
                                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                                            ${event.askReason ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;">${icon('message-sq')} Ask why attending</span>` : ''}
                                            ${event.allowGuests ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#f0fdf4;color:#064e3b;border:1px solid #86efac;">${icon('users')} Allow additional guests</span>` : ''}
                                            ${event.requiresMealChoice ? `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.25rem .5rem;border-radius:999px;background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;">${icon('utensils')} Meal/dietary choices required</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        ${(() => {
                            if (!event.customQuestions || event.customQuestions.length === 0) return '';
                            const typeLabels = { 'text': 'Text', 'choice': 'Multiple Choice', 'date': 'Date', 'datetime': 'Date & Time' };
                            const questionsHtml = event.customQuestions.map((q, index) => {
                                const typeLabel = typeLabels[q.type] || 'Text';
                                const requiredLabel = q.required ? '<span class="question-required-label">*Required</span>' : '<span class="question-optional-label">Optional</span>';
                                return `
                                    <div class="custom-question-item">
                                        <div class="custom-question-header">
                                            <div class="custom-question-title">Q${index + 1}: ${h(q.question)}</div>
                                            <div class="custom-question-required">${requiredLabel}</div>
                                        </div>
                                        <div class="custom-question-meta">
                                            <span>${typeLabel}</span>
                                            ${q.type === 'choice' && q.options && q.options.length > 0 ? `
                                                <span class="custom-question-options">&bull; Options: ${q.options.map(opt => h(opt)).join(', ')}</span>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('');
                            return `
                            <div class="meta-item-v2 meta-item-full-width" style="margin-top: 1rem;">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Custom RSVP Questions</div>
                                    <div class="meta-value">
                                        <div class="custom-questions-list">${questionsHtml}</div>
                                    </div>
                                </div>
                            </div>`;
                        })()}
                        ${event.eventDetails && Object.keys(event.eventDetails).length ? `
                            <div class="meta-item-v2" style="grid-column: 1 / -1; margin-top: 1rem;">
                                <span class="meta-icon-v2"></span>
                                <div class="meta-content">
                                    <div class="meta-label">Event Details</div>
                                    <div class="meta-value">${createEventDetailsHTML(event.eventDetails)}</div>
                                </div>
                            </div>
                        ` : ''}
                        <!-- Cover Image Upload -->
                        <div class="form-group" style="margin-top: 1rem;">
                            <label for="manage-cover-input" style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #5C4E4E;">Cover Image</label>
                            <div class="image-upload" id="manage-cover-upload" role="button" tabindex="0" aria-label="Change cover image">
                                <p>${event.coverImage ? 'Click or drag to change image' : 'Click or drag to upload cover image'}</p>
                                <input type="file" id="manage-cover-input" accept="image/*" class="file-input">
                            </div>
                            <img id="manage-cover-preview" class="image-preview ${event.coverImage ? '' : 'hidden'}" src="${h(event.coverImage || '')}" alt="Event cover image">
                            <input type="hidden" id="manage-cover-image-url" value="${h(event.coverImage || '')}">
                        </div>
                    </div>
                </details>
            </div>

            <!-- ============ PEOPLE TAB ============ -->
            <div class="tab-panel tab-panel--people hidden" id="tab-people">
                <div class="attendee-list-section">
                    <!-- Invite Roster -->
                    <div class="invite-roster-section" hidden>
                        <h3 class="invite-link-title">Invite Roster</h3>
                        <div class="invite-link-actions" style="margin-bottom: 0.75rem;">
                            <input type="file"
                                   id="roster-import-file-${eventId}"
                                   accept=".csv"
                                   style="display:none"
                                   onchange="window.csvImporter.handleRosterUpload(event, '${eventId}')">
                            <button class="btn-action" onclick="document.getElementById('roster-import-file-${eventId}').click()">
                                Upload Roster CSV
                            </button>
                            <a href="#" onclick="window.csvImporter.downloadTemplate(); return false;" style="margin-left: 0.75rem; color: #60a5fa;">
                                Download CSV Template
                            </a>
                        </div>
                        <div id="roster-import-preview"></div>
                    </div>

                    <!-- People toolbar: search + filter + add guest -->
                    <div class="attendee-list-header">
                        <div class="attendee-controls">
                            <input
                                type="text"
                                class="search-input"
                                placeholder="Search attendees..."
                                id="attendee-search"
                                data-filter-action="search-attendees"
                            >
                            <select class="filter-select" id="attendee-filter" data-filter-action="filter-attendees">
                                <option value="all">All People</option>
                                <option value="attending">Attending Only</option>
                                <option value="declined">Declined Only</option>
                                <option value="invited">Invited Only</option>
                            </select>
                            <button class="btn-add-guest" id="qa-add-guest">+ Add Guest</button>
                        </div>
                        <div class="attendee-count" id="attendee-count-display">
                            ${eventResponses.length + roster.filter(r => r.email && !respondedEmails.has(r.email.toLowerCase().trim())).length} people
                        </div>
                    </div>

                    ${this.generateAttendeeCards(eventResponses, eventId)}
                </div>
            </div>

            <!-- ============ SEATING TAB ============ -->
            ${event.seatingChart && event.seatingChart.enabled ? `
            <div class="tab-panel tab-panel--seating hidden" id="tab-seating">
                ${this.generateSeatingChartSection(event, eventId, eventResponses)}
            </div>
            ` : ''}
        </div>
    `;
}

    // ----- Concept B: Flat Tab Helpers -----
    setupManageTabs() {
        const btnGlance = document.getElementById('tab-glance-btn');
        const btnPeople = document.getElementById('tab-people-btn');
        const btnSeating = document.getElementById('tab-seating-btn');

        const panels = {
            glance: document.getElementById('tab-glance'),
            people: document.getElementById('tab-people'),
            seating: document.getElementById('tab-seating')
        };

        const allBtns = [btnGlance, btnPeople, btnSeating].filter(Boolean);

        const activate = (activeBtn, panelKey) => {
            allBtns.forEach(btn => {
                const isActive = btn === activeBtn;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', String(isActive));
            });
            Object.entries(panels).forEach(([key, panel]) => {
                if (!panel) return;
                if (key === panelKey) {
                    panel.classList.remove('hidden');
                    panel.removeAttribute('hidden');
                    panel.style.display = '';
                } else {
                    panel.classList.add('hidden');
                    panel.setAttribute('hidden', '');
                    panel.style.display = 'none';
                }
            });
        };

        if (btnGlance) btnGlance.addEventListener('click', () => activate(btnGlance, 'glance'));
        if (btnPeople) btnPeople.addEventListener('click', () => activate(btnPeople, 'people'));
        if (btnSeating) btnSeating.addEventListener('click', () => activate(btnSeating, 'seating'));

        // Keyboard navigation
        const tabs = Array.from(document.querySelectorAll('.manage-tabs .tab-btn'));
        tabs.forEach((btn, idx) => {
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); (tabs[(idx + 1) % tabs.length]).focus(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); (tabs[(idx - 1 + tabs.length) % tabs.length]).focus(); }
            });
        });

        // Default to At a Glance
        activate(btnGlance, 'glance');
    }

    /**
     * @deprecated Sub-tabs removed in Concept B redesign. Kept as no-op for compatibility.
     */
    setupOverviewSubtabs() {
        // No-op: sub-tabs removed in Concept B flat-tab redesign.
    }

    /**
     * Setup event delegation for seating chart remove buttons
     */
    setupSeatingChartEventDelegation() {
        // Remove any existing delegation listeners first
        document.removeEventListener('click', this._handleRemoveButtonClick);

        // Create bound handler
        this._handleRemoveButtonClick = (e) => {
            if (e.target.closest('.table-guest-remove')) {
                const btn = e.target.closest('.table-guest-remove');
                const eventId = btn.dataset.eventId;
                const rsvpId = btn.dataset.rsvpId;

                if (eventId && rsvpId) {
                    this.unassignGuest(eventId, rsvpId);
                }
            }
        };

        // Add event delegation
        document.addEventListener('click', this._handleRemoveButtonClick);
    }

    populateTimeline(event, eventResponses) {
        const list = document.getElementById('timeline-list');
        if (!list) return;
        list.innerHTML = '';

        const entries = this.buildTimelineEntries(event, eventResponses);
        if (!entries.length) {
            list.innerHTML = '<div class="empty-timeline">No timeline data yet</div>';
            return;
        }

        entries.slice(0, 50).forEach(item => {
            const el = document.createElement('div');
            el.className = 'timeline-item';
            el.innerHTML = `<span class="timeline-time">${item.time.toLocaleString()}</span><span class="timeline-text">${window.utils?.escapeHTML ? window.utils.escapeHTML(item.text) : item.text}</span>`;
            list.appendChild(el);
        });
    }

    buildTimelineEntries(event, eventResponses) {
        const entries = [];

        // Event creation
        if (event && event.created) {
            const createdBy = event.createdByName || event.createdBy || '';
            const whoText = createdBy ? ` by ${createdBy}` : '';
            entries.push({ time: new Date(event.created), text: `Event created${whoText}` });
        }

        // Event updates
        if (event && event.lastModified) {
            entries.push({ time: new Date(event.lastModified), text: 'Event details updated' });
        }

        // RSVP responses
        const responses = Array.isArray(eventResponses) ? eventResponses : [];
        responses.forEach(r => {
            const whenMs = new Date(r.updatedAt || r.date || r.timestamp || Date.now()).getTime();
            const time = new Date(whenMs);
            const who = r.name || r.email || r.guestName || 'Guest';
            let action = 'responded';
            // Prefer explicit boolean attending flag when present
            if (typeof r.attending === 'boolean') {
                action = r.attending ? 'accepted RSVP' : 'declined RSVP';
            } else {
                const rawStatus = (r.status || r.response || '').toString().toLowerCase();
                if (rawStatus.includes('accept') || rawStatus === 'attending' || rawStatus === 'yes') action = 'accepted RSVP';
                else if (rawStatus.includes('decline') || rawStatus === 'not attending' || rawStatus === 'no') action = 'declined RSVP';
                else if (rawStatus.includes('pending')) action = 'marked RSVP pending';
                else if (rawStatus) action = `updated RSVP (${rawStatus})`;
            }
            entries.push({ time, text: `${who} ${action}` });
        });

        // Sort newest first
        entries.sort((a, b) => b.time.getTime() - a.time.getTime());
        return entries;
    }

    /**
     * Ensure Chart.js is loaded (DRY helper)
     * @returns {Promise<boolean>} True if Chart.js is available
     */
    async _ensureChartJsLoaded() {
        if (window.Chart) return true;

        if (window.LazyLoader && typeof window.LazyLoader.loadChartJS === 'function') {
            try {
                await window.LazyLoader.loadChartJS();
                if (window.Chart) return true;
                console.warn('Chart.js failed to load');
                return false;
            } catch (error) {
                console.error('Error loading Chart.js:', error);
                return false;
            }
        }

        console.warn('LazyLoader not available, charts cannot be displayed');
        return false;
    }

    /**
     * Helper to render chart with error handling (DRY)
     * @param {Function} renderFn - Chart rendering function
     * @param {string} chartName - Name of chart for error messages
     */
    async _renderChartSafe(renderFn, chartName) {
        try {
            await renderFn();
        } catch (error) {
            console.error(`Failed to render ${chartName}:`, error);
        }
    }

    async renderAttendanceChart(stats) {
        try {
            const canvas = document.getElementById('attendanceChart');
            if (!canvas) return;

            // Ensure Chart.js is loaded
            if (!(await this._ensureChartJsLoaded())) return;

            if (this._attendanceChart) { this._attendanceChart.destroy(); }
            const data = [stats.attending || 0, stats.notAttending || 0, stats.pending || 0];
            this._attendanceChart = new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: ['Accepted', 'Declined', 'Pending'],
                    datasets: [{ data, backgroundColor: ['#2ecc71', '#e74c3c', '#f1c40f'] }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        } catch (e) {
            console.error('Error rendering attendance chart:', e);
        }
    }

    async renderResponsesChart(eventResponses) {
        try {
            const canvas = document.getElementById('responsesOverTimeChart');
            if (!canvas) return;

            // Ensure Chart.js is loaded
            if (!(await this._ensureChartJsLoaded())) return;

            const range = parseInt(document.getElementById('time-range')?.value || '30', 10);
            const now = Date.now();
            const start = now - range * 24 * 60 * 60 * 1000;
            const buckets = new Map();
            (eventResponses || []).forEach(r => {
                const t = new Date(r.updatedAt || r.date || r.timestamp || now).getTime();
                if (t < start) return;
                const d = new Date(t);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                buckets.set(key, (buckets.get(key) || 0) + 1);
            });
            const labels = Array.from(buckets.keys()).sort();
            const data = labels.map(l => buckets.get(l));
            if (this._responsesChart) { this._responsesChart.destroy(); }
            this._responsesChart = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets: [{ label: 'Responses', data, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.2)', tension: 0.25 }] },
                options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { x: { ticks: { maxRotation: 0 } }, y: { beginAtZero: true } } }
            });
        } catch (e) {
            console.error('Error rendering responses chart:', e);
        }
    }

    promptAddGuest(eventId) {
        const name = prompt('Guest name');
        if (!name) return;
        const email = prompt('Guest email');
        if (!email) return;
        if (window.managerSystem && window.managerSystem.addGuestToEvent) {
            window.managerSystem.addGuestToEvent(eventId, { name, email });
        } else {
            showToast('Adding guests is not yet available here', 'info');
        }
    }
    /**
     * Send email reminder to event attendees
     * @param {string} eventId - Event ID
     */
    async sendEventReminder(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        if (!window.githubAPI || !window.githubAPI.hasToken()) {
            showToast('GitHub token required to send email reminders', 'error');
            return;
        }

        // Show reminder options modal
        const reminderType = await this.showReminderOptionsModal(event, eventResponses);
        if (!reminderType) return; // User cancelled

        try {
            showToast('Sending email reminders...', 'info');

            // Filter attendees based on reminder type
            let recipients = [];
            if (reminderType === 'all') {
                recipients = eventResponses.filter(r => r.email);
            } else if (reminderType === 'attending') {
                recipients = eventResponses.filter(r => r.email && r.attending);
            } else if (reminderType === 'pending') {
                recipients = eventResponses.filter(r => r.email && r.attending === undefined);
            }

            if (recipients.length === 0) {
                showToast('No recipients found for the selected reminder type', 'warning');
                return;
            }

            // Calculate days until event
            const eventDate = new Date(`${event.date}T${event.time}`);
            const now = new Date();
            const daysUntil = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
            const daysText = daysUntil === 1 ? 'tomorrow' : 
                           daysUntil === 0 ? 'today' : 
                           daysUntil > 0 ? `in ${daysUntil} days` : 
                           `${Math.abs(daysUntil)} days ago`;

            // Send reminders via GitHub Actions
            let successCount = 0;
            for (const recipient of recipients) {
                try {
                    await this.sendIndividualReminder(event, recipient, daysText);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send reminder to ${recipient.email}:`, error);
                }
            }

            if (successCount > 0) {
                showToast(`Sent ${successCount} reminder email${successCount > 1 ? 's' : ''}`, 'success');
            } else {
                showToast('Failed to send reminder emails', 'error');
            }

        } catch (error) {
            console.error('Failed to send reminders:', error);
            showToast('Failed to send reminders: ' + error.message, 'error');
        }
    }

    /**
     * Show reminder options modal
     * @param {Object} event - Event data
     * @param {Array} eventResponses - Event responses
     * @returns {Promise<string|null>} Selected reminder type or null if cancelled
     */
    async showReminderOptionsModal(event, eventResponses) {
        const h = window.utils.escapeHTML;
        const stats = calculateEventStats(eventResponses);
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = window.utils.sanitizeHTML(`
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>Send Event Reminder</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); resolve(null);">×</button>
                    </div>
                    <div class="modal-body">
                        <p>Send reminder emails for: <strong>${h(event.title)}</strong></p>
                        <p>Event Date: <strong>${formatDate(event.date)} at ${formatTime(event.time)}</strong></p>
                        
                        <div style="margin: 1.5rem 0;">
                            <h4>Who should receive reminders?</h4>
                            <div class="reminder-options">
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="attending" checked>
                                    <span>Attending Only (${stats.attending} people)</span>
                                </label>
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="all">
                                    <span>All RSVPs (${eventResponses.filter(r => r.email).length} people)</span>
                                </label>
                                <label class="reminder-option">
                                    <input type="radio" name="reminderType" value="pending">
                                    <span>Pending Responses (${eventResponses.filter(r => r.email && r.attending === undefined).length} people)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove(); resolve(null);">Cancel</button>
                        <button class="btn btn-primary" onclick="
                            const selected = this.closest('.modal-content').querySelector('input[name=reminderType]:checked').value;
                            this.closest('.modal-overlay').remove();
                            resolve(selected);
                        ">Send Reminders</button>
                    </div>
                </div>
            `);

            // Add styles for reminder options
            const style = document.createElement('style');
            style.textContent = `
                .reminder-options {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .reminder-option {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .reminder-option:hover {
                    background-color: #f9fafb;
                    border-color: #d1d5db;
                }
                .reminder-option input[type="radio"] {
                    margin: 0;
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(modal);

            // Override resolve function in modal context
            modal.querySelector('.modal-content').resolve = resolve;
        });
    }

    /**
     * Send individual reminder email via GitHub Actions
     * @param {Object} event - Event data
     * @param {Object} recipient - Recipient data
     * @param {string} daysText - Days until event text
     */
    async sendIndividualReminder(event, recipient, daysText) {
        const h = window.utils.escapeHTML;
        
        // Create email content using the template structure
        const emailSubject = `${icon('clock')} Reminder: ${event.title} - ${daysText}`;
        const emailBody = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Event Reminder</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #5C4E4E, #000000); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                                        <h1 style="color: #D1D0D0; margin: 0; font-size: 28px;">EventCall</h1>
                                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px;">Where Every Event Matters</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <h2 style="color: #000000; margin: 0 0 20px 0;">Event Reminder</h2>
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            Hello <strong>${h(recipient.name || 'there')}</strong>,
                                        </p>
                                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                            This is a friendly reminder that you have an upcoming event <strong>${h(daysText)}</strong>:
                                        </p>
                                        <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
                                            <tr>
                                                <td>
                                                    <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">Event Details</h3>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Event:</strong> ${h(event.title)}</p>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${formatDate(event.date)}</p>
                                                    <p style="margin: 5px 0; color: #374151;"><strong>Time:</strong> ${formatTime(event.time)}</p>
                                                    ${event.location ? `<p style="margin: 5px 0; color: #374151;"><strong>Location:</strong> ${h(event.location)}</p>` : ''}
                                                </td>
                                            </tr>
                                        </table>
                                        ${recipient.attending ? `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #dcfce7; border-left: 4px solid #16a34a; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #166534; margin: 0 0 10px 0;">Your RSVP Status</h3>
                                                        <p style="margin: 0; color: #374151;">You are <strong>attending</strong> this event.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        ` : recipient.attending === false ? `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #991b1b; margin: 0 0 10px 0;">Your RSVP Status</h3>
                                                        <p style="margin: 0; color: #374151;">You indicated you will <strong>not be attending</strong> this event.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        ` : `
                                            <table width="100%" cellpadding="15" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 20px 0;">
                                                <tr>
                                                    <td>
                                                        <h3 style="color: #92400e; margin: 0 0 10px 0;">RSVP Needed</h3>
                                                        <p style="margin: 0; color: #374151;">Please respond to let us know if you'll be attending.</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        `}
                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="${generateInviteURL(event)}" style="display: inline-block; background: linear-gradient(135deg, #5C4E4E, #000000); color: #D1D0D0; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                                                View Event Details
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
                                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                            Powered by <strong>EventCall</strong> - Where Every Event Matters
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;

        // Trigger GitHub Actions workflow
        const payload = {
            to: recipient.email,
            subject: emailSubject,
            body: emailBody.replace(/\n\s+/g, ' ').replace(/"/g, '\\"'),
            type: 'event_reminder',
            event_id: event.id,
            event_title: event.title
        };

        await window.githubAPI.triggerWorkflow('send_email', payload);
    }

    /**
     * Generate and display QR code for event invite link
     * @param {string} eventId - Event ID
     */
    async generateEventQRCode(eventId) {
        const event = window.events ? window.events[eventId] : null;
        
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        if (!window.QRCode) {
            showToast('QR Code library not loaded', 'error');
            return;
        }

        try {
            showToast('Generating QR code...', 'info');

            // Generate invite URL
            const inviteURL = generateInviteURL(event);
            
            // Generate QR code
            const qrDataURL = await QRCode.toDataURL(inviteURL, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'M'
            });

            // Show QR code modal
            this.showQRCodeModal(event, inviteURL, qrDataURL);

        } catch (error) {
            console.error('QR Code generation failed:', error);
            showToast('Failed to generate QR code: ' + error.message, 'error');
        }
    }

    /**
     * Show QR code modal with sharing options
     * @param {Object} event - Event data
     * @param {string} inviteURL - Event invite URL
     * @param {string} qrDataURL - QR code data URL
     */
    showQRCodeModal(event, inviteURL, qrDataURL) {
        const h = window.utils.escapeHTML;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = window.utils.sanitizeHTML(`
            <div class="modal-content qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title" tabindex="0">
                <div class="modal-header">
                    <h3 id="qr-modal-title">Event QR Code</h3>
                    <button id="qr-close-btn" class="modal-close" aria-label="Close QR code modal">×</button>
                </div>
                <div class="modal-body">
                    <h4 class="qr-modal__title">${h(event.title)}</h4>
                    <p class="qr-modal__desc">
                        Scan this QR code to quickly access the event RSVP page
                    </p>

                    <div class="qr-code-container">
                        <img src="${qrDataURL}" alt="Event QR Code">
                    </div>

                    <div class="qr-actions">
                        <button id="qr-download-btn" class="btn btn-primary" aria-label="Download QR code image">
                            Download QR Code
                        </button>
                        <button id="qr-copy-link-btn" class="btn btn-secondary" aria-label="Copy event invite link">
                            Copy Invite Link
                        </button>
                        <button id="qr-share-btn" class="btn btn-secondary" aria-label="Share event invite">
                            Share Event
                        </button>
                    </div>

                    <div class="qr-info">
                        <h5>How to use:</h5>
                        <ul>
                            <li>Print and display at your event location</li>
                            <li>Share digitally via social media or messaging</li>
                            <li>Include in event flyers or promotional materials</li>
                            <li>Guests can scan to instantly access RSVP form</li>
                        </ul>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="qr-close-footer-btn" class="btn btn-secondary" aria-label="Close modal">Close</button>
                </div>
            </div>
        `);

        // Add QR modal styles
        const style = document.createElement('style');
        style.textContent = `
            .qr-modal .modal-body { padding: 1.5rem; }
            .qr-actions .btn { width: 100%; justify-content: center; display: flex; align-items: center; gap: 0.5rem; }
            .qr-code-container { transition: transform 0.2s ease; }
            .qr-code-container:hover { transform: scale(1.02); }
        `;
        document.head.appendChild(style);

        document.body.appendChild(modal);

        const dialog = modal.querySelector('.modal-content');
        const closeBtn = modal.querySelector('#qr-close-btn');
        const closeFooterBtn = modal.querySelector('#qr-close-footer-btn');
        const copyBtn = modal.querySelector('#qr-copy-link-btn');
        const downloadBtn = modal.querySelector('#qr-download-btn');
        const shareBtn = modal.querySelector('#qr-share-btn');

        // Focus trap
        const focusableSelectors = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusable = Array.from(dialog.querySelectorAll(focusableSelectors)).filter(el => !el.disabled && el.offsetParent !== null);
        const firstEl = focusable[0] || dialog;
        const lastEl = focusable[focusable.length - 1] || dialog;

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                modal.remove();
            } else if (e.key === 'Tab') {
                if (focusable.length === 0) return;
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };

        const cleanup = () => {
            dialog.removeEventListener('keydown', onKeyDown, true);
            document.head.removeChild(style);
        };

        // Attach events
        dialog.addEventListener('keydown', onKeyDown, true);
        closeBtn.addEventListener('click', () => { cleanup(); modal.remove(); });
        closeFooterBtn.addEventListener('click', () => { cleanup(); modal.remove(); });
        copyBtn.addEventListener('click', async () => { await this.copyInviteLink(inviteURL); });
        downloadBtn.addEventListener('click', () => { this.downloadQRCode(qrDataURL, event.title); });
        shareBtn.addEventListener('click', async () => { await this.shareQRCode(event.title, inviteURL); });

        // Initial focus
        (copyBtn || firstEl).focus();
    }

    /**
     * Download QR code as PNG image
     * @param {string} qrDataURL - QR code data URL
     * @param {string} eventTitle - Event title for filename
     */
    downloadQRCode(qrDataURL, eventTitle) {
        try {
            const link = document.createElement('a');
            link.download = `${eventTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr_code.png`;
            link.href = qrDataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('QR code downloaded successfully', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Failed to download QR code', 'error');
        }
    }

    /**
     * Copy invite link to clipboard
     * @param {string} inviteURL - Event invite URL
     */
    async copyInviteLink(inviteURL) {
        try {
            await navigator.clipboard.writeText(inviteURL);
            showToast('Invite link copied to clipboard', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = inviteURL;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('Invite link copied to clipboard', 'success');
            } catch (fallbackError) {
                showToast('Failed to copy link. Please copy manually: ' + inviteURL, 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    /**
     * Share event using Web Share API or fallback
     * @param {string} eventTitle - Event title
     * @param {string} inviteURL - Event invite URL
     */
    async shareQRCode(eventTitle, inviteURL) {
        const shareData = {
            title: `RSVP for ${eventTitle}`,
            text: `You're invited to ${eventTitle}! Please RSVP using the link below.`,
            url: inviteURL
        };

        try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData);
                showToast('Event shared successfully', 'success');
            } else {
                // Fallback: Copy to clipboard and show share options
                await this.copyInviteLink(inviteURL);
                showToast('Link copied! You can now paste it in your preferred app', 'info');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share failed:', error);
                // Fallback to copy
                await this.copyInviteLink(inviteURL);
            }
        }
    }

    /**
     * Generate attendee cards HTML - UPDATED with Email button and Roster Integration
     */
    generateAttendeeCards(eventResponses, eventId) {
        // XSS Protection helper
        const h = window.utils.escapeHTML;

        // Get event for seating chart info
        const event = window.events ? window.events[eventId] : null;
        let seatingChart = null;
        if (event && event.seatingChart && event.seatingChart.enabled && window.SeatingChart) {
            try {
                seatingChart = new window.SeatingChart(eventId);
                seatingChart.loadSeatingData(event);
            } catch (error) {
                console.error('Error loading seating chart for attendee cards:', error);
            }
        }

        // Get invite roster
        const roster = this.getInviteRoster(eventId);
        const respondedEmails = new Set(eventResponses.filter(r => r.email).map(r => r.email.toLowerCase().trim()));

        // Create invited-only entries for roster members who haven't responded
        const invitedOnly = roster.filter(invitee =>
            invitee.email && !respondedEmails.has(invitee.email.toLowerCase().trim())
        ).map(invitee => ({
            name: invitee.name || 'Unknown',
            email: invitee.email,
            phone: invitee.phone || '',
            guestCount: invitee.guestCount || 0,
            attending: null, // null indicates "invited but not responded"
            status: 'invited',
            timestamp: null,
            isInvitedOnly: true
        }));

        // Combine responses and invited-only entries
        const allAttendees = [...eventResponses, ...invitedOnly];

        return `
        <div class="attendee-cards" id="attendee-cards-container">
            ${allAttendees.map(response => {
                // Get table assignment if seating chart is enabled
                let tableAssignment = null;
                if (seatingChart && response.rsvpId) {
                    tableAssignment = seatingChart.findGuestAssignment(response.rsvpId);
                }

                // Normalize attending status (handle both boolean and string values)
                const isAttending = response.attending === true || response.attending === 'true';
                const isDeclined = response.attending === false || response.attending === 'false';
                const isInvited = response.attending === null || response.attending === undefined;
                const attendingStatus = isInvited ? 'invited' : (isAttending ? 'attending' : 'declined');

                return `
                <div class="attendee-card ${response.isInvitedOnly ? 'attendee-invited-only' : ''}"
                     data-name="${(response.name || '').toLowerCase()}"
                     data-status="${attendingStatus}"
                     data-branch="${(response.branch || '').toLowerCase()}"
                     data-rank="${(response.rank || '').toLowerCase()}"
                     data-unit="${(response.unit || '').toLowerCase()}"
                     data-email="${(response.email || '').toLowerCase()}"
                     data-phone="${(response.phone || '').toLowerCase()}">
                    <div class="attendee-card-header">
                        <div class="attendee-info">
                            <div class="attendee-name">
                                ${h(response.name) || 'Anonymous'}
                                ${tableAssignment ? `<span class="attendee-table-badge ${tableAssignment.vipTable ? 'vip' : ''}">Table ${tableAssignment.tableNumber}</span>` :
                                  (seatingChart && isAttending ? '<span class="attendee-table-badge unassigned">No Table</span>' : '')}
                            </div>
                            <span class="attendee-status ${
                                isInvited ? 'status-invited' :
                                (isAttending ? 'status-attending' : 'status-declined')
                            }">
                                ${isInvited ? 'Invited' :
                                  (isAttending ? 'Attending' : 'Declined')}
                            </span>
                        </div>
                    </div>
                    <div class="attendee-details">
                        ${response.email ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.email)}</span>
                            </div>
                        ` : ''}
                        ${response.phone ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.phone)}</span>
                            </div>
                        ` : ''}
                        ${response.guestCount > 0 ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>+${parseInt(response.guestCount)} guest${response.guestCount > 1 ? 's' : ''}</span>
                            </div>
                        ` : ''}
                        ${response.reason ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.reason)}</span>
                            </div>
                        ` : ''}
                        ${(response.dietaryRestrictions && response.dietaryRestrictions.length) ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${response.dietaryRestrictions.map(r => h(r)).join(', ')}</span>
                            </div>
                        ` : ''}
                        ${response.allergyDetails ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.allergyDetails)}</span>
                            </div>
                        ` : ''}
                        ${response.rank ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.rank)}</span>
                            </div>
                        ` : ''}
                        ${response.unit ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon"></span>
                                <span>${h(response.unit)}</span>
                            </div>
                        ` : ''}
                        ${response.branch ? `
                            <div class="attendee-detail-item">
                                <span class="attendee-detail-icon">🪖</span>
                                <span>${response.branch}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- UPDATED: Actions with Email Button -->
                    <div class="attendee-actions">
                        <button 
                            class="btn-attendee-action" 
                            onclick="alert('Edit feature coming soon!')"
                            title="Edit this RSVP">
                            Edit
                        </button>
                        
                        <button
                            class="btn-attendee-action btn-attendee-action-email"
                            data-action="email-attendee"
                            data-rsvp-id="${response.rsvpId}"
                            data-event-id="${eventId}"
                            ${!response.email ? 'disabled title="No email address available"' : 'title="Send email to attendee"'}>
                            Email
                        </button>
                        
                        <button 
                            class="btn-attendee-action btn-danger-attendee" 
                            onclick="if(confirm('${response.isInvitedOnly ? 'Remove from invite roster?' : 'Remove this RSVP?'}')) alert('Remove feature coming soon!')"
                            title="${response.isInvitedOnly ? 'Remove from invite roster' : 'Remove this RSVP'}">
                            Remove
                        </button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
    }
    
    /**
     * Hook a "Copy TSV" action into event actions
     * @param {Object} event - Event data
     * @param {Array} responses - RSVP responses
     */
    attachExportActions(event, responses) {
        const copyBtn = document.getElementById('copy-tsv-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                window.earlyFunctions.copyEventDataAsTSV(event, responses);
            });
        }
    }

    /**
     * Filter attendees based on search and filter
     * Add this new function to event-manager.js
     */
    filterAttendees() {
        const searchInput = document.getElementById('attendee-search');
        const filterSelect = document.getElementById('attendee-filter');
        const branchSelect = document.getElementById('filter-branch');
        const rankSelect = document.getElementById('filter-rank');
        const unitInput = document.getElementById('filter-unit');
        const cards = document.querySelectorAll('.attendee-card');

        const searchTerm = searchInput?.value.toLowerCase().trim() || '';
        const filterValue = filterSelect?.value || 'all';
        const branchValue = branchSelect?.value || '';
        const rankValue = rankSelect?.value || '';
        const unitValue = unitInput?.value.toLowerCase().trim() || '';

        let visibleCount = 0;
        const visibilityUpdates = [];

        cards.forEach(card => {
            const name = (card.dataset.name || '').toLowerCase();
            const email = (card.dataset.email || '').toLowerCase();
            const phone = (card.dataset.phone || '').toLowerCase();
            const status = card.dataset.status || '';
            const branch = (card.dataset.branch || '').toLowerCase();
            const rank = (card.dataset.rank || '').toLowerCase();
            const unit = (card.dataset.unit || '').toLowerCase();

            // Search matches name, email, or phone
            const matchesSearch = searchTerm === '' ||
                                  name.includes(searchTerm) ||
                                  email.includes(searchTerm) ||
                                  phone.includes(searchTerm) ||
                                  branch.includes(searchTerm) ||
                                  rank.includes(searchTerm) ||
                                  unit.includes(searchTerm);

            // Filter by attendance status
            const matchesFilter = filterValue === 'all' || status === filterValue;

            // Filter by branch
            const matchesBranch = branchValue === '' || branch === branchValue;

            // Filter by rank
            const matchesRank = rankValue === '' || rank === rankValue;

            // Filter by unit
            const matchesUnit = unitValue === '' || unit.includes(unitValue);

            const isVisible = matchesSearch && matchesFilter && matchesBranch && matchesRank && matchesUnit;

            visibilityUpdates.push({ element: card, show: isVisible });
            if (isVisible) visibleCount++;
        });

        // Batch DOM updates for performance
        if (window.utils?.batchVisibilityUpdate) {
            window.utils.batchVisibilityUpdate(visibilityUpdates);
        } else {
            // Fallback if util is not present
            visibilityUpdates.forEach(({ element, show }) => {
                element.style.display = show ? 'block' : 'none';
            });
        }

        // Update count display if it exists
        const countDisplay = document.getElementById('attendee-count-display');
        if (countDisplay) {
            countDisplay.textContent = `Showing ${visibleCount} of ${cards.length} attendees`;
        }
    }
    
    /**
     * Initialize filter controls with branch-rank dependency
     */
    initFilterControls() {
        const branchSelect = document.getElementById('filter-branch');
        const rankSelect = document.getElementById('filter-rank');
        
        if (!branchSelect || !rankSelect) return;
        
        const populateRanks = (branchValue) => {
            if (!window.MilitaryData) return;
            
            const ranks = window.MilitaryData.getRanksForBranch(branchValue) || [];
            rankSelect.innerHTML = window.utils.sanitizeHTML('<option value="">All Ranks</option>');
            ranks.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.value;
                opt.textContent = r.label;
                rankSelect.appendChild(opt);
            });
        };
        
        branchSelect.addEventListener('change', () => {
            const val = branchSelect.value;
            populateRanks(val);
            this.filterAttendees();
        });
        
        rankSelect.addEventListener('change', () => this.filterAttendees());

        const unitInput = document.getElementById('filter-unit');
        if (unitInput) {
            unitInput.addEventListener('input', () => this.filterAttendees());
        }
    }

    /**
     * Open email dialog for a specific attendee
     * Opens the default email client with pre-populated subject and body
     * @param {string} rsvpId - RSVP ID of the attendee
     * @param {string} eventId - Event ID
     */
    openEmailDialog(rsvpId, eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        const response = eventResponses.find(r => r.rsvpId === rsvpId);

        if (!response || !response.email || !event) {
            showToast('Guest email or event data missing.', 'error');
            return;
        }

        // 1. Define Email Content
        const emailTo = response.email;
        const guestName = response.name || 'Guest';
        const eventName = event.title || event.name || 'Event';

        // Format event date and time if available
        let eventDateTime = '';
        if (event.date) {
            const eventDate = new Date(`${event.date}T00:00:00`);
            const formattedDate = eventDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            // Use formatTime helper for consistent time formatting
            const formattedTime = event.time && typeof formatTime === 'function' ? formatTime(event.time) : event.time;
            eventDateTime = formattedTime ? `${formattedDate} at ${formattedTime}` : formattedDate;
        }

        // Format location if available
        const location = event.location ? `\n\nLocation: ${event.location}` : '';

        // Create personalized email body
        const subject = `Regarding Your RSVP for ${eventName}`;
        const body = `Dear ${guestName},

Thank you for your RSVP to ${eventName}!${eventDateTime ? `\n\nEvent Details:\nDate & Time: ${eventDateTime}` : ''}${location}

We look forward to seeing you there!

Best regards`;

        // 2. Build the Mailto URL
        const mailtoUrl = `mailto:${encodeURIComponent(emailTo)}` +
                          `?subject=${encodeURIComponent(subject)}` +
                          `&body=${encodeURIComponent(body)}`;

        // 3. Open the Email Client
        try {
            window.open(mailtoUrl, '_blank');
            console.log(`📧 Opening email client for: ${emailTo}`);
            showToast(`Opening email to ${guestName}`, 'success');
        } catch (error) {
            console.error('Failed to open email client:', error);
            showToast('Failed to open email client', 'error');
        }
    }


    /**
     * Sync RSVPs for a specific event
     * @param {string} eventId - Event ID
     */
    async syncEventRSVPs(eventId) {
        if (!window.githubAPI || !window.githubAPI.hasToken()) {
            showToast('GitHub token required to sync RSVPs', 'error');
            return;
        }

        const syncBtn = document.getElementById('sync-event-btn');
        const syncIndicator = document.getElementById('sync-indicator');
        const originalText = syncBtn ? syncBtn.textContent : '';

        try {
            if (syncBtn) {
                syncBtn.innerHTML = window.utils.sanitizeHTML('<div class="spinner"></div> Syncing...');
                syncBtn.disabled = true;
            }

            showToast('Syncing RSVPs for this event...', 'success');

            // Process RSVP issues for all events (GitHub doesn't allow filtering by event easily)
            const result = await window.githubAPI.processRSVPIssues();
            
            if (result.processed > 0) {
                // Reload responses for this event
                const responses = await window.githubAPI.loadResponses();
                window.responses = responses || {};
                
                // Refresh the management view
                await this.showEventManagement(eventId);
                
                showToast(`âœ… Synced RSVPs successfully! Found ${result.processed} new responses.`, 'success');
                
                // Show sync indicator
                if (syncIndicator) {
                    syncIndicator.style.display = 'inline';
                    setTimeout(() => {
                        syncIndicator.style.display = 'none';
                    }, 3000);
                }
                
                // Update last sync time
                const lastSyncTime = document.getElementById('last-sync-time');
                if (lastSyncTime) {
                    lastSyncTime.textContent = new Date().toLocaleTimeString();
                }
                
            } else {
                showToast('â„¹ï¸ No new RSVPs found for this event', 'success');
            }

        } catch (error) {
            console.error('Event RSVP sync failed:', error);
            showToast('âŒ Sync failed: ' + error.message, 'error');
        } finally {
            if (syncBtn) {
                syncBtn.textContent = originalText;
                syncBtn.disabled = false;
            }
        }
    }

    /**
     * Generate seating chart section HTML
     * @param {Object} event - Event data
     * @param {string} eventId - Event ID
     * @param {Array} eventResponses - RSVP responses
     * @returns {string} HTML content
     */
    generateSeatingChartSection(event, eventId, eventResponses) {
        if (!event.seatingChart || !event.seatingChart.enabled) return '';
        if (!window.SeatingChart) {
            console.error('SeatingChart class not loaded');
            return '<div class="error-message">Seating chart module not loaded. Please refresh the page.</div>';
        }

        const h = window.utils.escapeHTML;
        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // Get attending guests only
        const attendingGuests = eventResponses.filter(r => r.attending === true || r.attending === 'true');

        // Sync unassigned guests
        seatingChart.syncUnassignedGuests(attendingGuests);

        // Get stats
        const stats = seatingChart.getSeatingStats();

        // Get unassigned guests with full details
        const unassignedGuestsDetails = attendingGuests.filter(rsvp =>
            seatingChart.seatingData.unassignedGuests.includes(rsvp.rsvpId)
        );

        return `
            <!-- Seating Chart Section (Special Tab) -->
            <div class="seating-chart-section">
                <h2 class="rsvp-dashboard-title">🪑 Seating Chart</h2>

                <!-- Seating Stats -->
                <div class="rsvp-stats-cards">
                    <div class="stat-card-large stat-card-seated">
                        <div class="stat-card-icon">🪑</div>
                        <div class="stat-card-number">${stats.assigned}</div>
                        <div class="stat-card-label">Seated Guests</div>
                    </div>
                    <div class="stat-card-large stat-card-unassigned">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.unassigned}</div>
                        <div class="stat-card-label">Unassigned</div>
                    </div>
                    <div class="stat-card-large stat-card-available">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.available}</div>
                        <div class="stat-card-label">Available Seats</div>
                    </div>
                    <div class="stat-card-large stat-card-capacity">
                        <div class="stat-card-icon"></div>
                        <div class="stat-card-number">${stats.percentFilled}%</div>
                        <div class="stat-card-label">Capacity Used</div>
                    </div>
                </div>

                <!-- Seating Actions -->
                <div class="invite-actions-section">
                    <button class="btn-action" data-action="auto-assign-seats" data-event-id="${eventId}">
                        Auto-Assign All
                    </button>
                    <button class="btn-action" data-action="export-seating" data-event-id="${eventId}">
                        Export Seating Chart
                    </button>
                    <button class="btn-action" data-action="refresh-seating" data-event-id="${eventId}">
                        Refresh
                    </button>
                </div>

                ${unassignedGuestsDetails.length > 0 ? `
                    <!-- Unassigned Guests Section -->
                    <div class="unassigned-section">
                        <h3>
                            Unassigned Guests
                            <span class="unassigned-count">${unassignedGuestsDetails.length}</span>
                        </h3>
                        <div class="unassigned-guests-list">
                            ${unassignedGuestsDetails.map(guest => `
                                <div class="unassigned-guest-item">
                                    <div class="unassigned-guest-info">
                                        <div class="unassigned-guest-name">${h(guest.name)}</div>
                                        <div class="unassigned-guest-details">
                                            ${guest.rank ? h(guest.rank) + ' • ' : ''}${guest.unit ? h(guest.unit) : ''}
                                            ${guest.guestCount ? ` • +${guest.guestCount} guest${guest.guestCount > 1 ? 's' : ''}` : ''}
                                        </div>
                                    </div>
                                    <div class="unassigned-guest-actions">
                                    <select class="table-move-select" data-action="assign-table" data-event-id="${eventId}" data-rsvp-id="${guest.rsvpId}">
                                    <option value="">Select Table...</option>
                                            ${event.seatingChart.tables.map(table => {
                                                const occupancy = seatingChart.getTableOccupancy(table.tableNumber);
                                                const available = table.capacity - occupancy;
                                                const guestCount = 1 + (guest.guestCount || 0);
                                                const canFit = available >= guestCount;
                                                return `<option value="${table.tableNumber}" ${!canFit ? 'disabled' : ''}>
                                                    Table ${table.tableNumber} ${table.vipTable ? '' : ''} (${available}/${table.capacity} available)
                                                </option>`;
                                            }).join('')}
                                        </select>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="seating-empty-state">
                        <h3>All Attending Guests Assigned</h3>
                        <p>All guests have been assigned to tables.</p>
                    </div>
                `}

                <!-- Tables Grid -->
                <div class="tables-grid">
                    ${event.seatingChart.tables.map(table => {
                        const occupancy = seatingChart.getTableOccupancy(table.tableNumber);
                        const percentFull = (occupancy / table.capacity) * 100;
                        const isFull = occupancy >= table.capacity;
                        const isAlmostFull = percentFull >= 75 && !isFull;

                        return `
                            <div class="table-card ${table.vipTable ? 'vip-table' : ''} ${isFull ? 'full' : ''}">
                                <div class="table-header">
                                    <div class="table-number">
                                        ${table.vipTable ? '' : ''}Table ${table.tableNumber}
                                    </div>
                                    <div class="table-capacity ${isFull ? 'full' : isAlmostFull ? 'almost-full' : ''}">
                                        ${occupancy}/${table.capacity}
                                    </div>
                                </div>
                                <div class="table-guests-list">
                                    ${table.assignedGuests.length > 0 ? table.assignedGuests.map(guest => {
                                        const guestRsvp = attendingGuests.find(r => r.rsvpId === guest.rsvpId);
                                        const totalGuestCount = 1 + (guest.guestCount || 0);

                                        return `
                                        <div class="table-guest-item">
                                            <div class="table-guest-info">
                                                <span class="table-guest-name">${h(guest.name)}</span>
                                                ${guest.guestCount > 0 ? `<span class="table-guest-count">+${guest.guestCount}</span>` : ''}
                                            </div>
                                            <div class="table-guest-actions">
                                                <select class="table-move-select" data-action="assign-table" data-event-id="${eventId}" data-rsvp-id="${guest.rsvpId}">
                                                    <option value="">Move to...</option>
                                                    ${event.seatingChart.tables.map(t => {
                                                        if (t.tableNumber === table.tableNumber) return ''; // Skip current table
                                                        const tOccupancy = seatingChart.getTableOccupancy(t.tableNumber);
                                                        const tAvailable = t.capacity - tOccupancy;
                                                        const canFit = tAvailable >= totalGuestCount;
                                                        return `<option value="${t.tableNumber}" ${!canFit ? 'disabled' : ''}>
                                                            Table ${t.tableNumber} ${t.vipTable ? '' : ''} (${tAvailable}/${t.capacity} avail)
                                                        </option>`;
                                                    }).join('')}
                                                </select>
                                                <button class="table-guest-remove" data-event-id="${eventId}" data-rsvp-id="${guest.rsvpId}" title="Remove from table">
                                                    
                                                </button>
                                            </div>
                                        </div>
                                        `;
                                    }).join('') : `
                                        <div class="table-empty-state">
                                            Empty table
                                        </div>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Generate response table HTML with enhanced features
     * @param {Object} event - Event data
     * @param {Array} eventResponses - RSVP responses
     * @param {Object} stats - Event statistics
     * @returns {string} HTML content
     */
    generateResponseTable(event, eventResponses, stats) {
        const eventId = event.id;

        // PAGINATION: Calculate how many to show initially
        this.resetRsvpPagination(eventId);
        const shownCount = Math.min(this.rsvpPagination.pageSize, eventResponses.length);

        let html = `
            <div style="margin-bottom: 2rem;">
                <div class="response-stats">
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-navy); font-size: 2rem; font-weight: 900;">${stats.totalHeadcount}</div>
                        <div class="stat-label"> TOTAL HEADCOUNT</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--success-color);">${stats.attending}</div>
                        <div class="stat-label">âœ… Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--error-color);">${stats.notAttending}</div>
                        <div class="stat-label">âŒ Not Attending</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number" style="color: var(--semper-navy);">${stats.total}</div>
                        <div class="stat-label">Total RSVPs</div>
                    </div>
                </div>
            </div>

            <div class="search-controls">
                <div class="search-row">
                    <input type="text" id="response-search" class="search-input" 
                           placeholder=" Search responses by name, email, phone, or any field..."
                           onkeyup="eventManager.filterResponses('${eventId}')">
                    
                    <select id="attendance-filter" class="search-filter" onchange="eventManager.filterResponses('${eventId}')">
                        <option value="">All Responses</option>
                        <option value="attending">âœ… Attending Only</option>
                        <option value="not-attending">âŒ Not Attending Only</option>
                    </select>
                    
                    <button class="clear-search" onclick="eventManager.clearSearch('${eventId}')">Clear</button>
                    <button class="btn btn-success" onclick="eventManager.syncEventRSVPs('${eventId}')" style="margin-left: 0.5rem;">
                        Refresh
                    </button>
                </div>
                
                <div class="search-stats" id="search-stats-${eventId}">
                    Showing ${shownCount} of ${eventResponses.length} responses
                </div>
            </div>

            <div class="bulk-actions" id="bulk-actions-${eventId}">
                <div class="bulk-actions-inner">
                    <span class="bulk-actions-count">
                        <span id="selected-count-${eventId}">0</span> selected
                    </span>
                    <button class="btn-small" onclick="eventManager.bulkExportSelected('${eventId}')" title="Export selected responses to CSV">
                        Export Selected
                    </button>
                    <button class="btn-small" onclick="eventManager.bulkEmailSelected('${eventId}')" title="Email selected attendees">
                        Email Selected
                    </button>
                    <button class="btn-small btn-danger" onclick="eventManager.bulkDeleteSelected('${eventId}')" title="Delete selected responses">
                        Delete Selected
                    </button>
                </div>
            </div>

            <div class="response-table-wrap">
                <table class="response-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;">
                                <input type="checkbox" id="select-all-${eventId}" onchange="eventManager.toggleSelectAll('${eventId}')" aria-label="Select all responses">
                            </th>
                            <th>Name</th>
                            <th data-priority="low">Email</th>
                            <th data-priority="low">Phone</th>
                            <th>Attending</th>
                            ${event.askReason ? '<th>Reason</th>' : ''}
                            ${event.allowGuests ? '<th>Guests</th>' : ''}
                            ${event.customQuestions ? event.customQuestions.map(q => `<th>${q.question}</th>`).join('') : ''}
                            <th>Submitted</th>
                            <th data-priority="low">Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="response-table-body-${eventId}">
        `;

        // Show only the first batch (shownCount calculated at top of function)
        const responsesToShow = eventResponses.slice(0, shownCount);

        responsesToShow.forEach((response, index) => {
            const displayName = response.name || 'Unknown';
            const email = response.email || 'N/A';
            const phone = response.phone || 'N/A';
            const source = response.issueNumber ? `GitHub Issue #${response.issueNumber}` : 'Direct Entry';
            const sourceIcon = response.issueNumber ? '' : '';

            html += `
                <tr class="response-row" data-response-index="${index}"
                    data-name="${displayName.toLowerCase()}"
                    data-attending="${response.attending}"
                    data-reason="${(response.reason || '').toLowerCase()}"
                    data-guest-count="${response.guestCount || 0}"
                    data-phone="${phone.toLowerCase()}"
                    data-email="${email.toLowerCase()}"
                    data-branch="${(response.branch || '').toLowerCase()}"
                    data-rank="${(response.rank || '').toLowerCase()}"
                    data-unit="${(response.unit || '').toLowerCase()}">
                    <td>
                        <input type="checkbox" class="response-checkbox" data-response-index="${index}" onchange="eventManager.updateBulkActions('${eventId}')">
                    </td>
                    <td><strong>${displayName}</strong></td>
                    <td data-priority="low"><a href="mailto:${email}" style="color: var(--semper-red); text-decoration: none;">${email}</a></td>
                    <td data-priority="low">${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--semper-red); text-decoration: none;">${phone}</a>` : phone}</td>
                    <td class="${response.attending ? 'attending-yes' : 'attending-no'}">
                        ${response.attending ? 'âœ… Yes' : 'âŒ No'}
                    </td>
                    ${event.askReason ? `<td style="max-width: 200px; word-wrap: break-word;">${response.reason || '-'}</td>` : ''}
                    ${event.allowGuests ? `<td><strong>${response.guestCount || 0}</strong> ${(response.guestCount || 0) === 1 ? 'guest' : 'guests'}</td>` : ''}
                    ${event.customQuestions ? event.customQuestions.map(q => {
                        let answer = response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '-';
                        // Format datetime answers
                        if (answer !== '-' && q.type === 'datetime' && answer.includes('T')) {
                            const [datePart, timePart] = answer.split('T');
                            answer = `${datePart} ${timePart}`;
                        } else if (answer !== '-' && q.type === 'date') {
                            // Date is already in YYYY-MM-DD format, just display it
                            answer = answer;
                        }
                        return `<td style="max-width: 150px; word-wrap: break-word;">${answer}</td>`;
                    }).join('') : ''}
                    <td style="font-size: 0.875rem;">${new Date(response.timestamp).toLocaleString()}</td>
                    <td data-priority="low" style="font-size: 0.875rem;" title="${source}">
                        ${sourceIcon} ${response.issueNumber ? `#${response.issueNumber}` : 'Direct'}
                    </td>
                    <td>
                        <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                                onclick="eventManager.deleteResponse('${eventId}', ${index})" 
                                title="Delete this RSVP"></button>
                        ${response.issueUrl ? `
                            <a href="${response.issueUrl}" target="_blank" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;" title="View GitHub Issue">
                                
                            </a>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';

        // Add "Load More" button if there are more responses
        if (shownCount < eventResponses.length) {
            const remaining = eventResponses.length - shownCount;
            html += `
                <div id="rsvp-load-more-${eventId}" class="load-more-btn" style="text-align: center; margin-top: 1.5rem;">
                    <button class="btn btn-secondary" onclick="eventManager.loadMoreRsvps('${eventId}')">
                        Load More RSVPs (${remaining} remaining)
                    </button>
                </div>
            `;
        }

        return html;
    }

    /**
     * Generate response table rows for a subset of responses
     * Used by both initial render and loadMoreRsvps
     * @param {Object} event - Event data
     * @param {Array} allResponses - All RSVP responses
     * @param {Object} stats - Event statistics (unused, kept for consistency)
     * @param {number} startIdx - Starting index in allResponses
     * @param {number} endIdx - Ending index in allResponses (exclusive)
     * @returns {string} HTML for table rows
     */
    generateResponseRows(event, allResponses, stats, startIdx, endIdx) {
        const eventId = event.id;
        const responses = allResponses.slice(startIdx, endIdx);
        let html = '';

        responses.forEach((response, i) => {
            const index = startIdx + i; // Original index for data attributes
            const displayName = response.name || 'Unknown';
            const email = response.email || 'N/A';
            const phone = response.phone || 'N/A';
            const source = response.issueNumber ? `GitHub Issue #${response.issueNumber}` : 'Direct Entry';
            const sourceIcon = response.issueNumber ? '' : '';

            html += `
                <tr class="response-row" data-response-index="${index}"
                    data-name="${displayName.toLowerCase()}"
                    data-attending="${response.attending}"
                    data-reason="${(response.reason || '').toLowerCase()}"
                    data-guest-count="${response.guestCount || 0}"
                    data-phone="${phone.toLowerCase()}"
                    data-email="${email.toLowerCase()}"
                    data-branch="${(response.branch || '').toLowerCase()}"
                    data-rank="${(response.rank || '').toLowerCase()}"
                    data-unit="${(response.unit || '').toLowerCase()}">
                    <td>
                        <input type="checkbox" class="response-checkbox" data-response-index="${index}" onchange="eventManager.updateBulkActions('${eventId}')">
                    </td>
                    <td><strong>${displayName}</strong></td>
                    <td data-priority="low"><a href="mailto:${email}" style="color: var(--semper-red); text-decoration: none;">${email}</a></td>
                    <td data-priority="low">${phone !== 'N/A' ? `<a href="tel:${phone}" style="color: var(--semper-red); text-decoration: none;">${phone}</a>` : phone}</td>
                    <td class="${response.attending ? 'attending-yes' : 'attending-no'}">
                        ${response.attending ? 'Yes' : 'No'}
                    </td>
                    ${event.askReason ? `<td style="max-width: 200px; word-wrap: break-word;">${response.reason || '-'}</td>` : ''}
                    ${event.allowGuests ? `<td><strong>${response.guestCount || 0}</strong> ${(response.guestCount || 0) === 1 ? 'guest' : 'guests'}</td>` : ''}
                    ${event.customQuestions ? event.customQuestions.map(q => {
                        let answer = response.customAnswers && response.customAnswers[q.id] ? response.customAnswers[q.id] : '-';
                        if (answer !== '-' && q.type === 'datetime' && answer.includes('T')) {
                            const [datePart, timePart] = answer.split('T');
                            answer = `${datePart} ${timePart}`;
                        }
                        return `<td style="max-width: 150px; word-wrap: break-word;">${answer}</td>`;
                    }).join('') : ''}
                    <td style="font-size: 0.875rem;">${new Date(response.timestamp).toLocaleString()}</td>
                    <td data-priority="low" style="font-size: 0.875rem;" title="${source}">
                        ${sourceIcon} ${response.issueNumber ? `#${response.issueNumber}` : 'Direct'}
                    </td>
                    <td>
                        <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;"
                                onclick="eventManager.deleteResponse('${eventId}', ${index})"
                                title="Delete this RSVP"></button>
                        ${response.issueUrl ? `
                            <a href="${response.issueUrl}" target="_blank" class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-left: 0.25rem;" title="View GitHub Issue">
                                
                            </a>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        return html;
    }

    /**
     * Filter responses based on search criteria
     * @param {string} eventId - Event ID
     */
    filterResponses(eventId) {
        const searchTerm = document.getElementById('response-search').value.toLowerCase();
        const attendanceFilter = document.getElementById('attendance-filter').value;
        const rows = document.querySelectorAll(`#response-table-body-${eventId} .response-row`);
        const statsElement = document.getElementById(`search-stats-${eventId}`);
        
        let visibleCount = 0;
        let totalCount = rows.length;
        
        rows.forEach(row => {
            const name = row.getAttribute('data-name');
            const attending = row.getAttribute('data-attending');
            const reason = row.getAttribute('data-reason');
            const guestCount = row.getAttribute('data-guest-count');
            const phone = row.getAttribute('data-phone');
            const email = row.getAttribute('data-email');
            const branch = row.getAttribute('data-branch') || '';
            const rank = row.getAttribute('data-rank') || '';
            const unit = row.getAttribute('data-unit') || '';

            const matchesSearch = searchTerm === '' || 
                name.includes(searchTerm) || 
                reason.includes(searchTerm) ||
                guestCount.includes(searchTerm) ||
                phone.includes(searchTerm) ||
                email.includes(searchTerm) ||
                branch.includes(searchTerm) ||
                rank.includes(searchTerm) ||
                unit.includes(searchTerm);
            
            const matchesAttendance = attendanceFilter === '' ||
                (attendanceFilter === 'attending' && attending === 'true') ||
                (attendanceFilter === 'not-attending' && attending === 'false');
            
            if (matchesSearch && matchesAttendance) {
                row.classList.remove('hidden');
                visibleCount++;
                
                if (searchTerm !== '') {
                    row.classList.add('highlight');
                } else {
                    row.classList.remove('highlight');
                }
            } else {
                row.classList.add('hidden');
            }
        });
        
        if (searchTerm || attendanceFilter) {
            statsElement.innerHTML = window.utils.sanitizeHTML(`${icon('link')} Showing ${visibleCount} of ${totalCount} responses`);
            if (visibleCount === 0) {
                statsElement.innerHTML = window.utils.sanitizeHTML(statsElement.innerHTML + ' - <span style="color: var(--error-color);">No matches found</span>');
            }
        } else {
            statsElement.innerHTML = window.utils.sanitizeHTML(`${icon('bar-chart')} Showing ${totalCount} of ${totalCount} responses`);
        }
    }

    /**
     * Clear search filters
     * @param {string} eventId - Event ID
     */
    clearSearch(eventId) {
        document.getElementById('response-search').value = '';
        document.getElementById('attendance-filter').value = '';
        
        const rows = document.querySelectorAll(`#response-table-body-${eventId} .response-row`);
        rows.forEach(row => {
            row.classList.remove('hidden', 'highlight');
        });
        
        const statsElement = document.getElementById(`search-stats-${eventId}`);
        statsElement.innerHTML = window.utils.sanitizeHTML(`${icon('bar-chart')} Showing ${rows.length} of ${rows.length} responses`);

        showToast('Search cleared', 'success');
    }

    /**
     * Copy invite link for an event
     * @param {string} eventId - Event ID
     */
    async copyInviteLink(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }
        
        try {
            const link = generateInviteURL(event);
            const success = await copyToClipboard(link);
            
            if (success) {
                showToast('Invite link copied to clipboard!', 'success');
                
                // Briefly highlight the input field
                const input = document.getElementById('invite-link-input');
                if (input) {
                    input.style.background = 'rgba(16, 185, 129, 0.1)';
                    setTimeout(() => {
                        input.style.background = '';
                    }, 1000);
                }
            } else {
                const input = document.getElementById('invite-link-input');
                if (input) {
                    input.select();
                    input.focus();
                }
            }
        } catch (error) {
            console.error('Failed to copy link:', error);
            showToast('Failed to copy link', 'error');
        }
    }

    /**
     * Toggle visibility of redundant buttons in edit mode
     * @param {boolean} show - true to show, false to hide
     * @private
     */
    _toggleRedundantEditButtons(show) {
        const displayStyle = show ? '' : 'none';
        // Form may be inside #dashboard-create-form (inline) or #create
        const formRoot = document.querySelector('#dashboard-create-form') || document.querySelector('#create');
        if (!formRoot) return;
        const backBtn = formRoot.querySelector('.btn-back');
        const cancelBtn = formRoot.querySelector('.form-actions .btn-secondary:not(#cancel-edit-btn)');
        if (backBtn) backBtn.style.display = displayStyle;
        if (cancelBtn) cancelBtn.style.display = displayStyle;
    }

    /**
     * Edit an existing event
     * @param {string} eventId - Event ID
     */
    editEvent(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        this.editMode = true;
        this.currentEvent = event;

        // Populate the create form with event data
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time;
        document.getElementById('event-location').value = event.location || '';
        document.getElementById('event-description').value = event.description || '';
        document.getElementById('ask-reason').checked = event.askReason || false;
        document.getElementById('allow-guests').checked = event.allowGuests || false;
        document.getElementById('requires-meal-choice').checked = event.requiresMealChoice || false;

        // Set invite template selection
        const templateValue = event.inviteTemplate || event.invite_template || 'envelope';
        const templateRadio = document.querySelector(`input[name="invite_template"][value="${templateValue}"]`);
        if (templateRadio) {
            templateRadio.checked = true;
        }

        // Handle cover image
        const coverPreview = document.getElementById('cover-preview');
        if (event.coverImage) {
            coverPreview.src = event.coverImage;
            coverPreview.classList.remove('hidden');
            const urlInput = document.getElementById('cover-image-url');
            if (urlInput) urlInput.value = event.coverImage;

            // Update upload area to show existing image (preserve file input)
            const uploadArea = document.getElementById('cover-upload');
            if (uploadArea) {
                const existingInput = uploadArea.querySelector('input[type="file"]');
                const pElements = uploadArea.querySelectorAll('p');
                pElements.forEach(p => p.remove());
                // Remove any existing delete button
                const existingDeleteBtn = uploadArea.querySelector('.cover-delete-btn');
                if (existingDeleteBtn) existingDeleteBtn.remove();

                const p1 = document.createElement('p');
                p1.classList.add('cover-upload-message', 'cover-upload-message--success');
                p1.textContent = 'Current image loaded';

                const p2 = document.createElement('p');
                p2.classList.add('cover-upload-message', 'cover-upload-message--hint');
                p2.textContent = 'Click to change image';

                // Add delete button for removing cover image
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'cover-delete-btn';
                deleteBtn.textContent = 'Remove Cover Image';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeCoverImage();
                };

                uploadArea.insertBefore(p2, existingInput);
                uploadArea.insertBefore(p1, p2);
                uploadArea.insertBefore(deleteBtn, existingInput);
            }
        } else {
            // Reset upload area for new image (preserve file input)
            const uploadArea = document.getElementById('cover-upload');
            if (uploadArea) {
                const existingInput = uploadArea.querySelector('input[type="file"]');
                const pElements = uploadArea.querySelectorAll('p');
                pElements.forEach(p => p.remove());

                const p = document.createElement('p');
                p.textContent = 'Click or drag to upload cover image';
                uploadArea.insertBefore(p, existingInput);
            }
        }

        // Populate custom questions
        this.populateCustomQuestions(event.customQuestions || []);

        // Populate event details fields (template-specific fields)
        if (event.eventDetails && Object.keys(event.eventDetails).length > 0) {
            if (window.eventTemplates) {
                window.eventTemplates.populateEventDetailsFields(event.eventDetails);
            }
        }

        // Seating configuration UI: reflect existing event seating settings
        const enableSeating = document.getElementById('enable-seating');
        const seatingConfigFields = document.getElementById('seating-config-fields');
        const tablesInput = document.getElementById('number-of-tables');
        const seatsInput = document.getElementById('seats-per-table');
        const totalCapacitySpan = document.getElementById('total-seating-capacity');

        if (enableSeating) {
            const hasSeating = !!(event.seatingChart && event.seatingChart.enabled);
            enableSeating.checked = hasSeating;
            if (seatingConfigFields) seatingConfigFields.classList.toggle('hidden', !hasSeating);
            if (hasSeating) {
                const nTables = event.seatingChart.numberOfTables || 0;
                const seatsPer = event.seatingChart.seatsPerTable || 0;
                if (tablesInput) tablesInput.value = nTables;
                if (seatsInput) seatsInput.value = seatsPer;
                if (totalCapacitySpan) totalCapacitySpan.textContent = (nTables * seatsPer) || 0;
            }
        }

        // Change form submission behavior
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = 'Update Event';
        submitBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)';

        // Add cancel button
        if (!document.getElementById('cancel-edit-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancel-edit-btn';
            cancelBtn.className = 'btn btn-secondary';
            cancelBtn.textContent = 'Cancel Edit';
            cancelBtn.style.marginLeft = '0.5rem';
            cancelBtn.onclick = () => this.cancelEdit();
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        }

        // Hide Back button and Cancel button in edit mode (they're redundant with Cancel Edit)
        this._toggleRedundantEditButtons(false);

        showPage('create');
        // Title may be inside #dashboard-create-form (inline) or #create
        const editTitle = document.querySelector('#dashboard-create-form h2') || document.querySelector('#create h2');
        if (editTitle) editTitle.textContent = 'Edit Event';
        if (window.setupPhotoUpload) {
            const uploadAreaInit = document.getElementById('cover-upload');
            if (uploadAreaInit) {
                uploadAreaInit.dataset.uploadInitialized = 'false';
            }
            window.setupPhotoUpload();
        }
    }

    /**
     * Populate custom questions in edit mode
     * @param {Array} questions - Custom questions array
     */
    populateCustomQuestions(questions) {
        const container = document.getElementById('custom-questions-container');
        container.innerHTML = '';

        // Only add questions if they exist - no default empty question
        if (questions && questions.length > 0) {
            questions.forEach(q => {
                const questionItem = document.createElement('div');
                questionItem.className = 'custom-question-item';
                // Avoid sanitizing full template to preserve inline onclick.
                // Escape dynamic attribute value to prevent injection.
                questionItem.innerHTML = `
                    <input type="text" placeholder="Enter your question..." class="custom-question-input" value="${window.utils.escapeHTML(q.question || '')}">
                    <button type="button" class="btn btn-danger" onclick="removeCustomQuestion(this)"></button>
                `;
                container.appendChild(questionItem);
            });
        }
    }

    /**
     * Remove cover image from current edit
     */
    removeCoverImage() {
        // Clear cover preview
        const coverPreview = document.getElementById('cover-preview');
        if (coverPreview) {
            coverPreview.src = '';
            coverPreview.classList.add('hidden');
        }

        // Clear cover URL input
        const urlInput = document.getElementById('cover-image-url');
        if (urlInput) urlInput.value = '';

        // Clear file input
        const fileInput = document.getElementById('cover-input');
        if (fileInput) fileInput.value = '';

        // Reset upload area UI
        const uploadArea = document.getElementById('cover-upload');
        if (uploadArea) {
            const existingInput = uploadArea.querySelector('input[type="file"]');
            const pElements = uploadArea.querySelectorAll('p');
            pElements.forEach(p => p.remove());
            // Remove delete button
            const deleteBtn = uploadArea.querySelector('.cover-delete-btn');
            if (deleteBtn) deleteBtn.remove();

            const p = document.createElement('p');
            p.textContent = 'Click or drag to upload cover image';
            uploadArea.insertBefore(p, existingInput);
        }

        window.showToast('Cover image removed', 'info');
    }

    /**
     * Cancel edit mode
     */
    cancelEdit(navigateToEventId) {
        var eventId = navigateToEventId || (this.currentEvent && this.currentEvent.id) || null;
        this.editMode = false;
        this.currentEvent = null;

        // Reset form
        document.getElementById('event-form').reset();
        document.getElementById('cover-preview').classList.add('hidden');
        clearCustomQuestions();

        // Reset submit button
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = 'Deploy Event';
        submitBtn.style.background = '';

        // Remove cancel button
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.remove();
        }

        // Reset page title
        const createTitle = document.querySelector('#dashboard-create-form h2') || document.querySelector('#create h2');
        if (createTitle) createTitle.textContent = 'Create New Event';

        // Restore Back button and Cancel button
        this._toggleRedundantEditButtons(true);

        // Navigate to event manage view if we have an eventId, otherwise dashboard
        if (eventId) {
            showPage('manage', eventId);
        } else if (typeof window.navigateTo === 'function') {
            window.navigateTo('dashboard');
        } else {
            showPage('dashboard');
        }
    }

    /**
     * Update an existing event
     * @param {Object} eventData - Updated event data
     */
    async updateEvent(eventData) {
        try {
            // Preserve original creation data
            eventData.id = this.currentEvent.id;
            eventData.created = this.currentEvent.created;
            eventData.createdBy = this.currentEvent.createdBy;
            eventData.createdByName = this.currentEvent.createdByName;
            eventData.lastModified = Date.now();

            if (window.BackendAPI) {
                await window.BackendAPI.updateEvent(eventData.id, {
                    title: eventData.title,
                    description: eventData.description,
                    date: eventData.date,
                    time: eventData.time,
                    location: eventData.location,
                    coverImageUrl: eventData.coverImage,
                    status: eventData.status,
                    allowGuests: eventData.allowGuests,
                    requiresMealChoice: eventData.requiresMealChoice,
                    customQuestions: eventData.customQuestions,
                    eventDetails: eventData.eventDetails,
                    seatingChart: eventData.seatingChart,
                    inviteTemplate: eventData.inviteTemplate
                });
            } else {
                throw new Error('Backend API not available');
            }

            // Update local state
            if (window.events) {
                window.events[eventData.id] = eventData;
            }

            showToast('Event updated successfully!', 'success');

            // Reset edit mode and navigate to the updated event's manage view
            this.cancelEdit(eventData.id);

            // Refresh dashboard data in the background
            renderDashboard();

        } catch (error) {
            console.error('Failed to update event:', error);
            throw error;
        }
    }

    /**
     * Duplicate an existing event
     * @param {string} eventId - Event ID to duplicate
     */
    duplicateEvent(eventId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event) {
            showToast('Event not found', 'error');
            return;
        }

        // Create a copy with new ID and updated title
        const duplicatedEvent = {
            ...event,
            id: generateUUID(),
            title: `${event.title} (Copy)`,
            created: Date.now(),
            lastModified: Date.now()
        };

        // Populate form with duplicated data
        this.editMode = false; // Not editing, creating new
        this.currentEvent = null;

        document.getElementById('event-title').value = duplicatedEvent.title;
        document.getElementById('event-date').value = duplicatedEvent.date;
        document.getElementById('event-time').value = duplicatedEvent.time;
        document.getElementById('event-location').value = duplicatedEvent.location || '';
        document.getElementById('event-description').value = duplicatedEvent.description || '';
        document.getElementById('ask-reason').checked = duplicatedEvent.askReason || false;
        document.getElementById('allow-guests').checked = duplicatedEvent.allowGuests || false;

        // Handle cover image
        const coverPreview = document.getElementById('cover-preview');
        if (duplicatedEvent.coverImage) {
            coverPreview.src = duplicatedEvent.coverImage;
            coverPreview.classList.remove('hidden');
        }

        // Populate custom questions
        this.populateCustomQuestions(duplicatedEvent.customQuestions || []);

        showPage('create');
        showToast('Event duplicated - modify details and deploy', 'success');
    }

    /**
     * Delete a specific RSVP response
     * Uses PESSIMISTIC approach: server confirmation BEFORE local state update
     * @param {string} eventId - Event ID
     * @param {number} responseIndex - Index of response to delete
     */
    async deleteResponse(eventId, responseIndex) {
        if (!confirm('Are you sure you want to delete this RSVP response?')) {
            return;
        }

        try {
            const eventResponses = window.responses ? [...(window.responses[eventId] || [])] : [];
            const deletedResponse = eventResponses[responseIndex];

            if (!deletedResponse) {
                showToast('Response not found', 'error');
                return;
            }

            // PESSIMISTIC: Prepare the new array but don't apply to local state yet
            const updatedResponses = [...eventResponses];
            updatedResponses.splice(responseIndex, 1);

            // Try backend API first (if available)
            let serverSuccess = false;
            if (window.BackendAPI && window.BackendAPI.deleteRsvp && deletedResponse.id) {
                await window.BackendAPI.deleteRsvp(deletedResponse.id);
                serverSuccess = true;
            } else if (window.githubAPI && window.githubAPI.hasToken()) {
                // Fall back to GitHub
                const path = `rsvps/${eventId}.json`;
                const content = window.githubAPI.safeBase64Encode(JSON.stringify(updatedResponses, null, 2));

                // Get existing file info
                const existingResponse = await fetch(window.GITHUB_CONFIG.getContentsUrl('main', path), {
                    headers: {
                        'Authorization': `token ${window.githubAPI.getToken()}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'EventCall-App'
                    }
                });

                let createData = {
                    message: `Delete RSVP response: ${deletedResponse.name}`,
                    content: content,
                    branch: 'main'
                };

                if (existingResponse.ok) {
                    const existingData = await existingResponse.json();
                    createData.sha = existingData.sha;
                }

                const saveResponse = await fetch(window.GITHUB_CONFIG.getContentsUrl('main', path), {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${window.githubAPI.getToken()}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'EventCall-App'
                    },
                    body: JSON.stringify(createData)
                });

                if (!saveResponse.ok) {
                    throw new Error('Failed to save changes to server');
                }
                serverSuccess = true;
            }

            // PESSIMISTIC: Only update local state AFTER server success
            if (serverSuccess || (!window.BackendAPI && !window.githubAPI)) {
                if (window.responses) {
                    window.responses[eventId] = updatedResponses;
                }
            }

            // Refresh the event management view
            this.showEventManagement(eventId);
            showToast('RSVP response deleted successfully', 'success');

        } catch (error) {
            console.error('Failed to delete response:', error);
            showToast('Failed to delete response: ' + error.message, 'error');
        }
    }

    /**
     * Get event creation form data
     * @returns {Object} Event data from form
     */
    getFormData() {
        const coverPreviewEl = document.getElementById('cover-preview');
        const coverUrlEl = document.getElementById('cover-image-url');
        const selectedTemplate = document.querySelector('input[name="invite_template"]:checked');

        return {
            title: sanitizeText(document.getElementById('event-title').value),
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: sanitizeText(document.getElementById('event-location').value),
            description: sanitizeText(document.getElementById('event-description').value),
            coverImage: (coverPreviewEl && coverPreviewEl.src) || (coverUrlEl && coverUrlEl.value) || '',
            askReason: document.getElementById('ask-reason').checked,
            allowGuests: document.getElementById('allow-guests').checked,
            requiresMealChoice: document.getElementById('requires-meal-choice')?.checked || false,
            customQuestions: getCustomQuestions(),
            eventDetails: typeof getEventDetails === 'function' ? getEventDetails() : undefined,
            inviteTemplate: selectedTemplate ? selectedTemplate.value : 'envelope'
        };
    }

    /**
     * Validate event form data
     * @param {Object} eventData - Event data to validate
     * @returns {Object} Validation result
     */
    validateEventData(eventData, isUpdate = false) {
        const result = {
            valid: true,
            errors: []
        };

        if (!eventData.title || eventData.title.length < 3 || eventData.title.length > 100) {
            result.valid = false;
            result.errors.push('Please enter a valid event title (3-100 characters)');
        }

        if (!eventData.date || !eventData.time) {
            result.valid = false;
            result.errors.push('Please specify both date and time for the event');
        }

        // Check if date is not too far in the past (only for new events, not updates)
        if (!isUpdate) {
            const eventDate = new Date(`${eventData.date}T${eventData.time}`);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (eventDate < yesterday) {
                result.valid = false;
                result.errors.push('Event date cannot be more than 1 day in the past');
            }
        }

        // Location URL validation (SEC-005)
        if (eventData.location && window.validation && typeof window.validation.isLikelyURL === 'function') {
            if (window.validation.isLikelyURL(eventData.location)) {
                // Enforce https and basic domain checks
                // Using DNS check is optional due to latency
                // If invalid, block submission with clear message
                // Note: sanitized URL returned for display/storage if needed
                // We do not auto-modify the user's input here
                // to avoid surprising changes in form fields
                // The backend will also re-validate
                const checkPromise = window.validation.validateURL(eventData.location, { requireHTTPS: true, verifyDNS: false });
                // Support both async and sync environments
                if (checkPromise && typeof checkPromise.then === 'function') {
                    // This method is synchronous; signal invalid and let submit handler re-validate asynchronously
                    // Store a marker error to be replaced in submit handler when async resolves
                    // For now, perform a quick client-side protocol check
                    try {
                        const u = new URL(eventData.location.startsWith('http') ? eventData.location : `https://${eventData.location}`);
                        if (u.protocol !== 'https:') {
                            result.valid = false;
                            result.errors.push('Event location URL must use https://');
                        }
                    } catch {
                        result.valid = false;
                        result.errors.push('Please enter a valid event location URL');
                    }
                }
            }
        }

        return result;
    }

    /**
 * Assign a guest to a table
 * @param {string} eventId - Event ID
 * @param {string} rsvpId - RSVP ID
 * @param {string} tableNumberStr - The table number selected from the dropdown
 */
async assignGuestToTable(eventId, rsvpId, tableNumberStr) {
    try {
        const event = window.events ? window.events[eventId] : null;
        if (!event || !event.seatingChart) {
            const error = 'Event or seating chart not found';
            showToast(error, 'error');
            throw new Error(error);
        }

        // Check if SeatingChart class is loaded
        if (!window.SeatingChart) {
            const error = 'Seating chart module not loaded';
            showToast(error, 'error');
            throw new Error(error);
        }

        // Look up guest details from responses
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];
        const guest = eventResponses.find(r => r.rsvpId === rsvpId);

        if (!guest) {
            const error = 'Guest not found';
            showToast(error, 'error');
            throw new Error(error);
        }

        const guestName = guest.name;
        const guestCount = guest.guestCount || 0;

        // Use the table number passed directly from the dropdown
        const tableNumber = parseInt(tableNumberStr);
        if (!tableNumber) {
            showToast('Please select a table', 'warning');
            return;
        }

        // Create seating chart instance and assign
        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // *** THIS IS THE CRITICAL ASSIGNMENT CALL ***
        const result = seatingChart.assignGuestToTable(rsvpId, tableNumber, {
            name: guestName,
            guestCount: guestCount
        });
        // ********************************************

        if (result.success) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();

            // Update local state immediately
            if (window.events) {
                window.events[eventId] = event;
            }

            // Show success feedback immediately (before GitHub save)
            showToast(result.message, 'success');

            // Refresh the seating chart display immediately
            this.refreshSeatingChart(eventId);

            // Save to GitHub in background (non-blocking)
            this.saveEventSeatingDataBackground(event);
        } else {
            // Failure logging is now safe within the try block
            console.error('Assignment failed (Handled by SeatingChart logic):', result.message);
            showToast(result.message || 'Failed to assign guest: Unknown reason.', 'error');
        }
    } catch (error) {
        // *** THIS CATCHES THE INVISIBLE CRASH ***
        console.error('CRITICAL ASSIGNMENT CRASH (Function failed to execute):', error);
        showToast('A critical error occurred during assignment. Check console.', 'error');
        throw error; // Re-throw to propagate to the HTML onchange handler
    }
}
    /**
     * Unassign a guest from their table
     * @param {string} eventId - Event ID
     * @param {string} rsvpId - RSVP ID
     */
    async unassignGuest(eventId, rsvpId) {
        const event = window.events ? window.events[eventId] : null;
        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        if (seatingChart.unassignGuest(rsvpId)) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);
            showToast('Guest unassigned from table', 'success');

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast('Failed to unassign guest', 'error');
        }
    }

    /**
     * Reassign a guest to a different table
     * @param {string} eventId - Event ID
     * @param {string} rsvpId - RSVP ID
     * @param {string} newTableNumber - New table number (as string from select value)
     */
    async reassignGuestToTable(eventId, rsvpId, newTableNumber) {
        if (!newTableNumber) return; // User cancelled selection

        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];

        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        // Look up guest details
        const guest = eventResponses.find(r => r.rsvpId === rsvpId);
        if (!guest) {
            showToast('Guest not found', 'error');
            return;
        }

        const tableNumber = parseInt(newTableNumber);
        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // First unassign from current table
        seatingChart.unassignGuest(rsvpId);

        // Then assign to new table
        const result = seatingChart.assignGuestToTable(rsvpId, tableNumber, {
            name: guest.name,
            guestCount: guest.guestCount || 0
        });

        if (result.success) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);
            showToast(`Moved ${guest.name} to Table ${tableNumber}`, 'success');

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast(result.message, 'error');
            // Refresh anyway to reset the dropdown
            this.refreshSeatingChart(eventId);
        }
    }

    /**
     * Auto-assign all unassigned guests
     * @param {string} eventId - Event ID
     */
    async autoAssignSeats(eventId) {
        const event = window.events ? window.events[eventId] : null;
        const eventResponses = window.responses ? window.responses[eventId] || [] : [];

        if (!event || !event.seatingChart) {
            showToast('Event or seating chart not found', 'error');
            return;
        }

        const seatingChart = new window.SeatingChart(eventId);
        seatingChart.loadSeatingData(event);

        // Get attending guests only
        const attendingGuests = eventResponses.filter(r => r.attending === true || r.attending === 'true');

        // Sync unassigned guests first
        seatingChart.syncUnassignedGuests(attendingGuests);

        // Get unassigned guests with details
        const unassignedGuestsDetails = attendingGuests.filter(rsvp =>
            seatingChart.seatingData.unassignedGuests.includes(rsvp.rsvpId)
        );

        if (unassignedGuestsDetails.length === 0) {
            showToast('No unassigned guests to assign', 'info');
            return;
        }

        // Auto-assign
        const result = seatingChart.autoAssignGuests(unassignedGuestsDetails);

        if (result.success) {
            // Update event data
            event.seatingChart = seatingChart.exportSeatingData();
            await this.saveEventSeatingData(event);

            if (result.failed > 0) {
                showToast(`Assigned ${result.assigned} guests. ${result.failed} could not be assigned (insufficient capacity)`, 'warning');
            } else {
                showToast(`Successfully assigned ${result.assigned} guests to tables`, 'success');
            }

            // Refresh the seating chart display
            this.refreshSeatingChart(eventId);
        } else {
            showToast('Auto-assign failed', 'error');
        }
    }

    /**
     * Export seating chart as CSV
     * @param {string} eventId - Event ID
     */
    exportSeatingCSV(eventId) {
        try {
            const event = window.events ? window.events[eventId] : null;
            const eventResponses = window.responses ? window.responses[eventId] || [] : [];

            if (!event || !event.seatingChart) {
                showToast('Event or seating chart not found', 'error');
                return;
            }

            if (!window.SeatingChart) {
                showToast('Seating chart module not loaded', 'error');
                return;
            }

            const seatingChart = new window.SeatingChart(eventId);
            seatingChart.loadSeatingData(event);

            if (typeof seatingChart.generateSeatingCSV !== 'function') {
                showToast('Export function not available', 'error');
                return;
            }

            const csv = seatingChart.generateSeatingCSV(eventResponses);

            // Check if CSV contains actual data (more than just header)
            if (!csv || csv.split('\n').filter(line => line.trim()).length <= 1) {
                showToast('No seating data to export', 'warning');
                return;
            }

            // Download CSV (compatible with Excel) - BOM for better compatibility
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `seating-chart-${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);

            showToast('Seating chart exported successfully', 'success');
        } catch (error) {
            console.error('Export seating chart error:', error);
            showToast('Failed to export seating chart', 'error');
        }
    }

    /**
     * Refresh seating chart display
     * @param {string} eventId - Event ID
     */
    refreshSeatingChart(eventId) {
        // Simply reload the event management view
        this.showEventManagement(eventId);
    }

    /**
     * Toggle select all checkboxes
     * @param {string} eventId - Event ID
     */
    toggleSelectAll(eventId) {
        const selectAllCheckbox = document.getElementById(`select-all-${eventId}`);
        const checkboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox`);

        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });

        this.updateBulkActions(eventId);
    }

    /**
     * Update bulk actions visibility and count
     * @param {string} eventId - Event ID
     */
    updateBulkActions(eventId) {
        const checkboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox:checked`);
        const selectedCount = checkboxes.length;
        const bulkActionsDiv = document.getElementById(`bulk-actions-${eventId}`);
        const countSpan = document.getElementById(`selected-count-${eventId}`);

        if (selectedCount > 0) {
            bulkActionsDiv.style.display = 'block';
            countSpan.textContent = selectedCount;
        } else {
            bulkActionsDiv.style.display = 'none';
        }

        // Update select-all checkbox state
        const allCheckboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox`);
        const selectAllCheckbox = document.getElementById(`select-all-${eventId}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = selectedCount === allCheckboxes.length && selectedCount > 0;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < allCheckboxes.length;
        }
    }

    /**
     * Export selected responses to CSV
     * @param {string} eventId - Event ID
     */
    bulkExportSelected(eventId) {
        const event = window.events[eventId];
        const allResponses = window.responses[eventId] || [];
        const checkboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox:checked`);

        if (checkboxes.length === 0) {
            showToast('No responses selected', 'error');
            return;
        }

        // Get selected response indices
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.responseIndex));
        const selectedResponses = allResponses.filter((r, idx) => selectedIndices.includes(idx));

        // Use existing CSV creation function
        const csvContent = createCSVContent(event, selectedResponses);
        const filename = `${generateSafeFilename(event.title)}_selected_rsvps.csv`;

        downloadFile(csvContent, filename, 'text/csv');
        showToast(`Exported ${selectedResponses.length} responses`, 'success');
    }

    /**
     * Email selected attendees
     * @param {string} eventId - Event ID
     */
    bulkEmailSelected(eventId) {
        const checkboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox:checked`);

        if (checkboxes.length === 0) {
            showToast('No responses selected', 'error');
            return;
        }

        // Get email addresses from responses array using indices (avoid DOM-stored data)
        const allResponses = window.responses[eventId] || [];
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.responseIndex, 10));
        const emails = selectedIndices
            .map(index => allResponses[index]?.email)
            .filter(email => email && email !== 'N/A');

        if (emails.length === 0) {
            showToast('No valid email addresses in selection', 'error');
            return;
        }

        // Open default email client with BCC list
        const subject = encodeURIComponent(`Event Update: ${window.events[eventId].title}`);
        const mailtoLink = `mailto:?bcc=${emails.join(',')}&subject=${subject}`;

        // Check URL length - most email clients have limitations (safe threshold: 2000 chars)
        const MAX_MAILTO_LENGTH = 2000;
        if (mailtoLink.length > MAX_MAILTO_LENGTH) {
            // Fallback: Display emails in a modal for manual copy
            this.showEmailListModal(emails);
            showToast(`Too many recipients for mailto link. Showing list instead.`, 'warning');
        } else {
            window.location.href = mailtoLink;
            showToast(`Opening email client for ${emails.length} recipients`, 'success');
        }
    }

    /**
     * Show modal with email list for copying
     * @param {Array<string>} emails - Email addresses to display
     */
    showEmailListModal(emails) {
        const emailList = emails.join('\n');

        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'bulk-email-modal-overlay';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'bulk-email-modal-content';

        // Create title
        const title = document.createElement('h3');
        title.className = 'bulk-email-modal-title';
        title.textContent = 'Too Many Recipients for Mailto Link';

        // Create description
        const description = document.createElement('p');
        description.textContent = 'The email list is too large for a mailto: link. Please copy the email addresses below:';

        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'bulk-email-modal-textarea';
        textarea.readOnly = true;
        textarea.value = emailList;

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'bulk-email-modal-buttons';

        // Create copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'btn';
        copyButton.textContent = 'Copy to Clipboard';
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(emailList);
                showToast('Copied to clipboard', 'success');
            } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                showToast('Failed to copy to clipboard', 'error');
            }
        });

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.className = 'btn btn-danger';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', () => {
            modal.remove();
        });

        // Assemble modal
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);
        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(textarea);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);

        // Add to page
        document.body.appendChild(modal);

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Delete selected responses
     * Uses PESSIMISTIC approach: server confirmation BEFORE local state update
     * @param {string} eventId - Event ID
     */
    async bulkDeleteSelected(eventId) {
        const checkboxes = document.querySelectorAll(`#response-table-body-${eventId} .response-checkbox:checked`);

        if (checkboxes.length === 0) {
            showToast('No responses selected', 'error');
            return;
        }

        const count = checkboxes.length;
        const confirmed = confirm(`Are you sure you want to delete ${count} selected response${count > 1 ? 's' : ''}? This action cannot be undone.`);

        if (!confirmed) return;

        try {
            // Get selected response indices (sort in descending order to delete from end)
            const selectedIndices = Array.from(checkboxes)
                .map(cb => parseInt(cb.dataset.responseIndex))
                .sort((a, b) => b - a);

            // PESSIMISTIC: Create a copy and prepare new array without modifying original yet
            const originalResponses = window.responses[eventId] || [];
            const updatedResponses = [...originalResponses];

            // Delete from end to beginning to maintain correct indices
            for (const index of selectedIndices) {
                updatedResponses.splice(index, 1);
            }

            // PESSIMISTIC: Save to server FIRST, before updating local state
            if (window.githubAPI) {
                await window.githubAPI.saveResponses(eventId, updatedResponses);
            }

            // Only update local storage AFTER server success
            window.responses[eventId] = updatedResponses;

            showToast(`Deleted ${count} response${count > 1 ? 's' : ''}`, 'success');

            // Refresh the view
            this.showEventManagement(eventId);

        } catch (error) {
            console.error('Bulk delete failed:', error);
            showToast('Failed to delete responses', 'error');
        }
    }

    /**
     * Save event seating data to GitHub
     * @param {Object} event - Event object with updated seating data
     */
    async saveEventSeatingData(event) {
        try {
            if (window.BackendAPI) {
                await window.BackendAPI.updateEvent(event.id, {
                    title: event.title,
                    description: event.description,
                    date: event.date,
                    time: event.time,
                    location: event.location,
                    coverImageUrl: event.coverImage,
                    status: event.status
                });
            }
            // Always update local state so UI refresh uses latest seating data
            if (window.events) {
                window.events[event.id] = event;
            }
        } catch (error) {
            console.error('Failed to save seating data:', error);
            showToast('Failed to save seating data', 'error');
        }
    }

    /**
     * Save event seating data to GitHub in background (non-blocking)
     * Used for immediate UI updates while persisting data asynchronously
     * @param {Object} event - Event object with updated seating data
     */
    saveEventSeatingDataBackground(event) {
        // Fire and forget - don't await, don't block UI
        if (window.githubAPI) {
            window.githubAPI.saveEvent(event).catch(error => {
                console.error('Background save failed:', error);
                // Don't show toast for background saves to avoid interrupting user
            });
        }
    }

    // ----- Photo Gallery Methods -----

    async renderPhotoGallery(eventId) {
        const grid = document.getElementById(`photo-gallery-grid-${eventId}`);
        if (!grid) return;

        try {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem;">Loading photos...</div>';
            
            if (!window.BackendAPI || !window.BackendAPI.getEventPhotos) {
                throw new Error('Backend API not available');
            }

            const result = await window.BackendAPI.getEventPhotos(eventId);
            const photos = result.photos || [];

            if (photos.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem;">No photos uploaded yet. Be the first to share!</div>';
                return;
            }

            grid.innerHTML = photos.map(photo => `
                <div class="photo-card">
                    <img src="${window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(photo.url) : photo.url}" alt="Event photo" class="photo-card-img" loading="lazy">
                    <div class="photo-card-overlay">
                        <button class="btn-delete-photo" onclick="window.eventManager.deletePhoto('${photo.id}', '${eventId}')" title="Delete photo">
                            
                        </button>
                    </div>
                    ${photo.caption ? `<div class="photo-card-caption">${window.utils && window.utils.escapeHTML ? window.utils.escapeHTML(photo.caption) : photo.caption}</div>` : ''}
                </div>
            `).join('');

        } catch (error) {
            console.error('Failed to load photos:', error);
            const safeMessage = window.utils && window.utils.escapeHTML
                ? window.utils.escapeHTML(error.message)
                : String(error.message).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Failed to load photos: ${safeMessage}</div>`;
        }
    }

    async handlePhotoUpload(event, eventId) {
        const fileInput = event.target;
        const file = fileInput.files[0];
        if (!file) return;

        const uploadArea = document.getElementById(`photo-gallery-upload-${eventId}`);
        
        try {
            // Show loading state
            if (uploadArea) {
                uploadArea.classList.add('loading');
                const originalContent = uploadArea.innerHTML;
                uploadArea.innerHTML = '<div style="color: #e2e8f0; font-weight: 500;">Uploading... <span class="spinner"></span></div>';
            }

            if (!window.BackendAPI || !window.BackendAPI.uploadImage) {
                throw new Error('Backend API not available');
            }

            await window.BackendAPI.uploadImage(file, file.name, {
                eventId: eventId,
                caption: '' // Could add a prompt for caption later
            });

            showToast('Photo uploaded successfully!', 'success');
            
            // Refresh gallery
            this.renderPhotoGallery(eventId);

        } catch (error) {
            console.error('Photo upload failed:', error);
            showToast('Upload failed: ' + error.message, 'error');
        } finally {
            // Reset upload area
            if (uploadArea) {
                uploadArea.classList.remove('loading');
                uploadArea.innerHTML = `
                    <input type="file" id="gallery-upload-input-${eventId}" accept="image/*" style="display:none" onchange="window.eventManager.handlePhotoUpload(event, '${eventId}')">
                    <span class="photo-upload-icon"></span>
                    <div class="photo-upload-text">Click or drag photos here to upload</div>
                    <div class="photo-upload-subtext">Supports JPG, PNG, GIF, WEBP</div>
                `;
            }
            // Clear input
            fileInput.value = '';
        }
    }

    async deletePhoto(photoId, eventId) {
        if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) return;

        try {
            if (!window.BackendAPI || !window.BackendAPI.deletePhoto) {
                throw new Error('Backend API not available');
            }

            await window.BackendAPI.deletePhoto(photoId);
            showToast('Photo deleted', 'success');
            
            // Refresh gallery
            this.renderPhotoGallery(eventId);

        } catch (error) {
            console.error('Delete photo failed:', error);
            showToast('Delete failed: ' + error.message, 'error');
        }
    }
}

// Create global instance
const eventManager = new EventManager();

// Make functions available globally for HTML onclick handlers
window.eventManager = eventManager;

// ================================================
// EVENT DELEGATION: Seating Chart Table Assignment
// ================================================
// This listener handles all table assignment dropdowns via event delegation,
// eliminating inline onchange handlers that were causing silent failures
// due to unescaped characters in event/RSVP IDs.
document.addEventListener('change', async function(event) {
    // Check if the changed element is a table assignment dropdown
    if (event.target.matches('[data-action="assign-table"]')) {
        const target = event.target;

        // Extract data from HTML5 data attributes (safe from escaping issues)
        const eventId = target.dataset.eventId;
        const rsvpId = target.dataset.rsvpId;
        const tableNumberStr = target.value;

        // Validate that a table was actually selected
        if (!tableNumberStr) {
            return; // User selected the placeholder option, do nothing
        }

        try {
            // Call the assignment function with proper error handling
            await eventManager.assignGuestToTable(eventId, rsvpId, tableNumberStr);

            // Success toast is shown inside assignGuestToTable
            // The UI will refresh via refreshSeatingChart() call in that method

        } catch (error) {
            // Handle any errors that weren't caught inside assignGuestToTable
            console.error('Assignment error (caught by event delegation):', error);
            showToast('Failed to assign guest', 'error');

            // Reset the dropdown to prevent confusion
            target.value = '';
        }
    }

    // ================================================
    // EVENT DELEGATION: Guest List Filters
    // ================================================
    // Handle filter dropdown changes
    if (event.target.matches('[data-filter-action="filter-attendees"]')) {
        if (eventManager && typeof eventManager.filterAttendees === 'function') {
            eventManager.filterAttendees();
        }
    }
});

// ================================================
// EVENT DELEGATION: Guest List Search
// ================================================
// Handle search input changes
document.addEventListener('input', function(event) {
    if (event.target.matches('[data-filter-action="search-attendees"]')) {
        if (eventManager && typeof eventManager.filterAttendees === 'function') {
            eventManager.filterAttendees();
        }
    }
});

// ================================================
// EVENT DELEGATION: Email Attendee Button
// ================================================
// Handle email button clicks in attendee cards
document.addEventListener('click', function(event) {
    if (event.target.matches('[data-action="email-attendee"]') ||
        event.target.closest('[data-action="email-attendee"]')) {

        const button = event.target.matches('[data-action="email-attendee"]')
            ? event.target
            : event.target.closest('[data-action="email-attendee"]');

        // Skip if button is disabled
        if (button.disabled) {
            return;
        }

        const rsvpId = button.dataset.rsvpId;
        const eventId = button.dataset.eventId;

        if (eventManager && typeof eventManager.openEmailDialog === 'function' && rsvpId && eventId) {
            eventManager.openEmailDialog(rsvpId, eventId);
        } else {
            console.error('Email functionality not available or missing data');
            showToast('Unable to open email', 'error');
        }
    }

    // ================================================
    // EVENT DELEGATION: Seating Chart Action Buttons
    // ================================================
    // Handle auto-assign, export, and refresh buttons
    const actionButton = event.target.closest('[data-action^="auto-assign-"], [data-action^="export-seating"], [data-action^="refresh-seating"]');

    if (actionButton) {
        const action = actionButton.dataset.action;
        const eventId = actionButton.dataset.eventId;

        if (!eventManager || !eventId) {
            console.error('EventManager or eventId not available');
            return;
        }

        switch (action) {
            case 'auto-assign-seats':
                if (typeof eventManager.autoAssignSeats === 'function') {
                    eventManager.autoAssignSeats(eventId).catch(err => {
                        console.error('Auto-assign error:', err);
                        showToast('Auto-assign failed', 'error');
                    });
                }
                break;

            case 'export-seating':
                if (typeof eventManager.exportSeatingCSV === 'function') {
                    eventManager.exportSeatingCSV(eventId);
                }
                break;

            case 'refresh-seating':
                if (typeof eventManager.refreshSeatingChart === 'function') {
                    eventManager.refreshSeatingChart(eventId);
                }
                break;
        }
    }
});
