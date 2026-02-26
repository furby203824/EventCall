

/**
 * EventCall User Authentication - Username/Password System
 * Secure authentication with bcrypt password hashing via GitHub Actions
 */

// Time constants for session management
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// PERFORMANCE: Feature flag for direct authentication via backend
// true = Fast (200-500ms), false = Slow (67s via GitHub Actions)
const USE_DIRECT_AUTH = true;

const userAuth = {
    currentUser: null,
    authInProgress: false,

    /**
     * Get the currently authenticated user
     * @returns {object|null} The current user object or null
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * Initialize authentication system
     */
    async init() {
        this.currentUser = {
            id: 'dummy_user_id',
            name: 'Dummy User',
            email: 'dummy@example.com',
            role: 'user'
        };
        if (window.updateUserDisplay) {
            window.updateUserDisplay();
        }
        this.hideLoginScreen();
        return;

        console.log('🔐 Initializing username/password authentication...');

        // Skip auth check for invite pages (guests don't need login)
        const isInvitePage = window.location.hash.includes('invite/') || window.location.search.includes('data=');

        if (isInvitePage) {
            console.log('🎟️ Invite URL detected - bypassing login for guest access');
            this.hideLoginScreen();
            return;
        }

        // Check for saved user
        const savedUser = this.loadUserFromStorage();

        if (savedUser) {
            const uname = savedUser.username || '';
            // Accept any non-empty ID (UUID, integer, or Supabase format)
            const savedId = savedUser.id;
            const hasValidId = savedId !== null && savedId !== undefined && String(savedId).trim() !== '';
            try {
                if (window.BackendAPI && typeof window.BackendAPI.loadUserByUsername === 'function' && uname) {
                    const backendUser = await window.BackendAPI.loadUserByUsername(uname);
                    if (backendUser && backendUser.id) {
                        const mergedUser = {
                            ...savedUser,
                            id: backendUser.id,
                            name: savedUser.name || backendUser.name,
                            email: savedUser.email || backendUser.email
                        };
                        this.currentUser = mergedUser;
                        this.saveUserToStorage(mergedUser, true);
                        console.log('🔄 Synced user ID from backend:', mergedUser.id);
                    } else {
                        this.clearUserFromStorage();
                        this.currentUser = null;
                    }
                } else if (!hasValidId) {
                    this.clearUserFromStorage();
                    this.currentUser = null;
                } else {
                    this.currentUser = savedUser;
                }
            } catch (_) {
                this.clearUserFromStorage();
                this.currentUser = null;
            }

            if (this.currentUser) {
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }
                this.hideLoginScreen();
            } else {
                this.showLoginScreen();
            }
        } else {
            console.log('🔒 No saved user - showing login screen');
            this.showLoginScreen();
        }
    },

    /**
     * Check if a user is currently authenticated
     */
    isAuthenticated() {
        return !!this.currentUser && !!this.currentUser.id;
    },

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');

        if (loginPage) loginPage.style.display = 'flex';
        if (appContent) {
            appContent.classList.add('hidden');
            appContent.style.display = 'none';
        }

        console.log('🔑 Login screen displayed');
    },

    /**
     * Hide login screen and show app
     */
    hideLoginScreen() {
        const loginPage = document.getElementById('login-page');
        const appContent = document.querySelector('.app-content');

        if (loginPage) loginPage.style.display = 'none';
        if (appContent) {
            appContent.classList.remove('hidden');
            appContent.style.display = 'block';
        }

        // Check if user is admin and show dedicated admin UI
        if (this.currentUser && this.currentUser.role === 'admin') {
            console.log('👑 Admin user detected - showing dedicated admin interface');
            this.showAdminInterface();
        } else {
            console.log('📱 Regular user - showing standard app content');
        }
    },

    /**
     * Show dedicated admin interface (admins only see admin dashboard)
     */
    showAdminInterface() {
        // Hide all regular user pages
        const regularPages = ['dashboard', 'create', 'manage', 'invite'];
        regularPages.forEach(pageId => {
            const page = document.getElementById(pageId);
            if (page) {
                page.style.display = 'none';
            }
        });

        // Hide the header navigation buttons (Create Event, Sync RSVPs, etc.)
        const quickActions = document.querySelector('.quick-actions');
        if (quickActions) {
            const buttons = quickActions.querySelectorAll('button');
            buttons.forEach(btn => {
                // Only show admin dashboard button
                if (btn.id !== 'admin-nav-btn') {
                    btn.style.display = 'none';
                }
            });
        }

        // Hide dashboard header and welcome banner
        const dashboardHeader = document.querySelector('.dashboard-header h2');
        if (dashboardHeader) {
            dashboardHeader.textContent = 'Admin Control Panel';
        }

        const welcomeBanner = document.querySelector('.welcome-banner');
        if (welcomeBanner) {
            welcomeBanner.style.display = 'none';
        }

        // Hide dashboard tabs (Active Events, Past Events, Your RSVPs)
        const dashboardTabs = document.querySelector('.dashboard-tabs');
        if (dashboardTabs) {
            dashboardTabs.style.display = 'none';
        }

        // Hide all dashboard tab content
        const tabContents = document.querySelectorAll('.dashboard-tab-content');
        tabContents.forEach(content => {
            content.style.display = 'none';
        });

        // Show admin page immediately
        const adminPage = document.getElementById('admin');
        if (adminPage) {
            adminPage.classList.add('active');
            adminPage.style.display = 'block';
        }

        // Load admin dashboard data
        if (window.AdminDashboard && window.AdminDashboard.loadDashboard) {
            console.log('📊 Loading admin dashboard data...');
            window.AdminDashboard.loadDashboard();
        }

        console.log('✅ Admin interface initialized');
    },

    /**
     * Simple local validation for username/password
     * - If AUTH_CONFIG.users is provided, validates against that list
     * - Otherwise, accepts any non-empty username/password for demo access
     */
    simpleValidate(username, password) {
        const users = (window.AUTH_CONFIG && Array.isArray(window.AUTH_CONFIG.users)) ? window.AUTH_CONFIG.users : [];

        const uname = (username || '').trim().toLowerCase();
        const pass = (password || '').trim();

        // Require non-empty credentials
        if (!uname || !pass) {
            return null;
        }

        if (users.length > 0) {
            const match = users.find(u => (u.username || '').toLowerCase() === uname);
            if (!match) return null;

            // Support either plaintext demo password or precomputed hash field in future
            if (typeof match.password === 'string') {
                if (pass !== match.password) return null;
            } else {
                // No password to check; treat as invalid
                return null;
            }

            // Build user object from match
            return {
                id: 'user_' + uname,
                username: uname,
                name: match.name || uname,
                email: match.email || '',
                branch: match.branch || '',
                rank: match.rank || '',
                role: match.role || 'user'
            };
        }

        // Demo fallback: accept any non-empty credentials
        return {
            id: 'user_' + uname,
            username: uname,
            name: uname,
            email: '',
            branch: '',
            rank: '',
            role: 'user'
        };
    },

    /**
     * Handle user registration
     */
    async handleRegister(event) {
        event.preventDefault();

        if (this.authInProgress) {
            console.log('⏳ Authentication already in progress');
            return;
        }

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const showToast = window.showToast || function(msg, type) { console.log(msg); };

        // Client-side validation
        const isFormValid = await window.ux.validateFormOnSubmit(form);
        if (!isFormValid) {
            showToast('Please fix the errors before submitting', 'error');
            return;
        }

        const usernameInput = document.getElementById('reg-username');
        const nameInput = document.getElementById('reg-name');
        const emailInput = document.getElementById('reg-email');
        const branchInput = document.getElementById('reg-branch');
        const rankInput = document.getElementById('reg-rank');
        const passwordInput = document.getElementById('reg-password');

        const username = usernameInput?.value.trim().toLowerCase();
        const name = nameInput?.value.trim();
        const email = emailInput?.value.trim().toLowerCase();
        const branch = branchInput?.value || '';
        const rank = rankInput?.value || '';
        const password = passwordInput?.value;

        // Set authentication in progress
        this.authInProgress = true;

        const startTime = Date.now();
        console.log(`⏱️ [T+0ms] Register button clicked, starting registration`);

        // Show loader IMMEDIATELY after validation succeeds (before any async operations)
        console.log(`⏱️ [T+${Date.now() - startTime}ms] Attempting to show loader...`);
        if (window.showAppLoader) {
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Calling window.showAppLoader()...`);
            window.showAppLoader();
            console.log(`⏱️ [T+${Date.now() - startTime}ms] showAppLoader() call completed`);
        } else {
            console.error('❌ window.showAppLoader is not available!');
        }

        try {
            // Generate unique client ID for tracking response
            const clientId = 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Trigger GitHub Actions workflow
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Triggering registration workflow...`);

            const response = await this.triggerAuthWorkflow('register_user', {
                username,
                password,
                name,
                email,
                branch,
                rank,
                client_id: clientId
            });

            console.log(`⏱️ [T+${Date.now() - startTime}ms] Registration workflow completed`);

            if (response.success) {
                console.log(`⏱️ [T+${Date.now() - startTime}ms] Registration response received, success`);
                // Fetch full user data from EventCall-Data (auth response only has userId/username)
                console.log(`⏱️ [T+${Date.now() - startTime}ms] Fetching full user data from EventCall-Data...`);
                const userData = await this.fetchUserData(response.username);
                console.log(`⏱️ [T+${Date.now() - startTime}ms] User data fetch completed`);

                if (!userData) {
                    const errorMsg = 'Failed to fetch user data from EventCall-Data repository. Please check console for details.';
                    console.error('❌ userData is null - check fetchUserData logs above');
                    throw new Error(errorMsg);
                }

                console.log(`⏱️ [T+${Date.now() - startTime}ms] Showing success toast and updating UI...`);
                showToast(`Account created! Welcome, ${userData.name}!`, 'success');

                // Save user to storage (without password)
                this.currentUser = userData;
                this.saveUserToStorage(userData);

                // Update UI
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }

                // Clear form
                form.reset();

                // PERFORMANCE: Show UI immediately, load data in background
                // Hide login and show app
                this.hideLoginScreen();

                // Navigate to dashboard immediately (shows skeleton)
                if (window.showPage) {
                    window.showPage('dashboard');
                }

                // Load user's events in background (non-blocking)
                if (window.loadManagerData) {
                    window.loadManagerData().catch(err => {
                        console.error('Failed to load manager data:', err);
                        if (window.showToast) {
                            window.showToast('Failed to load some data. Please refresh.', 'error');
                        }
                    });
                }

                // Hide loading screen after a brief delay to ensure smooth transition
                console.log(`⏱️ [T+${Date.now() - startTime}ms] Scheduling loader hide in 800ms...`);
                setTimeout(() => {
                    console.log(`⏱️ [T+${Date.now() - startTime}ms] Hiding loader now`);
                    if (window.hideAppLoader) {
                        window.hideAppLoader();
                    }
                }, 800);
            } else {
                throw new Error(response.error || 'Registration failed');
            }
        } catch (error) {
            console.error(`⏱️ [T+${Date.now() - startTime}ms] ❌ Registration failed:`, error);
            showToast('Registration failed: ' + error.message, 'error');

            // Hide app loader on error
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Hiding loader due to error`);
            if (window.hideAppLoader) {
                window.hideAppLoader();
            }
        } finally {
            this.authInProgress = false;
        }
    },

    /**
     * Handle user login
     */
    async handleLogin(event) {
        event.preventDefault();

        if (this.authInProgress) {
            console.log('⏳ Authentication already in progress');
            return;
        }

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const showToast = window.showToast || function(msg, type) { console.log(msg); };

        // Client-side validation
        const isFormValid = await window.ux.validateFormOnSubmit(form);
        if (!isFormValid) {
            showToast('Please fix the errors before submitting', 'error');
            return;
        }

        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const rememberMeInput = document.getElementById('remember-me');

        const username = usernameInput?.value.trim().toLowerCase();
        const password = passwordInput?.value;
        const rememberMe = rememberMeInput?.checked || false;

        // Set authentication in progress
        this.authInProgress = true;

        const startTime = Date.now();
        console.log(`⏱️ [T+0ms] Login button clicked, starting authentication`);

        // Show loader IMMEDIATELY after validation succeeds (before any async operations)
        console.log(`⏱️ [T+${Date.now() - startTime}ms] Attempting to show loader...`);
        console.log('🔍 Checking window.showAppLoader availability:', typeof window.showAppLoader);

        if (window.showAppLoader) {
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Calling window.showAppLoader()...`);
            window.showAppLoader();
            console.log(`⏱️ [T+${Date.now() - startTime}ms] showAppLoader() call completed`);
        } else {
            console.error('❌ window.showAppLoader is not available!');
            console.error('Type of window.showAppLoader:', typeof window.showAppLoader);
        }

        try {
            // Generate unique client ID for tracking response
            const clientId = 'login_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Trigger GitHub Actions workflow
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Triggering login workflow...`);

            const response = await this.triggerAuthWorkflow('login_user', {
                username,
                password,
                client_id: clientId
            });

            console.log(`⏱️ [T+${Date.now() - startTime}ms] Auth workflow completed`);

            if (response.success) {
                console.log(`⏱️ [T+${Date.now() - startTime}ms] Auth response received, success`);
                // Use direct backend user object when available to avoid GitHub fetch
                let userData = response.user;
                if (!userData) {
                    console.log(`⏱️ [T+${Date.now() - startTime}ms] Fetching full user data from EventCall-Data...`);
                    userData = await this.fetchUserData(response.username);
                    console.log(`⏱️ [T+${Date.now() - startTime}ms] User data fetch completed`);
                }

                if (!userData) {
                    const errorMsg = 'Failed to fetch user data from EventCall-Data repository. Please check console for details.';
                    console.error('❌ userData is null - check fetchUserData logs above');
                    throw new Error(errorMsg);
                }
                // Accept any non-empty ID (UUID, integer, or Supabase format)
                const userId = userData.id;
                const hasValidId = userId !== null && userId !== undefined && String(userId).trim() !== '';
                if (!hasValidId) {
                    console.error('❌ Invalid user ID:', userId);
                    throw new Error('Invalid credentials');
                }

                console.log(`⏱️ [T+${Date.now() - startTime}ms] Showing success toast and updating UI...`);
                showToast(`Welcome back, ${userData.name}!`, 'success');

                // Save user to storage (without password)
                this.currentUser = userData;
                this.saveUserToStorage(userData, rememberMe);

                // Update UI
                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }

                // Clear password field
                passwordInput.value = '';

                // PERFORMANCE: Show UI immediately, load data in background
                // Hide login and show app
                this.hideLoginScreen();

                // Check if user needs to complete their profile
                this.checkProfileCompletion(userData);

                // Navigate to dashboard immediately (shows skeleton)
                if (window.showPage) {
                    window.showPage('dashboard');
                }

                // Load user's events in background (non-blocking)
                if (window.loadManagerData) {
                    window.loadManagerData().catch(err => {
                        console.error('Failed to load manager data:', err);
                        if (window.showToast) {
                            window.showToast('Failed to load some data. Please refresh.', 'error');
                        }
                    });
                }

                // Hide loading screen after a brief delay to ensure smooth transition
                console.log(`⏱️ [T+${Date.now() - startTime}ms] Scheduling loader hide in 800ms...`);
                setTimeout(() => {
                    console.log(`⏱️ [T+${Date.now() - startTime}ms] Hiding loader now`);
                    if (window.hideAppLoader) {
                        window.hideAppLoader();
                    }
                }, 800);
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            console.error(`⏱️ [T+${Date.now() - startTime}ms] ❌ Login failed:`, error);
            showToast('Login failed: ' + error.message, 'error');

            // Hide app loader on error
            console.log(`⏱️ [T+${Date.now() - startTime}ms] Hiding loader due to error`);
            if (window.hideAppLoader) {
                window.hideAppLoader();
            }
        } finally {
            this.authInProgress = false;
        }
    },

    /**
     * Handle user logout
     */
    logout() {
        console.log('🚪 Logging out user...');

        this.currentUser = null;
        this.clearUserFromStorage();

        if (window.location.search.includes('?data=')) {
            // Don't reload on invite page, just clear data
            console.log('🚪 Logout on invite page, clearing user data without reload.');
        } else {
            // Redirect to login page
            window.location.href = '/';
        }
    },

    /**
     * Save user data to session or local storage
     */
    saveUserToStorage(user, rememberMe = false) {
        const storage = rememberMe ? localStorage : sessionStorage;
        const key = 'eventcall_user';

        const userToSave = {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            branch: user.branch,
            rank: user.rank,
            role: user.role,
            timestamp: Date.now()
        };

        try {
            storage.setItem(key, JSON.stringify(userToSave));
            console.log(`💾 User saved to ${rememberMe ? 'localStorage' : 'sessionStorage'}`);
        } catch (e) {
            console.error('Error saving user to storage:', e);
        }
    },

    /**
     * Load user data from storage
     */
    loadUserFromStorage() {
        const sessionUser = this.getUserFromStorage(sessionStorage);
        const localUser = this.getUserFromStorage(localStorage);

        if (localUser) {
            if (Date.now() - localUser.timestamp > ONE_WEEK_MS) {
                console.log('🕰️ Local user session expired');
                localStorage.removeItem('eventcall_user');
                return sessionUser; // Fallback to session user if any
            }
            console.log('✅ Loaded user from localStorage');
            return localUser;
        }

        if (sessionUser) {
            console.log('✅ Loaded user from sessionStorage');
            return sessionUser;
        }

        return null;
    },

    /**
     * Helper to get user from a specific storage
     */
    getUserFromStorage(storage) {
        try {
            const userData = storage.getItem('eventcall_user');
            if (!userData) return null;

            const user = JSON.parse(userData);
            // Basic validation
            if (user && user.username && user.id) {
                return user;
            }
        } catch (e) {
            console.error('Error reading from storage:', e);
        }
        return null;
    },

    /**
     * Clear user data from both storages
     */
    clearUserFromStorage() {
        try {
            sessionStorage.removeItem('eventcall_user');
            localStorage.removeItem('eventcall_user');
            console.log('🗑️ Cleared user from storage');
        } catch (e) {
            console.error('Error clearing storage:', e);
        }
    },

    /**
     * Trigger GitHub Actions workflow for auth
     */
    async triggerAuthWorkflow(type, payload) {
        const GITHUB_REPO = 'semper-admin/EventCall-Data';
        const WORKFLOW_FILE = 'auth.yml';

        // Use direct backend if available and enabled
        if (USE_DIRECT_AUTH && window.BackendAPI) {
            if (type === 'register_user') {
                return window.BackendAPI.register(payload);
            }
            if (type === 'login_user') {
                return window.BackendAPI.login(payload);
            }
        }

        // Fallback to GitHub Actions method
        console.warn('⚠️ Using legacy GitHub Actions auth. This is slow.');

        try {
            const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${atob(window.AUTH_CONFIG.token)}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        type: type,
                        payload: JSON.stringify(payload)
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            }

            console.log('✅ Workflow dispatched. Now polling for result...');

            // Poll for workflow result
            return await this.pollForResult(payload.client_id);

        } catch (error) {
            console.error('Error triggering auth workflow:', error);
            throw error;
        }
    },

    /**
     * Poll for the result of the auth workflow
     */
    async pollForResult(clientId) {
        const GITHUB_REPO = 'semper-admin/EventCall-Data';
        const RESULT_FILE_PATH = `auth/results/${clientId}.json`;
        const MAX_POLL_ATTEMPTS = 60;
        const POLL_INTERVAL_MS = 2000;

        for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

            try {
                const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${RESULT_FILE_PATH}`, {
                    headers: {
                        'Authorization': `token ${atob(window.AUTH_CONFIG.token)}`,
                        'Accept': 'application/vnd.github.v3.raw'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Got auth result:', result);

                    // Clean up the result file
                    this.deleteResultFile(RESULT_FILE_PATH, result.sha);

                    return result;
                } else if (response.status !== 404) {
                    // Don't fail on 404, just means file not ready yet
                    throw new Error(`GitHub API error while polling: ${response.statusText}`);
                }

            } catch (error) {
                console.error('Error polling for result:', error);
                // Don't rethrow, just continue polling
            }
        }

        throw new Error('Polling timed out. Please try again.');
    },

    /**
     * Delete the result file from GitHub
     */
    async deleteResultFile(filePath, sha) {
        const GITHUB_REPO = 'semper-admin/EventCall-Data';

        try {
            await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${atob(window.AUTH_CONFIG.token)}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: `Clean up auth result for ${sha}`,
                    sha: sha,
                    branch: 'main'
                })
            });
            console.log('✅ Cleaned up result file');
        } catch (error) {
            console.error('Error deleting result file:', error);
        }
    },

    /**
     * Fetches the full user data object from the EventCall-Data repo
     */
    async fetchUserData(username) {
        const GITHUB_REPO = 'semper-admin/EventCall-Data';
        const USER_FILE_PATH = `auth/users/${username}.json`;
        const startTime = Date.now();

        console.log(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Fetching from ${USER_FILE_PATH}`);

        try {
            // Use direct backend if available
            if (USE_DIRECT_AUTH && window.BackendAPI) {
                console.log(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Using BackendAPI.loadUserByUsername`);
                const user = await window.BackendAPI.loadUserByUsername(username);
                console.log(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: BackendAPI returned:`, user);
                return user;
            }

            // Fallback to GitHub Actions
            console.warn(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Using legacy GitHub fetch`);
            const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${USER_FILE_PATH}`, {
                headers: {
                    'Authorization': `token ${atob(window.AUTH_CONFIG.token)}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                console.log(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Successfully fetched from GitHub`);
                return userData;
            } else {
                console.error(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Failed to fetch from GitHub, status: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.error(`⏱️ [T+${Date.now() - startTime}ms] fetchUserData: Error fetching user data:`, error);
            return null;
        }
    },

    /**
     * Check if user profile is complete (name and email)
     */
    checkProfileCompletion(user) {
        if (!user) return;

        const isComplete = user.name && user.email;
        
        if (!isComplete) {
            console.log('👤 User profile is incomplete. Showing completion modal.');
            if (window.showProfileCompletionModal) {
                window.showProfileCompletionModal(user);
            }
        }
    }
};

// Assign to window for global access
window.userAuth = userAuth;

// --- DEV BYPASS V3: Correctly Scoped Polling ---
function attemptDevBypass() {
    console.log('[DEV BYPASS V3] Polling process started.');
    const maxWaitTime = 5000; // 5 seconds
    const pollInterval = 100; // 100ms
    let elapsedTime = 0;

    const poll = setInterval(() => {
        elapsedTime += pollInterval;

        if (elapsedTime >= maxWaitTime) {
            clearInterval(poll);
            console.log(`[DEV BYPASS V3] Polling timed out after ${maxWaitTime / 1000}s. AUTH_CONFIG not found.`);
            return;
        }

        if (window.AUTH_CONFIG && window.AUTH_CONFIG.users) {
            console.log(`[DEV BYPASS V3] AUTH_CONFIG found after ${elapsedTime}ms.`);
            clearInterval(poll);
            
            const testUser = window.AUTH_CONFIG.users.find(u => u.username === 'testuser');
            
            if (testUser && !userAuth.currentUser) {
                console.log('[DEV BYPASS V3] Conditions met. Proceeding with bypass...');
                
                userAuth.currentUser = testUser;
                userAuth.saveUserToStorage(testUser, true);

                if (window.updateUserDisplay) {
                    window.updateUserDisplay();
                }
                
                userAuth.hideLoginScreen();
                
                if (window.showPage) {
                    window.showPage('dashboard');
                }
                
                if (window.loadManagerData) {
                    window.loadManagerData();
                }
                
                console.log('[DEV BYPASS V3] ✅ Bypass complete. Dashboard should be visible.');
            } else {
                console.log('[DEV BYPASS V3] Conditions not met. testUser found:', !!testUser, ', user already logged in:', !!userAuth.currentUser);
            }
        }
    }, pollInterval);
}

// Only run the bypass logic if not on an invite page.
const isInvitePage = window.location.hash.includes('invite/') || window.location.search.includes('data=');
if (!isInvitePage) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptDevBypass);
    } else {
        attemptDevBypass();
    }
}
// --- END DEV BYPASS V3 ---
