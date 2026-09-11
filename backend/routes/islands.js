const express = require('express');
const router = express.Router();
const Island = require('../models/Island');

router.get('/', async (req, res) => {
  try {
    const islands = await Island.find().sort({ name: 1 });
    res.json(islands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const island = await Island.findById(req.params.id);
    if (!island) return res.status(404).json({ error: 'Island not found' });
    res.json(island);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const island = new Island(req.body);
    await island.save();
    res.status(201).json(island);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const island = await Island.findByIdAndDelete(req.params.id);
    if (!island) return res.status(404).json({ error: 'Island not found' });
    res.json({ message: 'Island deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
