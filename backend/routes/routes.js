const express = require('express');
const router = express.Router();
const Route = require('../models/Route');

router.get('/', async (req, res) => {
  try {
    const routes = await Route.find()
      .populate('fromIsland', 'name lat lng')
      .populate('toIsland', 'name lat lng');
    res.json(routes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const route = await Route.findById(req.params.id)
      .populate('fromIsland', 'name lat lng')
      .populate('toIsland', 'name lat lng');
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const route = new Route(req.body);
    await route.save();
    const populated = await route.populate('fromIsland toIsland', 'name lat lng');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id/hazard', async (req, res) => {
  try {
    const { isHazard, isPatrolZone } = req.body;
    const update = {};
    if (typeof isHazard === 'boolean') update.isHazard = isHazard;
    if (typeof isPatrolZone === 'boolean') update.isPatrolZone = isPatrolZone;

    const route = await Route.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('fromIsland toIsland', 'name lat lng');

    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const route = await Route.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
