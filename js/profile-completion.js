/**
 * Profile Completion Module
 * Prompts users to complete their profile when missing required information
 */

const ProfileCompletion = (function() {
    'use strict';

    // Military ranks by branch
    const RANKS_BY_BRANCH = {
        'Army': [
            'E-1 Private (PVT)', 'E-2 Private Second Class (PV2)', 'E-3 Private First Class (PFC)',
            'E-4 Specialist (SPC)', 'E-4 Corporal (CPL)', 'E-5 Sergeant (SGT)',
            'E-6 Staff Sergeant (SSG)', 'E-7 Sergeant First Class (SFC)',
            'E-8 Master Sergeant (MSG)', 'E-8 First Sergeant (1SG)',
            'E-9 Sergeant Major (SGM)', 'E-9 Command Sergeant Major (CSM)',
            'E-9 Sergeant Major of the Army (SMA)',
            'W-1 Warrant Officer 1 (WO1)', 'W-2 Chief Warrant Officer 2 (CW2)',
            'W-3 Chief Warrant Officer 3 (CW3)', 'W-4 Chief Warrant Officer 4 (CW4)',
            'W-5 Chief Warrant Officer 5 (CW5)',
            'O-1 Second Lieutenant (2LT)', 'O-2 First Lieutenant (1LT)',
            'O-3 Captain (CPT)', 'O-4 Major (MAJ)', 'O-5 Lieutenant Colonel (LTC)',
            'O-6 Colonel (COL)', 'O-7 Brigadier General (BG)',
            'O-8 Major General (MG)', 'O-9 Lieutenant General (LTG)',
            'O-10 General (GEN)', 'O-10 General of the Army (GA)'
        ],
        'Navy': [
            'E-1 Seaman Recruit (SR)', 'E-2 Seaman Apprentice (SA)', 'E-3 Seaman (SN)',
            'E-4 Petty Officer Third Class (PO3)', 'E-5 Petty Officer Second Class (PO2)',
            'E-6 Petty Officer First Class (PO1)', 'E-7 Chief Petty Officer (CPO)',
            'E-8 Senior Chief Petty Officer (SCPO)', 'E-9 Master Chief Petty Officer (MCPO)',
            'E-9 Command Master Chief Petty Officer (CMDCM)',
            'E-9 Master Chief Petty Officer of the Navy (MCPON)',
            'W-2 Chief Warrant Officer 2 (CWO2)', 'W-3 Chief Warrant Officer 3 (CWO3)',
            'W-4 Chief Warrant Officer 4 (CWO4)', 'W-5 Chief Warrant Officer 5 (CWO5)',
            'O-1 Ensign (ENS)', 'O-2 Lieutenant Junior Grade (LTJG)',
            'O-3 Lieutenant (LT)', 'O-4 Lieutenant Commander (LCDR)',
            'O-5 Commander (CDR)', 'O-6 Captain (CAPT)',
            'O-7 Rear Admiral Lower Half (RDML)', 'O-8 Rear Admiral Upper Half (RADM)',
            'O-9 Vice Admiral (VADM)', 'O-10 Admiral (ADM)',
            'O-10 Fleet Admiral (FADM)'
        ],
        'Air Force': [
            'E-1 Airman Basic (AB)', 'E-2 Airman (Amn)', 'E-3 Airman First Class (A1C)',
            'E-4 Senior Airman (SrA)', 'E-5 Staff Sergeant (SSgt)',
            'E-6 Technical Sergeant (TSgt)', 'E-7 Master Sergeant (MSgt)',
            'E-7 First Sergeant (1st Sgt)', 'E-8 Senior Master Sergeant (SMSgt)',
            'E-9 Chief Master Sergeant (CMSgt)', 'E-9 Command Chief Master Sergeant (CCM)',
            'E-9 Chief Master Sergeant of the Air Force (CMSAF)',
            'O-1 Second Lieutenant (2d Lt)', 'O-2 First Lieutenant (1st Lt)',
            'O-3 Captain (Capt)', 'O-4 Major (Maj)', 'O-5 Lieutenant Colonel (Lt Col)',
            'O-6 Colonel (Col)', 'O-7 Brigadier General (Brig Gen)',
            'O-8 Major General (Maj Gen)', 'O-9 Lieutenant General (Lt Gen)',
            'O-10 General (Gen)', 'O-10 General of the Air Force (GAF)'
        ],
        'Marine Corps': [
            'E-1 Private (Pvt)', 'E-2 Private First Class (PFC)', 'E-3 Lance Corporal (LCpl)',
            'E-4 Corporal (Cpl)', 'E-5 Sergeant (Sgt)', 'E-6 Staff Sergeant (SSgt)',
            'E-7 Gunnery Sergeant (GySgt)', 'E-8 Master Sergeant (MSgt)',
            'E-8 First Sergeant (1stSgt)', 'E-9 Master Gunnery Sergeant (MGySgt)',
            'E-9 Sergeant Major (SgtMaj)', 'E-9 Sergeant Major of the Marine Corps (SMMC)',
            'W-1 Warrant Officer 1 (WO1)', 'W-2 Chief Warrant Officer 2 (CWO2)',
            'W-3 Chief Warrant Officer 3 (CWO3)', 'W-4 Chief Warrant Officer 4 (CWO4)',
            'W-5 Chief Warrant Officer 5 (CWO5)',
            'O-1 Second Lieutenant (2ndLt)', 'O-2 First Lieutenant (1stLt)',
            'O-3 Captain (Capt)', 'O-4 Major (Maj)', 'O-5 Lieutenant Colonel (LtCol)',
            'O-6 Colonel (Col)', 'O-7 Brigadier General (BGen)',
            'O-8 Major General (MajGen)', 'O-9 Lieutenant General (LtGen)',
            'O-10 General (Gen)'
        ],
        'Coast Guard': [
            'E-1 Seaman Recruit (SR)', 'E-2 Seaman Apprentice (SA)', 'E-3 Seaman (SN)',
            'E-4 Petty Officer Third Class (PO3)', 'E-5 Petty Officer Second Class (PO2)',
            'E-6 Petty Officer First Class (PO1)', 'E-7 Chief Petty Officer (CPO)',
            'E-8 Senior Chief Petty Officer (SCPO)', 'E-9 Master Chief Petty Officer (MCPO)',
            'E-9 Command Master Chief Petty Officer (CMC)',
            'E-9 Master Chief Petty Officer of the Coast Guard (MCPOCG)',
            'W-2 Chief Warrant Officer 2 (CWO2)', 'W-3 Chief Warrant Officer 3 (CWO3)',
            'W-4 Chief Warrant Officer 4 (CWO4)',
            'O-1 Ensign (ENS)', 'O-2 Lieutenant Junior Grade (LTJG)',
            'O-3 Lieutenant (LT)', 'O-4 Lieutenant Commander (LCDR)',
            'O-5 Commander (CDR)', 'O-6 Captain (CAPT)',
            'O-7 Rear Admiral Lower Half (RDML)', 'O-8 Rear Admiral Upper Half (RADM)',
            'O-9 Vice Admiral (VADM)', 'O-10 Admiral (ADM)'
        ],
        'Space Force': [
            'E-1 Specialist 1 (Sp1)', 'E-2 Specialist 2 (Sp2)', 'E-3 Specialist 3 (Sp3)',
            'E-4 Specialist 4 (Sp4)', 'E-5 Sergeant (Sgt)', 'E-6 Technical Sergeant (TSgt)',
            'E-7 Master Sergeant (MSgt)', 'E-8 Senior Master Sergeant (SMSgt)',
            'E-9 Chief Master Sergeant (CMSgt)',
            'E-9 Chief Master Sergeant of the Space Force (CMSSF)',
            'O-1 Second Lieutenant (2d Lt)', 'O-2 First Lieutenant (1st Lt)',
            'O-3 Captain (Capt)', 'O-4 Major (Maj)', 'O-5 Lieutenant Colonel (Lt Col)',
            'O-6 Colonel (Col)', 'O-7 Brigadier General (Brig Gen)',
            'O-8 Major General (Maj Gen)', 'O-9 Lieutenant General (Lt Gen)',
            'O-10 General (Gen)'
        ],
        'Civilian': [
            'Civilian', 'Contractor', 'Government Employee', 'Veteran', 'Family Member', 'Other'
        ]
    };

    const BRANCHES = Object.keys(RANKS_BY_BRANCH);

    /**
     * Check if user needs to complete their profile
     * @param {Object} user - User object with email, branch, rank properties
     * @returns {Object} - Object with needsCompletion boolean and array of missing fields
     */
    function needsProfileCompletion(user) {
        if (!user) return { needsCompletion: false, missingFields: [] };

        const missingFields = [];

        // Check for placeholder email (@eventcall)
        const email = user.email || '';
        if (email.toLowerCase().includes('@eventcall')) {
            missingFields.push('email');
        }

        // Check for missing branch
        const branch = user.branch || user.service_branch || '';
        if (!branch || branch === 'N/A' || branch === 'n/a' || branch.trim() === '') {
            missingFields.push('branch');
        }

        // Check for missing rank
        const rank = user.rank || user.military_rank || '';
        if (!rank || rank === 'N/A' || rank === 'n/a' || rank.trim() === '') {
            missingFields.push('rank');
        }

        return {
            needsCompletion: missingFields.length > 0,
            missingFields: missingFields
        };
    }

    /**
     * Create and show the profile completion modal
     * @param {Object} user - User object
     * @param {Function} onSave - Callback when profile is saved
     * @param {Function} onRemindLater - Callback when user clicks remind later
     */
    function showProfileCompletionModal(user, onSave, onRemindLater) {
        const { needsCompletion, missingFields } = needsProfileCompletion(user);

        if (!needsCompletion) {
            console.log('Profile is complete, no modal needed');
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('profile-completion-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'profile-completion-modal';
        modal.className = 'modal profile-completion-modal';

        const currentBranch = user.branch || user.service_branch || '';
        const currentRank = user.rank || user.military_rank || '';
        const currentEmail = user.email || '';

        modal.innerHTML = `
            <div class="modal-content profile-completion-content">
                <div class="profile-completion-header">
                    <span class="profile-completion-icon"></span>
                    <h3>Complete Your Profile</h3>
                    <p>Please update the following information to enhance your experience.</p>
                </div>
                <form id="profile-completion-form" class="profile-completion-form">
                    ${missingFields.includes('email') ? `
                        <div class="form-group">
                            <label for="profile-email">Email Address</label>
                            <input type="email" id="profile-email" name="email"
                                   placeholder="Enter your email address"
                                   value="${_escapeHtml(currentEmail.includes('@eventcall') ? '' : currentEmail)}"
                                   required>
                            <span class="field-hint">Please provide a valid email address</span>
                        </div>
                    ` : ''}

                    ${missingFields.includes('branch') ? `
                        <div class="form-group">
                            <label for="profile-branch">Service Branch</label>
                            <select id="profile-branch" name="branch" required>
                                <option value="">Select your branch</option>
                                ${BRANCHES.map(b => `<option value="${_escapeHtml(b)}">${_escapeHtml(b)}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}

                    ${missingFields.includes('rank') ? `
                        <div class="form-group">
                            <label for="profile-rank">Rank</label>
                            <select id="profile-rank" name="rank" required ${missingFields.includes('branch') ? 'disabled' : ''}>
                                <option value="">${missingFields.includes('branch') ? 'Select branch first' : 'Select your rank'}</option>
                                ${!missingFields.includes('branch') && currentBranch && RANKS_BY_BRANCH[currentBranch] ?
                                    RANKS_BY_BRANCH[currentBranch].map(r => `<option value="${_escapeHtml(r)}">${_escapeHtml(r)}</option>`).join('') : ''}
                            </select>
                        </div>
                    ` : ''}

                    <div class="profile-completion-actions">
                        <button type="button" id="profile-remind-later" class="btn btn-secondary">
                            Remind Me Later
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Save Profile
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // Set up branch change handler to update rank options
        const branchSelect = document.getElementById('profile-branch');
        const rankSelect = document.getElementById('profile-rank');

        if (branchSelect && rankSelect) {
            branchSelect.addEventListener('change', function() {
                const selectedBranch = this.value;
                rankSelect.innerHTML = '<option value="">Select your rank</option>';

                if (selectedBranch && RANKS_BY_BRANCH[selectedBranch]) {
                    RANKS_BY_BRANCH[selectedBranch].forEach(rank => {
                        const option = document.createElement('option');
                        option.value = rank;
                        option.textContent = rank;
                        rankSelect.appendChild(option);
                    });
                    rankSelect.disabled = false;
                } else {
                    rankSelect.disabled = true;
                    rankSelect.innerHTML = '<option value="">Select branch first</option>';
                }
            });
        }

        // Set up form submission
        const form = document.getElementById('profile-completion-form');
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = {};

            if (missingFields.includes('email')) {
                const emailInput = document.getElementById('profile-email');
                formData.email = emailInput.value.trim();

                // Basic email validation
                if (!_isValidEmail(formData.email)) {
                    _showFieldError(emailInput, 'Please enter a valid email address');
                    return;
                }

                // Check it's not still a placeholder
                if (formData.email.toLowerCase().includes('@eventcall')) {
                    _showFieldError(emailInput, 'Please use a non-placeholder email');
                    return;
                }
            }

            if (missingFields.includes('branch')) {
                formData.branch = document.getElementById('profile-branch').value;
            }

            if (missingFields.includes('rank')) {
                formData.rank = document.getElementById('profile-rank').value;
            }

            // Call save callback
            if (typeof onSave === 'function') {
                onSave(formData, function(success) {
                    if (success) {
                        _closeModal();
                    }
                });
            } else {
                _closeModal();
            }
        });

        // Set up remind later button
        const remindLaterBtn = document.getElementById('profile-remind-later');
        remindLaterBtn.addEventListener('click', function() {
            if (typeof onRemindLater === 'function') {
                onRemindLater();
            }
            _closeModal();
        });

        // Prevent closing by clicking outside (user must take action)
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                // Shake the modal to indicate they must take action
                const content = modal.querySelector('.profile-completion-content');
                content.classList.add('shake');
                setTimeout(() => content.classList.remove('shake'), 500);
            }
        });

        // Show modal with animation
        requestAnimationFrame(() => {
            modal.classList.add('modal--visible');
        });
    }

    /**
     * Close the profile completion modal
     */
    function _closeModal() {
        const modal = document.getElementById('profile-completion-modal');
        if (modal) {
            modal.classList.remove('modal--visible');
            setTimeout(() => modal.remove(), 300);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Validate email format
     */
    function _isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Show field error message
     */
    function _showFieldError(input, message) {
        // Remove existing error
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) existingError.remove();

        // Add error class to input
        input.classList.add('input-error');

        // Create error message
        const error = document.createElement('span');
        error.className = 'field-error';
        error.textContent = message;
        input.parentNode.appendChild(error);

        // Focus the input
        input.focus();

        // Remove error on input change
        input.addEventListener('input', function handler() {
            input.classList.remove('input-error');
            const err = input.parentNode.querySelector('.field-error');
            if (err) err.remove();
            input.removeEventListener('input', handler);
        });
    }

    /**
     * Get ranks for a specific branch
     */
    function getRanksForBranch(branch) {
        return RANKS_BY_BRANCH[branch] || [];
    }

    /**
     * Get all available branches
     */
    function getBranches() {
        return [...BRANCHES];
    }

    // Public API
    return {
        needsProfileCompletion,
        showProfileCompletionModal,
        getRanksForBranch,
        getBranches
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileCompletion;
}
