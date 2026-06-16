const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { exportExcel } = require('./excel_exporter');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dean_acad';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB connection using Mongoose
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB successfully.');
        await seedDatabase();
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema & Models
const departmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    units: { type: Number, required: true }
});

const Department = mongoose.model('Department', departmentSchema);

const budgetHeadSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true } // 'AAF' or 'EQA'
});

const BudgetHead = mongoose.model('BudgetHead', budgetHeadSchema);

const proposalSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    comp: { type: String, required: true },
    dept: { type: String, required: true },
    subHead: { type: String, required: true },
    amountProposed: { type: Number, required: true },
    actualExpenditure: { type: Number, default: 0 },
    month: { type: String, required: true },
    remarks: { type: String, default: '' }
});

const Proposal = mongoose.model('Proposal', proposalSchema);

const DEFAULT_DEPARTMENTS = [
    { name: "Applied Science and Humanities", code: "ASH", units: 17 },
    { name: "Civil", code: "CIVIL", units: 5 },
    { name: "Computer Engineering", code: "COMP", units: 18 },
    { name: "CSE - AI-ML", code: "CSE", units: 7 },
    { name: "Computer Engineering - RL", code: "COMP(R)", units: 4 },
    { name: "Electronics and Telecommunication", code: "ETC", units: 11 },
    { name: "Information Technology", code: "IT", units: 10 },
    { name: "Mechanical Engineering and Workshop", code: "MECH", units: 18 },
    { name: "Master of Computer Applications", code: "MCA", units: 3 },
    { name: "Bachelor of Vocation", code: "BVOC", units: 1.5 },
    { name: "MDS", code: "MDS", units: 2.5 }
];

const DEFAULT_BUDGET_HEADS = [
    { code: "AAF/1", name: "Affiliation Fees to DTE, SPPU, AICTE, FRA, ARA, and similar regulating Bodies", category: "AAF" },
    { code: "AAF/2", name: "Academic Audit Expenses", category: "AAF" },
    { code: "AAF/3", name: "Expenses of Academic Council, BOS, DAB, PAC and similar meetings", category: "AAF" },
    { code: "AAF/4", name: "Printing of all R&R brochures, Booklets", category: "AAF" },
    { code: "AAF/5", name: "Guest lectures, academic workshops", category: "AAF" },
    { code: "AAF/6", name: "Any other expenses", category: "AAF" },
    { code: "EQA/1", name: "Lab Equipment", category: "EQA" },
    { code: "EQA/2", name: "Any other expenses", category: "EQA" }
];

async function seedDatabase() {
    try {
        const deptCount = await Department.countDocuments();
        if (deptCount === 0) {
            await Department.insertMany(DEFAULT_DEPARTMENTS);
            console.log('Seeded default departments.');
        }
        
        const headCount = await BudgetHead.countDocuments();
        if (headCount === 0) {
            await BudgetHead.insertMany(DEFAULT_BUDGET_HEADS);
            console.log('Seeded default budget heads.');
        }
    } catch (err) {
        console.error('Seeding database error:', err);
    }
}

// Departments CRUD
app.get('/api/departments', async (req, res) => {
    try {
        const departments = await Department.find({});
        res.json(departments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    const { name, code, units } = req.body;
    if (units !== undefined && Number(units) < 0) {
        return res.status(400).json({ error: 'Units cannot be negative' });
    }
    try {
        const updated = await Department.findByIdAndUpdate(
            id,
            { name, code, units: Number(units) },
            { new: true }
        );
        res.json({ message: 'Department updated successfully', department: updated });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Budget Heads CRUD
app.get('/api/budgetheads', async (req, res) => {
    try {
        const heads = await BudgetHead.find({});
        res.json(heads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/budgetheads', async (req, res) => {
    const { code, name, category } = req.body;
    if (!code || !name || !category) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const newHead = new BudgetHead({ code, name, category });
        await newHead.save();
        res.status(201).json({ message: 'Budget head created successfully', budgethead: newHead });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/budgetheads/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await BudgetHead.findByIdAndDelete(id);
        res.json({ message: 'Budget head deleted successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Department-wise Stats Allocation API
app.get('/api/stats/departments', async (req, res) => {
    try {
        const departments = await Department.find({}).lean();
        const proposals = await Proposal.find({}).lean();

        // Calculate total units (excluding contingency)
        let totalUnits = 0;
        departments.forEach(d => {
            totalUnits += d.units;
        });

        // Totals
        const aafTotal = 6200000;
        const eqaTotal = 10000000;
        const aafContingencyTotal = aafTotal * 0.1;
        const eqaContingencyTotal = eqaTotal * 0.1;
        const aafDividedTotal = aafTotal * 0.9;
        const eqaDividedTotal = eqaTotal * 0.9;

        // Initialize stats for each department
        const deptStats = departments.map(d => {
            const weight = totalUnits > 0 ? d.units / totalUnits : 0;
            return {
                _id: d._id,
                name: d.name,
                code: d.code,
                units: d.units,
                weight: weight,
                allocatedAAF: aafDividedTotal * weight,
                allocatedEQA: eqaDividedTotal * weight,
                proposedAAF: 0,
                proposedEQA: 0,
                utilizedAAF: 0,
                utilizedEQA: 0
            };
        });

        const contingency = {
            name: "Contingency",
            code: "Contingency",
            units: 0,
            weight: 0.1,
            allocatedAAF: aafContingencyTotal,
            allocatedEQA: eqaContingencyTotal,
            proposedAAF: 0,
            proposedEQA: 0,
            utilizedAAF: 0,
            utilizedEQA: 0
        };

        const findDeptStat = (deptValue) => {
            const dv = String(deptValue).trim().toLowerCase();
            return deptStats.find(d => 
                d.code.toLowerCase() === dv || 
                d.name.toLowerCase() === dv ||
                dv.includes(d.code.toLowerCase()) ||
                d.name.toLowerCase().includes(dv)
            );
        };

        proposals.forEach(p => {
            const amtProposed = Number(p.amountProposed) || 0;
            const amtUtilized = Number(p.actualExpenditure) || 0;
            const isAAF = p.category === 'AAF';
            const isEQA = p.category === 'EQA';
            const deptLower = String(p.dept).trim().toLowerCase();

            if (deptLower === 'all') {
                // Split proportionally among all departments
                deptStats.forEach(d => {
                    if (isAAF) {
                        d.proposedAAF += amtProposed * d.weight;
                        d.utilizedAAF += amtUtilized * d.weight;
                    } else if (isEQA) {
                        d.proposedEQA += amtProposed * d.weight;
                        d.utilizedEQA += amtUtilized * d.weight;
                    }
                });
            } else if (deptLower === 'contigency' || deptLower === 'contingency') {
                if (isAAF) {
                    contingency.proposedAAF += amtProposed;
                    contingency.utilizedAAF += amtUtilized;
                } else if (isEQA) {
                    contingency.proposedEQA += amtProposed;
                    contingency.utilizedEQA += amtUtilized;
                }
            } else {
                // Post directly to specific department
                const target = findDeptStat(p.dept);
                if (target) {
                    if (isAAF) {
                        target.proposedAAF += amtProposed;
                        target.utilizedAAF += amtUtilized;
                    } else if (isEQA) {
                        target.proposedEQA += amtProposed;
                        target.utilizedEQA += amtUtilized;
                    }
                }
            }
        });

        // Compute college totals
        let totalProposedAAF = 0;
        let totalProposedEQA = 0;
        let totalUtilizedAAF = 0;
        let totalUtilizedEQA = 0;

        deptStats.forEach(d => {
            totalProposedAAF += d.proposedAAF;
            totalProposedEQA += d.proposedEQA;
            totalUtilizedAAF += d.utilizedAAF;
            totalUtilizedEQA += d.utilizedEQA;
        });

        // Add contingency to totals
        totalProposedAAF += contingency.proposedAAF;
        totalProposedEQA += contingency.proposedEQA;
        totalUtilizedAAF += contingency.utilizedAAF;
        totalUtilizedEQA += contingency.utilizedEQA;

        const collegeSummary = {
            aaf: {
                total: aafTotal,
                proposed: totalProposedAAF,
                utilized: totalUtilizedAAF,
                balance: aafTotal - totalUtilizedAAF
            },
            eqa: {
                total: eqaTotal,
                proposed: totalProposedEQA,
                utilized: totalUtilizedEQA,
                balance: eqaTotal - totalUtilizedEQA
            }
        };

        res.json({
            departments: deptStats,
            contingency,
            collegeSummary
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API Routes

// 1. Get all proposals
app.get('/api/proposals', async (req, res) => {
    try {
        const proposals = await Proposal.find({});
        res.json(proposals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Add a new proposal
app.post('/api/proposals', async (req, res) => {
    const { id, category, date, comp, dept, subHead, amountProposed, actualExpenditure, month, remarks } = req.body;
    
    // Server-side validation
    if (!id || !category || !date || !comp || !dept || !subHead || amountProposed === undefined || !month) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    if (Number(amountProposed) < 0 || (actualExpenditure !== undefined && Number(actualExpenditure) < 0)) {
        return res.status(400).json({ error: 'Amounts cannot be negative' });
    }

    try {
        const newProposal = new Proposal({
            id, category, date, comp, dept, subHead,
            amountProposed: Number(amountProposed),
            actualExpenditure: actualExpenditure !== undefined ? Number(actualExpenditure) : 0,
            month, remarks: remarks || ''
        });
        await newProposal.save();
        res.status(201).json({ message: 'Proposal added successfully', id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Update an existing proposal
app.put('/api/proposals/:id', async (req, res) => {
    const { id } = req.params;
    const { category, date, comp, dept, subHead, amountProposed, actualExpenditure, month, remarks } = req.body;

    // Server-side validation
    if (amountProposed !== undefined && Number(amountProposed) < 0) {
        return res.status(400).json({ error: 'Proposed amount cannot be negative' });
    }
    if (actualExpenditure !== undefined && Number(actualExpenditure) < 0) {
        return res.status(400).json({ error: 'Actual expenditure cannot be negative' });
    }

    try {
        const updated = await Proposal.findOneAndUpdate(
            { id },
            {
                category, date, comp, dept, subHead,
                amountProposed: amountProposed !== undefined ? Number(amountProposed) : undefined,
                actualExpenditure: actualExpenditure !== undefined ? Number(actualExpenditure) : undefined,
                month, remarks
            },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        res.json({ message: 'Proposal updated successfully', proposal: updated });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 4. Delete a proposal
app.delete('/api/proposals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await Proposal.findOneAndDelete({ id });
        if (!deleted) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        res.json({ message: 'Proposal deleted successfully' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 5. Export proposals to Excel
app.get('/api/export', async (req, res) => {
    try {
        const proposals = await Proposal.find({});
        const templatePath = path.join(__dirname, 'templates', 'AAF-EQA Budget Monitor_2026-27.xlsx');
        const outputPath = path.join(__dirname, 'output_excel.xlsx');
        
        await exportExcel(proposals, templatePath, outputPath);
        
        res.download(outputPath, 'AAF-EQA Budget Monitor_2026-27.xlsx', (err) => {
            // Clean up temp output file
            try {
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (cleanErr) {
                console.error('Error cleaning up temp file:', cleanErr);
            }
            if (err) {
                console.error('Download error:', err);
            }
        });
    } catch (err) {
        console.error('Excel Export Error:', err);
        res.status(500).json({ error: 'Failed to run excel export helper: ' + err.message });
    }
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

module.exports = app;
