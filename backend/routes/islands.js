const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Island = require('../models/Island');
const inMemoryDb = require('../utils/inMemoryDb');

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(inMemoryDb.getIslands());
    }
    const islands = await Island.find().sort({ name: 1 });
    res.json(islands);
  } catch (err) {
    res.json(inMemoryDb.getIslands());
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const isl = inMemoryDb.getIslandById(req.params.id);
      return isl ? res.json(isl) : res.status(404).json({ error: 'Island not found' });
    }
    const island = await Island.findById(req.params.id);
    if (!island) return res.status(404).json({ error: 'Island not found' });
    res.json(island);
  } catch (err) {
    const isl = inMemoryDb.getIslandById(req.params.id);
    return isl ? res.json(isl) : res.status(404).json({ error: 'Island not found' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const newPlace = inMemoryDb.addIsland(req.body);
      return res.status(201).json(newPlace);
    }
    const island = new Island(req.body);
    await island.save();
    res.status(201).json(island);
  } catch (err) {
    const newPlace = inMemoryDb.addIsland(req.body);
    res.status(201).json(newPlace);
  }
});

router.patch('/:id/hazard', async (req, res) => {
  try {
    const { hazardStatus } = req.body;
    if (mongoose.connection.readyState !== 1) {
      const updated = inMemoryDb.updateIslandHazard(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Island not found' });
      return res.json(updated);
    }
    const island = await Island.findByIdAndUpdate(
      req.params.id,
      { hazardStatus },
      { new: true }
    );
    if (!island) return res.status(404).json({ error: 'Island not found' });
    res.json(island);
  } catch (err) {
    const updated = inMemoryDb.updateIslandHazard(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Island not found' });
    res.json(updated);
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
