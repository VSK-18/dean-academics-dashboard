// Constants & Initial Budgets
const BUDGETS = {
    AAF: 6200000, // 62 Lakhs
    EQA: 10000000 // 1 Crore
};

const API_BASE = '/api/proposals';

// App State
let proposals = [];
let departments = [];
let budgetheads = [];
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
const tabDepartmentsBtn = document.getElementById('tab-departments-btn');
const panelAnalytics = document.getElementById('panel-analytics');
const panelManage = document.getElementById('panel-manage');
const panelDepartments = document.getElementById('panel-departments');

// Form inputs
const proposalCategory = document.getElementById('proposal-category');
const proposalDept = document.getElementById('proposal-dept');
const proposalSubhead = document.getElementById('proposal-subhead');
const proposalComp = document.getElementById('proposal-comp');
const proposalAmountProposed = document.getElementById('proposal-amount-proposed');
const proposalActualExpenditure = document.getElementById('proposal-actual-expenditure');
const proposalMonth = document.getElementById('proposal-month');
const proposalDate = document.getElementById('proposal-date');
const proposalRemarks = document.getElementById('proposal-remarks');
const fastFillingToggle = document.getElementById('fast-filling-toggle');

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

// Populate Subheads based on Category choice
function populateSubheads() {
    const category = proposalCategory.value;
    proposalSubhead.innerHTML = '';
    const filteredHeads = budgetheads.filter(h => h.category === category);
    filteredHeads.forEach(sh => {
        const opt = document.createElement('option');
        opt.value = sh.code;
        opt.textContent = `${sh.code}: ${sh.name}`;
        proposalSubhead.appendChild(opt);
    });
}

// Update sequential ID placeholder in the header
function updateGeneratedIdPlaceholder() {
    const hiddenId = document.getElementById('proposal-id-hidden').value;
    if (hiddenId) return; // Editing mode
    
    const category = proposalCategory.value;
    const categoryProposals = proposals.filter(p => p.category === category);
    const count = categoryProposals.length + 1;
    const generatedId = `${count}/${category}`;
    formPanelTitle.textContent = `Create Proposal #${generatedId}`;
}

// Load Lookups on startup
async function loadLookups() {
    try {
        const [deptRes, headsRes] = await Promise.all([
            fetch('/api/departments'),
            fetch('/api/budgetheads')
        ]);
        departments = deptRes.ok ? await deptRes.json() : [];
        budgetheads = headsRes.ok ? await headsRes.json() : [];

        populateDropdowns();
    } catch (err) {
        console.error('Error loading lookup data:', err);
    }
}

function populateDropdowns() {
    // Proposal department dropdown
    proposalDept.innerHTML = `
        <option value="All">All (Common Expense)</option>
        <option value="Contingency">Contingency (10%)</option>
    `;
    departments.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.code;
        opt.textContent = `${d.name} (${d.code})`;
        proposalDept.appendChild(opt);
    });

    // Config department select dropdown
    const configDeptSelect = document.getElementById('config-dept-select');
    if (configDeptSelect) {
        configDeptSelect.innerHTML = '';
        departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d._id;
            opt.textContent = `${d.name} (${d.code}) - ${d.units} Units`;
            configDeptSelect.appendChild(opt);
        });
    }

    populateSubheads();
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

// Fetch Department Stats & Render Table and KPI Cards
async function renderDepartmentStats() {
    try {
        const response = await fetch('/api/stats/departments');
        if (!response.ok) throw new Error('Failed to fetch department stats');
        const data = await response.json();

        // Update total units display
        let totalUnits = 0;
        data.departments.forEach(d => totalUnits += d.units);
        const totalUnitsDisplay = document.getElementById('total-units-display');
        if (totalUnitsDisplay) totalUnitsDisplay.textContent = totalUnits.toFixed(1);

        // Update department list table
        const deptListEl = document.getElementById('departments-list');
        if (!deptListEl) return;
        deptListEl.innerHTML = '';

        // Render normal departments
        data.departments.forEach(d => {
            const aafAlloc = d.allocatedAAF;
            const aafUtil = d.utilizedAAF;
            const aafBal = aafAlloc - aafUtil;
            
            const eqaAlloc = d.allocatedEQA;
            const eqaUtil = d.utilizedEQA;
            const eqaBal = eqaAlloc - eqaUtil;

            const totalAlloc = aafAlloc + eqaAlloc;
            const totalUtil = aafUtil + eqaUtil;
            const utilPct = totalAlloc > 0 ? (totalUtil / totalAlloc) * 100 : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${d.name} (${d.code})</strong></td>
                <td style="text-align: center;">${d.units}</td>
                <td style="text-align: center;">${(d.weight * 100).toFixed(2)}%</td>
                <td style="text-align: right;">₹${Math.round(aafAlloc).toLocaleString('en-IN')}</td>
                <td style="text-align: right; color: var(--warning);">₹${Math.round(aafUtil).toLocaleString('en-IN')}</td>
                <td style="text-align: right; color: ${aafBal >= 0 ? 'var(--success)' : 'var(--danger)'};">₹${Math.round(aafBal).toLocaleString('en-IN')}</td>
                <td style="text-align: right;">₹${Math.round(eqaAlloc).toLocaleString('en-IN')}</td>
                <td style="text-align: right; color: var(--warning);">₹${Math.round(eqaUtil).toLocaleString('en-IN')}</td>
                <td style="text-align: right; color: ${eqaBal >= 0 ? 'var(--success)' : 'var(--danger)'};">₹${Math.round(eqaBal).toLocaleString('en-IN')}</td>
                <td style="text-align: center;">
                    <span class="badge ${utilPct > 100 ? 'badge-warning' : 'badge-success'}">${utilPct.toFixed(1)}%</span>
                </td>
            `;
            deptListEl.appendChild(tr);
        });

        // Render Contingency row
        const c = data.contingency;
        const cTotalAlloc = c.allocatedAAF + c.allocatedEQA;
        const cTotalUtil = c.utilizedAAF + c.utilizedEQA;
        const cUtilPct = cTotalAlloc > 0 ? (cTotalUtil / cTotalAlloc) * 100 : 0;
        const cTr = document.createElement('tr');
        cTr.style.background = 'rgba(255, 255, 255, 0.02)';
        cTr.innerHTML = `
            <td><strong>Contingency Reserve (10%)</strong></td>
            <td style="text-align: center;">-</td>
            <td style="text-align: center;">10.00%</td>
            <td style="text-align: right;">₹${Math.round(c.allocatedAAF).toLocaleString('en-IN')}</td>
            <td style="text-align: right; color: var(--warning);">₹${Math.round(c.utilizedAAF).toLocaleString('en-IN')}</td>
            <td style="text-align: right; color: ${c.allocatedAAF - c.utilizedAAF >= 0 ? 'var(--success)' : 'var(--danger)'};">₹${Math.round(c.allocatedAAF - c.utilizedAAF).toLocaleString('en-IN')}</td>
            <td style="text-align: right;">₹${Math.round(c.allocatedEQA).toLocaleString('en-IN')}</td>
            <td style="text-align: right; color: var(--warning);">₹${Math.round(c.utilizedEQA).toLocaleString('en-IN')}</td>
            <td style="text-align: right; color: ${c.allocatedEQA - c.utilizedEQA >= 0 ? 'var(--success)' : 'var(--danger)'};">₹${Math.round(c.allocatedEQA - c.utilizedEQA).toLocaleString('en-IN')}</td>
            <td style="text-align: center;">
                <span class="badge ${cUtilPct > 100 ? 'badge-warning' : 'badge-success'}">${cUtilPct.toFixed(1)}%</span>
            </td>
        `;
        deptListEl.appendChild(cTr);

        // Update overall KPI cards on dashboard
        const summary = data.collegeSummary;
        document.getElementById('stat-total-budget').textContent = formatCurrency(summary.aaf.total + summary.eqa.total);
        
        document.getElementById('stat-aaf-budget').textContent = formatCurrency(summary.aaf.total);
        document.getElementById('stat-aaf-utilized').textContent = formatCurrency(summary.aaf.utilized);
        const aafPct = (summary.aaf.utilized / summary.aaf.total) * 100;
        document.getElementById('stat-aaf-percent').textContent = `${aafPct.toFixed(1)}%`;
        document.getElementById('stat-aaf-progress').style.width = `${aafPct}%`;

        document.getElementById('stat-eqa-budget').textContent = formatCurrency(summary.eqa.total);
        document.getElementById('stat-eqa-utilized').textContent = formatCurrency(summary.eqa.utilized);
        const eqaPct = (summary.eqa.utilized / summary.eqa.total) * 100;
        document.getElementById('stat-eqa-percent').textContent = `${eqaPct.toFixed(1)}%`;
        document.getElementById('stat-eqa-progress').style.width = `${eqaPct}%`;

        const totalUtilized = summary.aaf.utilized + summary.eqa.utilized;
        const totalBudget = summary.aaf.total + summary.eqa.total;
        const totalPct = (totalUtilized / totalBudget) * 100;
        document.getElementById('stat-total-percent').textContent = `${totalPct.toFixed(1)}% Utilized`;

        // Update AAF split progress bar & text (Contingency vs Divided)
        const divVal = summary.aaf.total * 0.9;
        const conVal = summary.aaf.total * 0.1;
        document.getElementById('stat-contingency-val').textContent = formatCurrency(conVal);
        document.getElementById('stat-divided-val').textContent = formatCurrency(divVal);

    } catch (err) {
        console.error('Error rendering department stats:', err);
    }
}

// Initializing Charts
function initCharts() {
    const ctxBar = document.getElementById('utilizationChart').getContext('2d');
    
    const depts = [...new Set(proposals.map(p => p.dept))];
    const sanctionedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + (p.amountProposed || 0), 0);
    });
    const utilizedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + (p.actualExpenditure || 0), 0);
    });

    utilizationChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: depts.length ? depts : ['No Data'],
            datasets: [
                {
                    label: 'Proposed (₹)',
                    data: sanctionedData.length ? sanctionedData : [0],
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                    borderWidth: 0
                },
                {
                    label: 'Actual Expenditure (₹)',
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
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + (p.amountProposed || 0), 0);
    });
    const utilizedData = depts.map(d => {
        return proposals.filter(p => p.dept === d).reduce((sum, p) => sum + (p.actualExpenditure || 0), 0);
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
        const matchesQuery = (p.comp || '').toLowerCase().includes(activeFilters.query.toLowerCase()) || 
                             (p.dept || '').toLowerCase().includes(activeFilters.query.toLowerCase()) || 
                             (p.subHead || '').toLowerCase().includes(activeFilters.query.toLowerCase());
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
                <td colspan="${currentUserRole === 'admin' ? 10 : 9}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No proposals match the current filter criteria.
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(p => {
        const proposed = parseFloat(p.amountProposed || 0);
        const actual = parseFloat(p.actualExpenditure || 0);
        const utilRatio = proposed > 0 ? (actual / proposed) : 0;
        
        let statusClass = 'badge-aaf';
        let statusText = 'Active';
        if (actual > proposed) {
            statusClass = 'badge-warning';
            statusText = `Overspent (${Math.round(utilRatio * 100)}%)`;
        } else if (utilRatio === 1) {
            statusClass = 'badge-success';
            statusText = 'Fully Utilized';
        } else if (utilRatio > 0.7) {
            statusClass = 'badge-warning';
            statusText = `High Util. (${Math.round(utilRatio * 100)}%)`;
        } else {
            statusClass = 'badge-aaf';
            statusText = `Active (${Math.round(utilRatio * 100)}%)`;
        }

        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.innerHTML = `
            <td><strong>${p.id}</strong></td>
            <td><span class="badge ${p.category === 'AAF' ? 'badge-aaf' : 'badge-eqa'}">${p.category}</span></td>
            <td><code style="font-weight: 600; color: var(--primary);">${p.subHead || ''}</code></td>
            <td>
                <div style="font-weight: 600;">${p.dept}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.comp}</div>
            </td>
            <td>${new Date(p.date).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})}</td>
            <td>₹${proposed.toLocaleString('en-IN')}</td>
            <td>₹${actual.toLocaleString('en-IN')}</td>
            <td>${p.month || ''}</td>
            <td style="font-size: 0.8rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.remarks || ''}">${p.remarks || ''}</td>
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
    proposalCategory.value = proposal.category;
    populateSubheads();
    
    proposalDept.value = proposal.dept;
    proposalSubhead.value = proposal.subHead;
    proposalComp.value = proposal.comp;
    proposalAmountProposed.value = proposal.amountProposed;
    proposalActualExpenditure.value = proposal.actualExpenditure;
    proposalMonth.value = proposal.month;
    proposalDate.value = proposal.date;
    proposalRemarks.value = proposal.remarks || '';

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
    
    // Clear description, amount, actual exp, remarks
    proposalComp.value = "";
    proposalAmountProposed.value = "";
    proposalActualExpenditure.value = "";
    proposalRemarks.value = "";
    
    cancelFormBtn.style.display = 'none';
    updateGeneratedIdPlaceholder();
}

// Render everything
function renderAll() {
    renderDepartmentStats();
    renderProposals();
    updateCharts();
    updateGeneratedIdPlaceholder();
}

// Setup Event Listeners
function setupEvents() {
    // Populate subheads initially and when category changes
    proposalCategory.addEventListener('change', () => {
        populateSubheads();
        updateGeneratedIdPlaceholder();
    });

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
        const category = proposalCategory.value;
        const dept = proposalDept.value;
        const comp = proposalComp.value.trim();
        const subHead = proposalSubhead.value;
        const amountProposed = parseFloat(proposalAmountProposed.value);
        const actualExpenditure = parseFloat(proposalActualExpenditure.value || 0);
        const month = proposalMonth.value;
        const date = proposalDate.value;
        const remarks = proposalRemarks.value.trim();

        // client-side validation logic
        if (amountProposed < 0 || actualExpenditure < 0) {
            alert("Proposed amount and actual expenditure cannot be negative.");
            return;
        }

        if (actualExpenditure > amountProposed) {
            const proceed = confirm(`Warning: Actual expenditure (${actualExpenditure}) is greater than the Proposed amount (${amountProposed}). Do you want to save this proposal anyway?`);
            if (!proceed) return;
        }

        const payload = { category, dept, comp, subHead, amountProposed, actualExpenditure, month, date, remarks };

        try {
            if (hiddenId) {
                // Edit Mode (PUT)
                const response = await fetch(`${API_BASE}/${encodeURIComponent(hiddenId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    await fetchProposals();
                    resetFormState();
                } else {
                    const errObj = await response.json();
                    alert(`Error: ${errObj.error}`);
                }
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
                if (response.ok) {
                    await fetchProposals();
                    
                    if (fastFillingToggle.checked) {
                        // Fast Filling Mode: clear only specific inputs and keep the rest
                        proposalComp.value = "";
                        proposalAmountProposed.value = "";
                        proposalActualExpenditure.value = "";
                        proposalRemarks.value = "";
                        // Auto increment count and focus on comp
                        updateGeneratedIdPlaceholder();
                        proposalComp.focus();
                    } else {
                        resetFormState();
                    }
                } else {
                    const errObj = await response.json();
                    alert(`Error: ${errObj.error}`);
                }
            }
        } catch (err) {
            console.error('Error saving proposal:', err);
        }
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
        tabDepartmentsBtn.classList.remove('active');
        panelAnalytics.style.display = 'grid';
        panelManage.style.display = 'none';
        panelDepartments.style.display = 'none';
        
        // Redraw charts because container size changes
        if (utilizationChart) utilizationChart.resize();
        if (ratioChart) ratioChart.resize();
    });

    tabManageBtn.addEventListener('click', () => {
        tabManageBtn.classList.add('active');
        tabAnalyticsBtn.classList.remove('active');
        tabDepartmentsBtn.classList.remove('active');
        panelAnalytics.style.display = 'none';
        panelManage.style.display = 'grid';
        panelDepartments.style.display = 'none';
    });

    tabDepartmentsBtn.addEventListener('click', () => {
        tabDepartmentsBtn.classList.add('active');
        tabAnalyticsBtn.classList.remove('active');
        tabManageBtn.classList.remove('active');
        panelAnalytics.style.display = 'none';
        panelManage.style.display = 'none';
        panelDepartments.style.display = 'grid';
        
        renderDepartmentStats();
    });

    // Admin Units Update Form
    const deptUnitsForm = document.getElementById('dept-units-form');
    if (deptUnitsForm) {
        deptUnitsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (currentUserRole !== 'admin') return;
            const deptId = document.getElementById('config-dept-select').value;
            const units = parseFloat(document.getElementById('config-dept-units').value);
            if (isNaN(units) || units < 0) {
                alert('Please enter a valid non-negative unit count.');
                return;
            }

            try {
                const response = await fetch(`/api/departments/${deptId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ units })
                });
                if (response.ok) {
                    alert('Department units updated successfully!');
                    await loadLookups();
                    await renderDepartmentStats();
                    await fetchProposals(); // refresh table & charts
                } else {
                    const err = await response.json();
                    alert(`Error updating department units: ${err.error}`);
                }
            } catch (err) {
                console.error('Error updating units:', err);
            }
        });
    }

    // Admin Budget Head Add Form
    const budgetHeadForm = document.getElementById('budget-head-form');
    if (budgetHeadForm) {
        budgetHeadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (currentUserRole !== 'admin') return;
            const category = document.getElementById('config-head-category').value;
            const code = document.getElementById('config-head-code').value.trim();
            const name = document.getElementById('config-head-name').value.trim();

            if (!code || !name) {
                alert('Please enter a valid code and description.');
                return;
            }

            try {
                const response = await fetch('/api/budgetheads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, code, name })
                });
                if (response.ok) {
                    alert('Budget head created successfully!');
                    document.getElementById('config-head-code').value = '';
                    document.getElementById('config-head-name').value = '';
                    await loadLookups();
                    await fetchProposals(); // refresh table & charts
                } else {
                    const err = await response.json();
                    alert(`Error adding budget head: ${err.error}`);
                }
            } catch (err) {
                console.error('Error adding budget head:', err);
            }
        });
    }
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
document.addEventListener('DOMContentLoaded', async () => {
    dateStartInput.value = activeFilters.startDate;
    dateEndInput.value = activeFilters.endDate;

    await loadLookups();
    setupEvents();
    initCharts();
    checkSession();
    if (currentUserRole) {
        fetchProposals();
        renderDepartmentStats();
    }
    // Set initial date on form
    document.getElementById('proposal-date').value = "2026-04-20";
});
