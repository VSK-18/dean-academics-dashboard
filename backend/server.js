const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dean_acad';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB connection using Mongoose
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema & Model
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
        const jsonPath = path.join(__dirname, 'temp_proposals.json');
        const templatePath = 'C:\\Users\\bhamr\\Downloads\\AAF-EQA Budget Monitor_2026-27.xlsx';
        const outputPath = path.join(__dirname, 'output_excel.xlsx');
        
        fs.writeFileSync(jsonPath, JSON.stringify(proposals, null, 2), 'utf8');
        
        const scriptPath = path.join(__dirname, 'export_excel.py');
        exec(`python "${scriptPath}" "${jsonPath}" "${templatePath}" "${outputPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Export Script Error:', error);
                console.error('stderr:', stderr);
                return res.status(500).json({ error: 'Failed to run excel export helper: ' + error.message });
            }
            
            res.download(outputPath, 'AAF-EQA Budget Monitor_2026-27.xlsx', (err) => {
                // Clean up temp files
                try {
                    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                } catch (cleanErr) {
                    console.error('Error cleaning up temp files:', cleanErr);
                }
                if (err) {
                    console.error('Download error:', err);
                }
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
