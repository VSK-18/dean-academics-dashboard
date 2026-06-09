// Developed by Vishwajeet Bhamre on 2026-06-09 22:24
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/dean_acad';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB connection using Mongoose
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully.'))
    .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema & Model
const proposalSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    dept: { type: String, required: true },
    comp: { type: String, required: true },
    amount: { type: Number, required: true },
    utilization: { type: Number, required: true },
    date: { type: String, required: true }
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
    const { id, category, dept, comp, amount, utilization, date } = req.body;
    try {
        const newProposal = new Proposal({ id, category, dept, comp, amount, utilization, date });
        await newProposal.save();
        res.status(201).json({ message: 'Proposal added successfully', id });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Update an existing proposal
app.put('/api/proposals/:id', async (req, res) => {
    const { id } = req.params;
    const { category, dept, comp, amount, utilization, date } = req.body;
    try {
        const updated = await Proposal.findOneAndUpdate(
            { id },
            { category, dept, comp, amount, utilization, date },
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
