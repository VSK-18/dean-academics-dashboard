// Constants & Initial Budgets
const BUDGETS = {
    AAF: 6200000, // 62 Lakhs
    EQA: 10000000 // 1 Crore
};

const API_BASE = '/api/proposals';

// App State
let proposals = [];
let activeFilters = {
    query: '',
    category: 'all',
    startDate: '2026-04-01',
    endDate: '2026-05-15'
};
let currentUserRole = sessionStorage.getItem('dean_user_role') || null;

// Dom Elements
const proposalsList = document.getElementById('proposals-list');
const searchInput = document.getElementById('search-query');
const categoryFilter = document.getElementById('filter-category');
const dateStartInput = document.getElementById('filter-date-start');
const dateEndInput = document.getElementById('filter-date-end');
const resetFiltersBtn = document.getElementById('btn-reset-filters');
const proposalForm = document.getElementById('proposal-form');
const cancelFormBtn = document.getElementById('btn-cancel-form');
const formPanelTitle = document.getElementById('form-panel-title');

// Auth DOM elements
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const authErrorMsg = document.getElementById('auth-error-msg');
const logoutBtn = document.getElementById('btn-logout');
const userRoleText = document.getElementById('user-role-text');
const userRoleIcon = document.getElementById('user-role-icon');

// Tabs DOM Elements
const tabAnalyticsBtn = document.getElementById('tab-analytics-btn');
const tabManageBtn = document.getElementById('tab-manage-btn');
const panelAnalytics = document.getElementById('panel-analytics');
const panelManage = document.getElementById('panel-manage');

// Chart Variables
let utilizationChart = null;
let ratioChart = null;

// Helpers: Formatting Currency
function formatCurrency(amount) {
    if (amount >= 10000000) {
        return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
        return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
}

// Fetch Proposals from API
async function fetchProposals() {
    try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error('Failed to fetch data');
        proposals = await response.json();
        renderAll();
    } catch (err) {
        console.error('Error fetching proposals:', err);
    }
}

// Check/Update Stats and KPI panels
function updateKPICards() {
    let aafUtilized = 0;
    let eqaUtilized = 0;

    proposals.forEach(p => {
        if (p.category === 'AAF') aafUtilized += parseFloat(p.utilization);
        if (p.category === 'EQA') eqaUtilized += parseFloat(p.utilization);
    });

    const aafPercent = Math.min(100, (aafUtilized / BUDGETS.AAF) * 100);
    const eqaPercent = Math.min(100, (eqaUtilized / BUDGETS.EQA) * 100);

    // Update Text Elements
    document.getElementById('stat-aaf-utilized').textContent = formatCurrency(aafUtilized);
    document.getElementById('stat-aaf-percent').textContent = `${aafPercent.toFixed(1)}%`;
    document.getElementById('stat-aaf-progress').style.width = `${aafPercent}%`;

    document.getElementById('stat-eqa-utilized').textContent = formatCurrency(eqaUtilized);
    document.getElementById('stat-eqa-percent').textContent = `${eqaPercent.toFixed(1)}%`;
    document.getElementById('stat-eqa-progress').style.width = `${eqaPercent}%`;

    // Totals
    const totalSanctioned = BUDGETS.AAF + BUDGETS.EQA;
    document.getElementById('stat-total-budget').textContent = formatCurrency(totalSanctioned);
}

// Initializing Charts
function initCharts() {
    const ctxBar = document.getElementById('utilizationChart').getContext('2d');
    
    const depts = [...new Set(proposals.map(p => p.dept))];
    const sanctionedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + p.amount, 0);
    });
    const utilizedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + p.utilization, 0);
    });

    utilizationChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: depts.length ? depts : ['No Data'],
            datasets: [
                {
                    label: 'Sanctioned / Proposed (₹)',
                    data: sanctionedData.length ? sanctionedData : [0],
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                    borderWidth: 0
                },
                {
                    label: 'Utilized (₹)',
                    data: utilizedData.length ? utilizedData : [0],
                    backgroundColor: '#06b6d4',
                    borderRadius: 6,
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f3f4f6', font: { family: 'Plus Jakarta Sans', weight: '500' } }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9ca3af' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#9ca3af' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });

    const ctxPie = document.getElementById('ratioChart').getContext('2d');
    ratioChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['AAF (Academic Affiliation)', 'EQA (Equipment / Labs)'],
            datasets: [{
                data: [BUDGETS.AAF, BUDGETS.EQA],
                backgroundColor: ['#6366f1', '#06b6d4'],
                borderColor: 'rgba(17, 24, 39, 0.8)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f3f4f6', font: { family: 'Plus Jakarta Sans', weight: '500' } }
                }
            }
        }
    });
}

// Update Chart Data on modifications
function updateCharts() {
    if (!utilizationChart) return;

    const depts = [...new Set(proposals.map(p => p.dept))];
    const sanctionedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + p.amount, 0);
    });
    const utilizedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + p.utilization, 0);
    });

    utilizationChart.data.labels = depts.length ? depts : ['No Data'];
    utilizationChart.data.datasets[0].data = sanctionedData.length ? sanctionedData : [0];
    utilizationChart.data.datasets[1].data = utilizedData.length ? utilizedData : [0];
    
    utilizationChart.update();
}

// Render Table Rows
function renderProposals() {
    proposalsList.innerHTML = '';
    
    const filtered = proposals.filter(p => {
        const matchesQuery = p.comp.toLowerCase().includes(activeFilters.query.toLowerCase()) || 
                             p.dept.toLowerCase().includes(activeFilters.query.toLowerCase());
        const matchesCategory = activeFilters.category === 'all' || p.category === activeFilters.category;
        
        const dateVal = new Date(p.date);
        const startVal = activeFilters.startDate ? new Date(activeFilters.startDate) : null;
        const endVal = activeFilters.endDate ? new Date(activeFilters.endDate) : null;
        
        let matchesDate = true;
        if (startVal) matchesDate = matchesDate && (dateVal >= startVal);
        if (endVal) matchesDate = matchesDate && (dateVal <= endVal);

        return matchesQuery && matchesCategory && matchesDate;
    });

    if (filtered.length === 0) {
        proposalsList.innerHTML = `
            <tr>
                <td colspan="${currentUserRole === 'admin' ? 8 : 7}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No proposals match the current filter criteria.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(p => {
        const utilRatio = p.amount > 0 ? (p.utilization / p.amount) : 0;
        let statusBadge = '';
        if (utilRatio === 1) {
            statusBadge = `<span class="badge badge-success">Fully Utilized</span>`;
        } else if (utilRatio > 0.7) {
            statusBadge = `<span class="badge badge-warning">High Util. (${Math.round(utilRatio * 100)}%)</span>`;
        } else {
            statusBadge = `<span class="badge badge-aaf">Active (${Math.round(utilRatio * 100)}%)</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td><strong>${p.id}</strong></td>
            <td><span class="badge ${p.category === 'AAF' ? 'badge-aaf' : 'badge-eqa'}">${p.category}</span></td>
            <td>
                <div style="font-weight: 600;">${p.dept}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.comp}</div>
            </td>
            <td>${new Date(p.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}</td>
            <td>₹${parseFloat(p.amount).toLocaleString('en-IN')}</td>
            <td>₹${parseFloat(p.utilization).toLocaleString('en-IN')}</td>
            <td>${statusBadge}</td>
            ${currentUserRole === 'admin' ? `
            <td>
                <div class="action-buttons">
                    <button class="icon-btn icon-btn-edit" onclick="editProposal('${p.id}')" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="icon-btn icon-btn-delete" onclick="deleteProposal('${p.id}')" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>` : ''}
        `;
        proposalsList.appendChild(tr);
    });
}

// Global scope bindings for CRUD buttons inside table
window.editProposal = function(id) {
    if (currentUserRole !== 'admin') return;
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    formPanelTitle.textContent = `Edit Proposal #${proposal.id}`;
    document.getElementById('proposal-id-hidden').value = proposal.id;
    document.getElementById('proposal-category').value = proposal.category;
    document.getElementById('proposal-dept').value = proposal.dept;
    document.getElementById('proposal-comp').value = proposal.comp;
    document.getElementById('proposal-amount').value = proposal.amount;
    document.getElementById('proposal-utilization').value = proposal.utilization;
    document.getElementById('proposal-date').value = proposal.date;

    cancelFormBtn.style.display = 'block';
};

window.deleteProposal = async function(id) {
    if (currentUserRole !== 'admin') return;
    if (confirm("Are you sure you want to delete this proposal?")) {
        try {
            const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                await fetchProposals();
                resetFormState();
            } else {
                alert('Error deleting proposal from server.');
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    }
};

// Reset editing form state back to Add mode
function resetFormState() {
    formPanelTitle.textContent = "Create Budget Proposal";
    document.getElementById('proposal-id-hidden').value = "";
    proposalForm.reset();
    document.getElementById('proposal-date').value = "2026-04-20";
    cancelFormBtn.style.display = 'none';
}

// Render everything
function renderAll() {
    updateKPICards();
    renderProposals();
    updateCharts();
}

// Setup Event Listeners
function setupEvents() {
    // Filtering
    searchInput.addEventListener('input', (e) => {
        activeFilters.query = e.target.value;
        renderProposals();
    });

    categoryFilter.addEventListener('change', (e) => {
        activeFilters.category = e.target.value;
        renderProposals();
    });

    dateStartInput.addEventListener('change', (e) => {
        activeFilters.startDate = e.target.value;
        renderProposals();
    });

    dateEndInput.addEventListener('change', (e) => {
        activeFilters.endDate = e.target.value;
        renderProposals();
    });

    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = 'all';
        dateStartInput.value = '2026-04-01';
        dateEndInput.value = '2026-05-15';
        activeFilters = {
            query: '',
            category: 'all',
            startDate: '2026-04-01',
            endDate: '2026-05-15'
        };
        renderProposals();
    });

    // Form Reset
    cancelFormBtn.addEventListener('click', () => {
        resetFormState();
    });

    // Form Submit
    proposalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentUserRole !== 'admin') return;
        
        const hiddenId = document.getElementById('proposal-id-hidden').value;
        const category = document.getElementById('proposal-category').value;
        const dept = document.getElementById('proposal-dept').value;
        const comp = document.getElementById('proposal-comp').value;
        const amount = parseFloat(document.getElementById('proposal-amount').value);
        const utilization = parseFloat(document.getElementById('proposal-utilization').value);
        const date = document.getElementById('proposal-date').value;

        const payload = { category, dept, comp, amount, utilization, date };

        try {
            if (hiddenId) {
                // Edit Mode (PUT)
                const response = await fetch(`${API_BASE}/${encodeURIComponent(hiddenId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) await fetchProposals();
            } else {
                // Add Mode (POST)
                const categoryProposals = proposals.filter(p => p.category === category);
                const count = categoryProposals.length + 1;
                const newId = `${count}/${category}`;
                
                const response = await fetch(API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: newId, ...payload })
                });
                if (response.ok) await fetchProposals();
            }
        } catch (err) {
            console.error('Error saving proposal:', err);
        }

        resetFormState();
    });

    // Auth Form Login Submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = loginUsernameInput.value.trim().toLowerCase();
        const password = loginPasswordInput.value.trim();

        if (username === 'admin' && password === 'admin123') {
            authenticate('admin');
        } else if (username === 'viewer' && password === 'viewer123') {
            authenticate('viewer');
        } else {
            authErrorMsg.style.display = 'flex';
        }
    });

    // Logout Click
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('dean_user_role');
        currentUserRole = null;
        location.reload();
    });

    // Tab Navigation Events
    tabAnalyticsBtn.addEventListener('click', () => {
        tabAnalyticsBtn.classList.add('active');
        tabManageBtn.classList.remove('active');
        panelAnalytics.style.display = 'grid';
        panelManage.style.display = 'none';
        
        // Redraw charts because container size changes
        if (utilizationChart) utilizationChart.resize();
        if (ratioChart) ratioChart.resize();
    });

    tabManageBtn.addEventListener('click', () => {
        tabManageBtn.classList.add('active');
        tabAnalyticsBtn.classList.remove('active');
        panelAnalytics.style.display = 'none';
        panelManage.style.display = 'grid';
    });
}

// Perform Auth Layout Transition
function authenticate(role) {
    currentUserRole = role;
    sessionStorage.setItem('dean_user_role', role);
    authErrorMsg.style.display = 'none';
    loginForm.reset();
    
    checkSession();
    fetchProposals();
}

// Apply Security Toggles on layout
function checkSession() {
    if (currentUserRole) {
        authContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';

        // Render profile status
        userRoleText.textContent = currentUserRole === 'admin' ? 'Admin Profile' : 'Viewer Profile';
        userRoleIcon.className = currentUserRole === 'admin' ? 'fa-solid fa-user-shield' : 'fa-solid fa-user';

        // Toggles display panels for Admin vs Viewer
        const adminElements = document.querySelectorAll('.admin-only');
        const viewerElements = document.querySelectorAll('.viewer-only');

        if (currentUserRole === 'admin') {
            adminElements.forEach(el => el.style.display = '');
            viewerElements.forEach(el => el.style.display = 'none');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
            viewerElements.forEach(el => {
                if (el.tagName === 'DIV' || el.tagName === 'SECTION') {
                    el.style.display = 'flex';
                } else {
                    el.style.display = '';
                }
            });
        }
    } else {
        authContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
    }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    dateStartInput.value = activeFilters.startDate;
    dateEndInput.value = activeFilters.endDate;

    setupEvents();
    initCharts();
    checkSession();
    if (currentUserRole) {
        fetchProposals();
    }
    // Set initial date on form
    document.getElementById('proposal-date').value = "2026-04-20";
});
