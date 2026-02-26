/**
 * EventCall Admin Dashboard
 * Admin-only analytics and system management
 */

(function() {
    'use strict';

    const AdminDashboard = {
        /**
         * Store chart instances to prevent memory leaks on refresh
         */
        _charts: {
            events: null,
            rsvps: null
        },

        /**
         * User table state management
         */
        _tableState: {
            currentPage: 1,
            pageSize: 10,
            sortColumn: 'username',
            sortDirection: 'asc',
            filters: {
                search: '',
                role: 'all',
                branch: 'all'
            }
        },

        /**
         * Date range filter for statistics
         */
        _dateRange: 6, // months

        /**
         * Escape HTML to prevent XSS attacks
         * @param {string} str - String to escape
         * @returns {string} - Escaped string safe for HTML insertion
         */
        _escapeHtml(str) {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = String(str);
            return div.innerHTML;
        },

        /**
         * Destroy existing chart instances to prevent memory leaks
         */
        _destroyCharts() {
            if (this._charts.events) {
                this._charts.events.destroy();
                this._charts.events = null;
            }
            if (this._charts.rsvps) {
                this._charts.rsvps.destroy();
                this._charts.rsvps = null;
            }
        },

        _getAdminApiUrl(path) {
            const cfg = window.BACKEND_CONFIG || {};
            const base = String(cfg.dispatchURL || '').replace(/\/$/, '');
            if (!base) {
                console.error('Proxy dispatchURL not configured');
                return path; // Fallback to relative path
            }
            return `${base}${path}`;
        },
        /**
         * Initialize admin dashboard
         */
        init() {
            console.log('📊 Admin Dashboard module loaded');
            document.addEventListener('click', (event) => {
                const target = event.target;
                const action = target.dataset.action;
                if (action === 'close-edit-user-modal') {
                    this.closeEditUserModal();
                } else if (action === 'save-user-changes') {
                    this.saveUserChanges();
                } else if (action === 'close-confirm-modal') {
                    this.closeConfirmModal();
                } else if (action === 'confirm-action') {
                    this.executeConfirmedAction();
                } else if (target.closest('[data-action="edit-user"]')) {
                    const username = target.closest('tr').dataset.username;
                    this.editUser(username);
                } else if (target.closest('[data-action="delete-user"]')) {
                    const username = target.closest('tr').dataset.username;
                    this.showDeleteConfirmation(username);
                } else if (target.closest('.sortable-header')) {
                    const column = target.closest('.sortable-header').dataset.column;
                    this.sortByColumn(column);
                }
            });
        },

        /**
         * Check if current user is admin
         */
        isAdmin() {
            const user = window.userAuth?.currentUser;
            return user && user.role === 'admin';
        },

        /**
         * PHASE 3: DRY helper to ensure Chart.js is loaded
         * Extracts duplicated logic from renderEventsChart and renderRsvpsChart
         * @param {HTMLElement} canvasCtx - Canvas context element for error display
         * @returns {Promise<boolean>} - True if loaded successfully, false otherwise
         */
        async _ensureChartJsLoaded(canvasCtx) {
            if (window.Chart) return true;

            try {
                await window.LazyLoader.loadChartJS();
                if (!window.Chart) {
                    throw new Error('Chart.js script loaded but `window.Chart` is not available.');
                }
                return true;
            } catch (error) {
                console.error('Failed to load Chart.js:', error);
                if (canvasCtx) {
                    canvasCtx.innerHTML = '<p style="color: #ef4444;">Failed to load charts library</p>';
                }
                return false;
            }
        },

        /**
         * Load and render admin dashboard
         */
        async loadDashboard() {
            console.log('📊 Loading admin dashboard...');
            const content = document.getElementById('admin-dashboard-content');
            let skeletonCtl = null;

            if (content) {
                // Use unified skeleton loader if available
                if (window.LoadingUI && window.LoadingUI.Skeleton) {
                    skeletonCtl = window.LoadingUI.Skeleton.show(content, 'cards', 4);
                } else {
                    content.innerHTML = '<div class="loading-inline"><span class="spinner"></span> Loading admin data...</div>';
                }
            }

            if (!this.isAdmin()) {
                console.error('❌ Access denied - user is not admin');
                if (content) {
                    content.innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: var(--semper-red);">
                            <h2>❌ Access Denied</h2>
                            <p>You do not have permission to view this page.</p>
                            <button class="btn btn-primary" onclick="showPage('dashboard')">Return to Dashboard</button>
                        </div>
                    `;
                }
                return;
            }

            try {
                // Fetch all data
                const [adminData, users] = await Promise.all([
                    this.fetchAdminData(),
                    this.fetchAllUsers()
                ]);

                const { events, rsvps } = adminData;

                // Compute KPIs
                const kpis = this.computeKPIs(events, users, rsvps);

                // Render dashboard
                this.renderDashboard(kpis, events, users, rsvps);

                console.log('✅ Admin dashboard loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load admin dashboard:', error);
                this.showError(error.message);
            }
        },

        async fetchAdminData() {
            try {
                const currentUser = window.userAuth?.currentUser;
                if (!currentUser) {
                    throw new Error("No authenticated user found");
                }
                const url = this._getAdminApiUrl('/api/admin/dashboard-data');
                const response = await fetch(url, {
                    headers: {
                        'x-username': currentUser.username
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch admin data: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching admin data:', error);
                return { events: [], rsvps: [] };
            }
        },

        /**
         * Fetch all users from EventCall-Data
         */
        async fetchAllUsers() {
            try {
                const currentUser = window.userAuth?.currentUser;
                if (!currentUser) {
                    throw new Error("No authenticated user found");
                }
                const url = this._getAdminApiUrl('/api/admin/users');
                const response = await fetch(url, {
                    headers: {
                        'x-username': currentUser.username
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch users: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('Error fetching all users:', error);
                return []; // Return an empty array on error
            }
        },

        /**
         * Compute KPIs from data
         */
        computeKPIs(events, users, rsvps) {
            const now = new Date();
            const activeEvents = events.filter(e => new Date(e.datetime) >= now);
            const totalRsvps = rsvps.length;
            // Match the actual field names: attending is boolean or string 'true'/'false'
            const attendingRsvps = rsvps.filter(r => r.attending === true || r.attending === 'true').length;
            const engagementRate = totalRsvps > 0 ? Math.round((attendingRsvps / totalRsvps) * 100) : 0;

            return {
                totalEvents: events.length,
                activeEvents: activeEvents.length,
                totalUsers: users.length,
                totalRsvps,
                attendingRsvps,
                engagementRate
            };
        },

        /**
         * Render admin dashboard
         */
        renderDashboard(kpis, events, users, rsvps) {
            const content = document.getElementById('admin-dashboard-content');
            if (!content) return;

            content.innerHTML = `
                <!-- Admin Header -->
                <div class="admin-header">
                    <div class="admin-title">
                        👑 EventCall Admin Control Panel
                        <span class="admin-badge">Admin</span>
                    </div>
                    <button class="btn btn-primary" onclick="AdminDashboard.refresh()">
                        🔄 Refresh Data
                    </button>
                </div>

                <!-- Admin Tabs -->
                <div class="dashboard-tabs" style="margin-bottom: 2rem;">
                    <button type="button" class="dashboard-tab dashboard-tab--active" data-tab="statistics" onclick="AdminDashboard.switchTab('statistics')">
                        📊 App Statistics
                    </button>
                    <button type="button" class="dashboard-tab" data-tab="users" onclick="AdminDashboard.switchTab('users')">
                        👥 User Management
                    </button>
                </div>

                <!-- Statistics Tab Content -->
                <div id="admin-statistics-tab" class="admin-tab-content admin-tab-content--active">
                    <!-- KPI Cards -->
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <span class="kpi-icon">👥</span>
                            <div class="kpi-label">Total Users</div>
                            <div class="kpi-value">${kpis.totalUsers}</div>
                            <div class="kpi-trend trend-neutral">
                                Registered accounts
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">📅</span>
                            <div class="kpi-label">Total Events</div>
                            <div class="kpi-value">${kpis.totalEvents}</div>
                            <div class="kpi-trend trend-neutral">
                                ${kpis.activeEvents} active events
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">✉️</span>
                            <div class="kpi-label">Total RSVPs</div>
                            <div class="kpi-value">${kpis.totalRsvps}</div>
                            <div class="kpi-trend trend-up">
                                ${kpis.attendingRsvps} attending
                            </div>
                        </div>

                        <div class="kpi-card">
                            <span class="kpi-icon">📊</span>
                            <div class="kpi-label">Engagement Rate</div>
                            <div class="kpi-value">${kpis.engagementRate}%</div>
                            <div class="kpi-trend trend-${kpis.engagementRate >= 70 ? 'up' : 'neutral'}">
                                RSVP response rate
                            </div>
                        </div>
                    </div>

                    <!-- Charts -->
                    <div class="chart-grid">
                        <div class="chart-card">
                            <div class="chart-header">
                                <div class="chart-title">Event Activity</div>
                                <select id="date-range-filter" class="filter-select" onchange="AdminDashboard.changeDateRange(this.value)">
                                    <option value="3">Last 3 Months</option>
                                    <option value="6" selected>Last 6 Months</option>
                                    <option value="12">Last 12 Months</option>
                                    <option value="24">Last 2 Years</option>
                                </select>
                            </div>
                            <div class="chart-container">
                                <canvas id="adminEventsChart"></canvas>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-header">
                                <div class="chart-title">RSVP Status Distribution</div>
                                <button class="btn btn-sm btn-secondary" onclick="AdminDashboard.exportStatsCSV()">📥 Export</button>
                            </div>
                            <div class="chart-container">
                                <canvas id="adminRsvpsChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- App Usage Stats -->
                    <div class="admin-table usage-summary">
                        <div class="chart-title">📈 App Usage Summary</div>
                        <div class="usage-stats-grid">
                            <div class="usage-stat-card usage-stat-card--gold">
                                <div class="usage-stat-label">Events per User</div>
                                <div class="usage-stat-value usage-stat-value--gold">
                                    ${kpis.totalUsers > 0 ? (kpis.totalEvents / kpis.totalUsers).toFixed(1) : 0}
                                </div>
                            </div>
                            <div class="usage-stat-card usage-stat-card--green">
                                <div class="usage-stat-label">RSVPs per Event</div>
                                <div class="usage-stat-value usage-stat-value--green">
                                    ${kpis.totalEvents > 0 ? (kpis.totalRsvps / kpis.totalEvents).toFixed(1) : 0}
                                </div>
                            </div>
                            <div class="usage-stat-card usage-stat-card--blue">
                                <div class="usage-stat-label">Active Event Rate</div>
                                <div class="usage-stat-value usage-stat-value--blue">
                                    ${kpis.totalEvents > 0 ? Math.round((kpis.activeEvents / kpis.totalEvents) * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- User Management Tab Content -->
                <div id="admin-users-tab" class="admin-tab-content">
                    <div class="admin-table">
                        <div class="user-management-header">
                            <div class="chart-title" id="user-count-title">👥 User Accounts (${users.length} total)</div>
                            <div class="user-actions-row">
                                <button class="btn btn-secondary" onclick="AdminDashboard.exportUsersCSV()">
                                    📥 Export CSV
                                </button>
                            </div>
                        </div>

                        <!-- Filters Row -->
                        <div class="filters-row">
                            <input type="text" id="user-search" class="user-search-input" placeholder="🔍 Search users..." oninput="AdminDashboard.applyFilters()">
                            <select id="role-filter" class="filter-select" onchange="AdminDashboard.applyFilters()">
                                <option value="all">All Roles</option>
                                <option value="admin">Admins Only</option>
                                <option value="user">Users Only</option>
                            </select>
                            <select id="branch-filter" class="filter-select" onchange="AdminDashboard.applyFilters()">
                                <option value="all">All Branches</option>
                                ${this.getBranchOptions(users)}
                            </select>
                            <select id="page-size" class="filter-select" onchange="AdminDashboard.changePageSize(this.value)">
                                <option value="10">10 per page</option>
                                <option value="25">25 per page</option>
                                <option value="50">50 per page</option>
                                <option value="100">100 per page</option>
                            </select>
                        </div>

                        <div class="table-wrapper">
                            <table id="users-table">
                                <thead>
                                    <tr>
                                        <th class="sortable-header" data-column="username">Username ${this.getSortIcon('username')}</th>
                                        <th class="sortable-header" data-column="name">Name ${this.getSortIcon('name')}</th>
                                        <th class="sortable-header" data-column="email">Email ${this.getSortIcon('email')}</th>
                                        <th class="sortable-header" data-column="branch">Branch ${this.getSortIcon('branch')}</th>
                                        <th class="sortable-header" data-column="rank">Rank ${this.getSortIcon('rank')}</th>
                                        <th class="sortable-header" data-column="role">Role ${this.getSortIcon('role')}</th>
                                        <th class="sortable-header" data-column="eventCount">Events ${this.getSortIcon('eventCount')}</th>
                                        <th class="sortable-header" data-column="lastActive">Last Active ${this.getSortIcon('lastActive')}</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="users-table-body">
                                    ${this.renderUsersTableRows(users, events)}
                                </tbody>
                            </table>
                        </div>

                        <!-- Pagination -->
                        <div class="pagination-container" id="pagination-container">
                            ${this.renderPagination()}
                        </div>
                    </div>
                </div>

                <!-- Confirmation Modal -->
                <div id="confirm-modal" class="modal" style="display: none;">
                    <div class="modal-content confirm-modal-content">
                        <div class="confirm-modal-icon">⚠️</div>
                        <h3 id="confirm-modal-title">Confirm Action</h3>
                        <p id="confirm-modal-message">Are you sure you want to proceed?</p>
                        <div class="confirm-modal-actions">
                            <button class="btn btn-secondary" data-action="close-confirm-modal">Cancel</button>
                            <button class="btn btn-danger" data-action="confirm-action" id="confirm-action-btn">Delete</button>
                        </div>
                    </div>
                </div>

                <!-- Edit User Modal -->
                <div id="edit-user-modal" class="modal" style="display: none;">
                    <div class="modal-content edit-user-modal-content">
                        <div class="edit-user-header">
                            <h3>✏️ Edit User</h3>
                            <button class="modal-close-btn" data-action="close-edit-user-modal">&times;</button>
                        </div>
                        <form id="edit-user-form" class="edit-user-form">
                            <div class="form-group">
                                <label for="edit-user-username">Username</label>
                                <input type="text" id="edit-user-username" readonly>
                            </div>
                            <div class="form-group">
                                <label for="edit-user-name">Name</label>
                                <input type="text" id="edit-user-name" required>
                            </div>
                            <div class="form-group">
                                <label for="edit-user-email">Email</label>
                                <input type="email" id="edit-user-email" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="edit-user-role">Role</label>
                                    <select id="edit-user-role">
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="edit-user-status">Status</label>
                                    <select id="edit-user-status">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" data-action="close-edit-user-modal">Cancel</button>
                                <button type="button" class="btn btn-primary" data-action="save-user-changes">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            // Render charts after DOM is ready using requestAnimationFrame for reliability
            requestAnimationFrame(() => {
                this.renderCharts(events, rsvps);
            });
        },

        /**
         * Render users table rows
         */
        renderUsersTableRows(users, events) {
            if (users.length === 0) {
                return '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No users found</td></tr>';
            }

            // Store for filtering
            this.allUsers = users;
            this.allEvents = events;

            return users.map(user => {
                // Count events created by this user
                // Check multiple field names for compatibility (snake_case from Supabase, camelCase from GitHub)
                const userEvents = events.filter(e => {
                    const userId = String(user.id || '').toLowerCase();
                    const username = (user.username || '').toLowerCase();

                    // Event creator fields (various formats)
                    const createdById = String(e.created_by || e.createdBy || '').toLowerCase();
                    const createdByUsername = (e.createdByUsername || e.created_by_username || '').toLowerCase();

                    // Match by user ID or username
                    return (userId && createdById === userId) ||
                           (username && (createdById === username || createdByUsername === username));
                });

                const eventCount = userEvents.length;
                // Check multiple field names for last login (snake_case and camelCase)
                const lastLoginDate = user.last_login || user.lastLogin || user.lastActive || user.last_active;
                const lastActive = lastLoginDate
                    ? new Date(lastLoginDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'Never';
                const roleBadge = user.role === 'admin'
                    ? '<span class="role-badge role-badge--admin">ADMIN</span>'
                    : '<span class="role-badge role-badge--user">USER</span>';

                // Escape user data to prevent XSS
                const safeUsername = this._escapeHtml(user.username) || 'N/A';
                const safeName = this._escapeHtml(user.name) || 'N/A';
                const safeEmail = this._escapeHtml(user.email) || 'N/A';
                const safeBranch = this._escapeHtml(user.branch) || 'N/A';
                const safeRank = this._escapeHtml(user.rank) || 'N/A';

                return `
                    <tr data-username="${this._escapeHtml(user.username?.toLowerCase())}" data-name="${this._escapeHtml(user.name?.toLowerCase())}" data-email="${this._escapeHtml(user.email?.toLowerCase())}">
                        <td><strong>${safeUsername}</strong></td>
                        <td>${safeName}</td>
                        <td>${safeEmail}</td>
                        <td>${safeBranch}</td>
                        <td>${safeRank}</td>
                        <td>${roleBadge}</td>
                        <td style="text-align: center;">${eventCount}</td>
                        <td>${lastActive}</td>
                        <td>
                            <button class="btn btn-sm" data-action="edit-user">Edit</button>
                            <button class="btn btn-sm btn-danger" data-action="delete-user">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        editUser(username) {
            const user = this.allUsers.find(u => u.username === username);
            if (!user) return;

            document.getElementById('edit-user-username').value = user.username;
            document.getElementById('edit-user-name').value = user.name || '';
            document.getElementById('edit-user-email').value = user.email || '';
            document.getElementById('edit-user-role').value = user.role || 'user';
            document.getElementById('edit-user-status').value = user.status || 'active';
            // Use flex display to maintain centering
            document.getElementById('edit-user-modal').style.display = 'flex';
        },

        closeEditUserModal() {
            document.getElementById('edit-user-modal').style.display = 'none';
        },

        async saveUserChanges() {
            const username = document.getElementById('edit-user-username').value;
            const name = document.getElementById('edit-user-name').value;
            const email = document.getElementById('edit-user-email').value;
            const role = document.getElementById('edit-user-role').value;
            const status = document.getElementById('edit-user-status').value;

            const currentUser = window.userAuth?.currentUser;
            if (!currentUser) {
                window.showToast('Authentication required', 'error');
                return;
            }

            const url = this._getAdminApiUrl(`/api/admin/users/${encodeURIComponent(username)}`);
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-username': currentUser.username
                },
                body: JSON.stringify({ name, email, role, status })
            });

            if (response.ok) {
                this.closeEditUserModal();
                this.refresh();
                window.showToast('User updated successfully', 'success');
            } else {
                window.showToast('Failed to save user changes.', 'error');
            }
        },

        /**
         * @deprecated Use showDeleteConfirmation instead for styled modal
         */
        async deleteUser(username) {
            // Redirect to styled confirmation modal
            this.showDeleteConfirmation(username);
        },

        /**
         * Switch between admin tabs
         */
        switchTab(tab) {
            console.log('🔄 Switching admin tab to:', tab);

            // Update tab buttons
            const tabs = document.querySelectorAll('.dashboard-tab');
            tabs.forEach(btn => {
                const isActive = btn.getAttribute('data-tab') === tab;
                btn.classList.toggle('dashboard-tab--active', isActive);
            });

            // Update tab content
            const statisticsTab = document.getElementById('admin-statistics-tab');
            const usersTab = document.getElementById('admin-users-tab');

            if (tab === 'statistics') {
                if (statisticsTab) statisticsTab.classList.add('admin-tab-content--active');
                if (usersTab) usersTab.classList.remove('admin-tab-content--active');
            } else if (tab === 'users') {
                if (statisticsTab) statisticsTab.classList.remove('admin-tab-content--active');
                if (usersTab) usersTab.classList.add('admin-tab-content--active');
            }
        },

        /**
         * Filter users table based on search query
         */
        filterUsers(query) {
            const searchQuery = query.toLowerCase().trim();
            const rows = document.querySelectorAll('#users-table tbody tr');

            rows.forEach(row => {
                const username = row.getAttribute('data-username') || '';
                const name = row.getAttribute('data-name') || '';
                const email = row.getAttribute('data-email') || '';

                const matches = username.includes(searchQuery) ||
                               name.includes(searchQuery) ||
                               email.includes(searchQuery);

                row.style.display = matches ? '' : 'none';
            });

            // Update count
            const visibleCount = Array.from(rows).filter(row => row.style.display !== 'none').length;
            const title = document.querySelector('#admin-users-tab .chart-title');
            if (title) {
                title.textContent = `👥 User Accounts (${visibleCount} ${searchQuery ? 'matching' : 'total'})`;
            }
        },

        /**
         * Render charts
         */
        renderCharts(events, rsvps) {
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded');
                return;
            }

            // Destroy existing charts to prevent memory leaks
            this._destroyCharts();

            // Configure Chart.js defaults
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

            // Events Chart
            this.renderEventsChart(events);

            // RSVPs Chart
            this.renderRsvpsChart(rsvps);
        },

        /**
         * Render events chart (PHASE 3: Lazy loads Chart.js)
         */
        async renderEventsChart(events) {
            const ctx = document.getElementById('adminEventsChart');
            if (!ctx) return;

            // Store events for later use (export, date range changes)
            this.allEvents = events;

            // PHASE 3: Use DRY helper to load Chart.js
            if (!await this._ensureChartJsLoaded(ctx)) return;

            // Destroy existing chart if re-rendering
            if (this._charts.events) {
                this._charts.events.destroy();
                this._charts.events = null;
            }

            // Group events by month
            // Check multiple field names for compatibility (snake_case from Supabase, camelCase from GitHub)
            const eventsByMonth = {};
            events.forEach(event => {
                // Try various date field formats
                const dateStr = event.datetime || event.date_time || event.date || event.created_at;
                if (!dateStr) return;

                // Parse date - handle both "2024-01-15" and "2024-01-15T10:00:00" formats
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return; // Skip invalid dates

                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                eventsByMonth[monthKey] = (eventsByMonth[monthKey] || 0) + 1;
            });

            // Apply date range filter
            const labels = Object.keys(eventsByMonth).sort().slice(-this._dateRange);
            const data = labels.map(key => eventsByMonth[key]);

            // Store chart instance to allow cleanup on refresh
            this._charts.events = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.map(l => {
                        const [year, month] = l.split('-');
                        return new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                    }),
                    datasets: [{
                        label: 'Events Created',
                        data: data,
                        borderColor: '#d4af37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 },
                            grid: { color: 'rgba(255, 255, 255, 0.05)' }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        },

        /**
         * Render RSVPs chart (PHASE 3: Lazy loads Chart.js)
         */
        async renderRsvpsChart(rsvps) {
            const ctx = document.getElementById('adminRsvpsChart');
            if (!ctx) return;

            // Store rsvps for later use (export)
            this.allRsvps = rsvps;

            // PHASE 3: Use DRY helper to load Chart.js
            if (!await this._ensureChartJsLoaded(ctx)) return;

            // Match actual field names: attending is boolean or string 'true'/'false'
            const attending = rsvps.filter(r => r.attending === true || r.attending === 'true').length;
            const notAttending = rsvps.filter(r => r.attending === false || r.attending === 'false').length;
            const pending = rsvps.length - attending - notAttending;

            // Store chart instance to allow cleanup on refresh
            this._charts.rsvps = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Attending', 'Not Attending', 'Pending'],
                    datasets: [{
                        data: [attending, notAttending, pending],
                        backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
                        borderColor: '#1e293b',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 15, usePointStyle: true, color: '#e2e8f0' }
                        }
                    }
                }
            });
        },

        /**
         * Refresh dashboard data
         */
        async refresh() {
            console.log('🔄 Refreshing admin dashboard...');
            await this.loadDashboard();
        },

        /**
         * Get unique branch options from users
         */
        getBranchOptions(users) {
            const branches = [...new Set(users.map(u => u.branch).filter(Boolean))].sort();
            return branches.map(b => `<option value="${this._escapeHtml(b)}">${this._escapeHtml(b)}</option>`).join('');
        },

        /**
         * Get sort icon for column header
         */
        getSortIcon(column) {
            if (this._tableState.sortColumn !== column) {
                return '<span class="sort-icon">⇅</span>';
            }
            return this._tableState.sortDirection === 'asc'
                ? '<span class="sort-icon sort-icon--active">↑</span>'
                : '<span class="sort-icon sort-icon--active">↓</span>';
        },

        /**
         * Sort table by column
         */
        sortByColumn(column) {
            if (this._tableState.sortColumn === column) {
                this._tableState.sortDirection = this._tableState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this._tableState.sortColumn = column;
                this._tableState.sortDirection = 'asc';
            }
            this._tableState.currentPage = 1;
            this.updateUsersTable();
        },

        /**
         * Apply all filters and update table
         */
        applyFilters() {
            const searchInput = document.getElementById('user-search');
            const roleFilter = document.getElementById('role-filter');
            const branchFilter = document.getElementById('branch-filter');

            this._tableState.filters.search = (searchInput?.value || '').toLowerCase().trim();
            this._tableState.filters.role = roleFilter?.value || 'all';
            this._tableState.filters.branch = branchFilter?.value || 'all';
            this._tableState.currentPage = 1;

            this.updateUsersTable();
        },

        /**
         * Change page size
         */
        changePageSize(size) {
            this._tableState.pageSize = parseInt(size, 10);
            this._tableState.currentPage = 1;
            this.updateUsersTable();
        },

        /**
         * Go to specific page
         */
        goToPage(page) {
            this._tableState.currentPage = page;
            this.updateUsersTable();
        },

        /**
         * Get filtered and sorted users
         */
        getProcessedUsers() {
            if (!this.allUsers) return [];

            let users = [...this.allUsers];

            // Apply filters
            const { search, role, branch } = this._tableState.filters;

            if (search) {
                users = users.filter(u =>
                    (u.username || '').toLowerCase().includes(search) ||
                    (u.name || '').toLowerCase().includes(search) ||
                    (u.email || '').toLowerCase().includes(search)
                );
            }

            if (role !== 'all') {
                users = users.filter(u => u.role === role);
            }

            if (branch !== 'all') {
                users = users.filter(u => u.branch === branch);
            }

            // Calculate event counts for sorting
            // Check multiple field names for compatibility (snake_case from Supabase, camelCase from GitHub)
            users = users.map(user => {
                const userId = String(user.id || '').toLowerCase();
                const username = (user.username || '').toLowerCase();

                const eventCount = this.allEvents?.filter(e => {
                    const createdById = String(e.created_by || e.createdBy || '').toLowerCase();
                    const createdByUsername = (e.createdByUsername || e.created_by_username || '').toLowerCase();

                    return (userId && createdById === userId) ||
                           (username && (createdById === username || createdByUsername === username));
                }).length || 0;

                const lastLoginDate = user.last_login || user.lastLogin || user.lastActive || user.last_active;
                const lastActiveTimestamp = lastLoginDate ? new Date(lastLoginDate).getTime() : 0;

                return { ...user, eventCount, lastActiveTimestamp };
            });

            // Apply sorting
            const { sortColumn, sortDirection } = this._tableState;
            const direction = sortDirection === 'asc' ? 1 : -1;

            users.sort((a, b) => {
                let aVal, bVal;

                switch (sortColumn) {
                    case 'eventCount':
                        aVal = a.eventCount;
                        bVal = b.eventCount;
                        break;
                    case 'lastActive':
                        aVal = a.lastActiveTimestamp;
                        bVal = b.lastActiveTimestamp;
                        break;
                    default:
                        aVal = (a[sortColumn] || '').toLowerCase();
                        bVal = (b[sortColumn] || '').toLowerCase();
                }

                if (aVal < bVal) return -1 * direction;
                if (aVal > bVal) return 1 * direction;
                return 0;
            });

            return users;
        },

        /**
         * Get paginated users
         */
        getPaginatedUsers() {
            const users = this.getProcessedUsers();
            const { currentPage, pageSize } = this._tableState;
            const start = (currentPage - 1) * pageSize;
            const end = start + pageSize;
            return users.slice(start, end);
        },

        /**
         * Update users table with current state
         */
        updateUsersTable() {
            const tbody = document.getElementById('users-table-body');
            const paginationContainer = document.getElementById('pagination-container');
            const titleEl = document.getElementById('user-count-title');

            if (tbody) {
                const paginatedUsers = this.getPaginatedUsers();
                tbody.innerHTML = this.renderFilteredUsersRows(paginatedUsers);
            }

            if (paginationContainer) {
                paginationContainer.innerHTML = this.renderPagination();
            }

            // Update title with filtered count
            const processedUsers = this.getProcessedUsers();
            const totalUsers = this.allUsers?.length || 0;
            if (titleEl) {
                if (processedUsers.length === totalUsers) {
                    titleEl.textContent = `👥 User Accounts (${totalUsers} total)`;
                } else {
                    titleEl.textContent = `👥 User Accounts (${processedUsers.length} of ${totalUsers})`;
                }
            }

            // Update sort icons in headers
            document.querySelectorAll('.sortable-header').forEach(header => {
                const column = header.dataset.column;
                const iconSpan = header.querySelector('.sort-icon');
                if (iconSpan) {
                    if (this._tableState.sortColumn === column) {
                        iconSpan.className = 'sort-icon sort-icon--active';
                        iconSpan.textContent = this._tableState.sortDirection === 'asc' ? '↑' : '↓';
                    } else {
                        iconSpan.className = 'sort-icon';
                        iconSpan.textContent = '⇅';
                    }
                }
            });
        },

        /**
         * Render rows for filtered/paginated users
         */
        renderFilteredUsersRows(users) {
            if (users.length === 0) {
                return '<tr><td colspan="9" class="empty-table-message">No users match your filters</td></tr>';
            }

            return users.map(user => {
                const lastLoginDate = user.last_login || user.lastLogin || user.lastActive || user.last_active;
                const lastActive = lastLoginDate
                    ? new Date(lastLoginDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'Never';

                const roleBadge = user.role === 'admin'
                    ? '<span class="role-badge role-badge--admin">ADMIN</span>'
                    : '<span class="role-badge role-badge--user">USER</span>';

                const safeUsername = this._escapeHtml(user.username) || 'N/A';
                const safeName = this._escapeHtml(user.name) || 'N/A';
                const safeEmail = this._escapeHtml(user.email) || 'N/A';
                const safeBranch = this._escapeHtml(user.branch) || 'N/A';
                const safeRank = this._escapeHtml(user.rank) || 'N/A';

                return `
                    <tr data-username="${this._escapeHtml(user.username?.toLowerCase())}">
                        <td><strong>${safeUsername}</strong></td>
                        <td>${safeName}</td>
                        <td>${safeEmail}</td>
                        <td>${safeBranch}</td>
                        <td>${safeRank}</td>
                        <td>${roleBadge}</td>
                        <td class="text-center">${user.eventCount || 0}</td>
                        <td>${lastActive}</td>
                        <td class="action-buttons">
                            <button class="btn btn-sm" data-action="edit-user">Edit</button>
                            <button class="btn btn-sm btn-danger" data-action="delete-user">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        /**
         * Render pagination controls
         */
        renderPagination() {
            const processedUsers = this.getProcessedUsers();
            const totalUsers = processedUsers.length;
            const { currentPage, pageSize } = this._tableState;
            const totalPages = Math.ceil(totalUsers / pageSize);

            if (totalPages <= 1) {
                return `<div class="pagination-info">Showing ${totalUsers} user${totalUsers !== 1 ? 's' : ''}</div>`;
            }

            const start = (currentPage - 1) * pageSize + 1;
            const end = Math.min(currentPage * pageSize, totalUsers);

            let buttons = '';

            // Previous button
            buttons += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="AdminDashboard.goToPage(${currentPage - 1})">‹ Prev</button>`;

            // Page numbers
            const maxVisible = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let endPage = Math.min(totalPages, startPage + maxVisible - 1);
            startPage = Math.max(1, endPage - maxVisible + 1);

            if (startPage > 1) {
                buttons += `<button class="pagination-btn" onclick="AdminDashboard.goToPage(1)">1</button>`;
                if (startPage > 2) buttons += '<span class="pagination-ellipsis">...</span>';
            }

            for (let i = startPage; i <= endPage; i++) {
                buttons += `<button class="pagination-btn ${i === currentPage ? 'pagination-btn--active' : ''}" onclick="AdminDashboard.goToPage(${i})">${i}</button>`;
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) buttons += '<span class="pagination-ellipsis">...</span>';
                buttons += `<button class="pagination-btn" onclick="AdminDashboard.goToPage(${totalPages})">${totalPages}</button>`;
            }

            // Next button
            buttons += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="AdminDashboard.goToPage(${currentPage + 1})">Next ›</button>`;

            return `
                <div class="pagination-info">Showing ${start}-${end} of ${totalUsers}</div>
                <div class="pagination-buttons">${buttons}</div>
            `;
        },

        /**
         * Export users to CSV
         */
        exportUsersCSV() {
            const users = this.getProcessedUsers();
            if (users.length === 0) {
                window.showToast?.('No users to export', 'warning') || alert('No users to export');
                return;
            }

            const headers = ['Username', 'Name', 'Email', 'Branch', 'Rank', 'Role', 'Events Created', 'Last Active'];
            const rows = users.map(user => {
                const lastLoginDate = user.last_login || user.lastLogin || user.lastActive || user.last_active;
                const lastActive = lastLoginDate ? new Date(lastLoginDate).toISOString() : 'Never';
                return [
                    user.username || '',
                    user.name || '',
                    user.email || '',
                    user.branch || '',
                    user.rank || '',
                    user.role || '',
                    user.eventCount || 0,
                    lastActive
                ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
            });

            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `eventcall-users-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            window.showToast?.(`Exported ${users.length} users to CSV`, 'success');
        },

        /**
         * Export statistics to CSV
         */
        exportStatsCSV() {
            const events = this.allEvents || [];
            const rsvps = this.allRsvps || [];
            const users = this.allUsers || [];

            // Calculate stats
            const now = new Date();
            const activeEvents = events.filter(e => new Date(e.datetime) >= now).length;
            // Match actual field names: attending is boolean or string 'true'/'false'
            const attending = rsvps.filter(r => r.attending === true || r.attending === 'true').length;
            const notAttending = rsvps.filter(r => r.attending === false || r.attending === 'false').length;
            const pending = rsvps.length - attending - notAttending;

            // Build CSV
            const lines = [
                'Metric,Value',
                `Total Users,${users.length}`,
                `Total Events,${events.length}`,
                `Active Events,${activeEvents}`,
                `Total RSVPs,${rsvps.length}`,
                `RSVPs Attending,${attending}`,
                `RSVPs Not Attending,${notAttending}`,
                `RSVPs Pending,${pending}`,
                `Engagement Rate,${rsvps.length > 0 ? Math.round((attending / rsvps.length) * 100) : 0}%`,
                `Events per User,${users.length > 0 ? (events.length / users.length).toFixed(2) : 0}`,
                `RSVPs per Event,${events.length > 0 ? (rsvps.length / events.length).toFixed(2) : 0}`,
                `Generated,${new Date().toISOString()}`
            ];

            const csv = lines.join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `eventcall-stats-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            window.showToast?.('Statistics exported to CSV', 'success');
        },

        /**
         * Show styled delete confirmation modal
         */
        showDeleteConfirmation(username) {
            this._pendingDelete = username;
            const modal = document.getElementById('confirm-modal');
            const title = document.getElementById('confirm-modal-title');
            const message = document.getElementById('confirm-modal-message');

            if (modal && title && message) {
                title.textContent = 'Delete User';
                message.innerHTML = `Are you sure you want to delete user <strong>${this._escapeHtml(username)}</strong>?<br><br>This action cannot be undone.`;
                modal.style.display = 'flex';
            }
        },

        /**
         * Close confirmation modal
         */
        closeConfirmModal() {
            const modal = document.getElementById('confirm-modal');
            if (modal) modal.style.display = 'none';
            this._pendingDelete = null;
        },

        /**
         * Execute confirmed delete action
         */
        async executeConfirmedAction() {
            if (this._pendingDelete) {
                await this.performDeleteUser(this._pendingDelete);
            }
            this.closeConfirmModal();
        },

        /**
         * Perform the actual user deletion
         */
        async performDeleteUser(username) {
            const currentUser = window.userAuth?.currentUser;
            if (!currentUser) {
                window.showToast('Authentication required', 'error');
                return;
            }

            const url = this._getAdminApiUrl(`/api/admin/users/${encodeURIComponent(username)}`);
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'x-username': currentUser.username
                }
            });

            if (response.ok) {
                this.refresh();
                window.showToast('User deleted successfully', 'success');
            } else {
                window.showToast('Failed to delete user.', 'error');
            }
        },

        /**
         * Change date range for statistics
         */
        changeDateRange(months) {
            this._dateRange = parseInt(months, 10);
            if (this.allEvents) {
                this.renderEventsChart(this.allEvents);
            }
        },

        /**
         * Show error message
         */
        showError(message) {
            const content = document.getElementById('admin-dashboard-content');
            if (content) {
                content.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--semper-red);">
                        <h2>❌ Error Loading Dashboard</h2>
                        <p>${this._escapeHtml(message)}</p>
                        <button class="btn btn-primary" onclick="AdminDashboard.refresh()">Retry</button>
                    </div>
                `;
            }
        }
    };

    // Make AdminDashboard globally available
    window.AdminDashboard = AdminDashboard;

    // Initialize
    AdminDashboard.init();

    console.log('✅ Admin Dashboard module loaded');
})();
