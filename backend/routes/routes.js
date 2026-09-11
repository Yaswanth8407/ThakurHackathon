const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Route = require('../models/Route');
const inMemoryDb = require('../utils/inMemoryDb');

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(inMemoryDb.getRoutes());
    }
    const routes = await Route.find()
      .populate('fromIsland', 'name lat lng')
      .populate('toIsland', 'name lat lng');
    res.json(routes);
  } catch (err) {
    res.json(inMemoryDb.getRoutes());
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const r = inMemoryDb.getRouteById(req.params.id);
      return r ? res.json(r) : res.status(404).json({ error: 'Route not found' });
    }
    const route = await Route.findById(req.params.id)
      .populate('fromIsland', 'name lat lng')
      .populate('toIsland', 'name lat lng');
    if (!route) return res.status(404).json({ error: 'Route not found' });
    res.json(route);
  } catch (err) {
    const r = inMemoryDb.getRouteById(req.params.id);
    return r ? res.json(r) : res.status(404).json({ error: 'Route not found' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const newRoute = inMemoryDb.addRoute(req.body);
      return res.status(201).json(newRoute);
    }
    const route = new Route(req.body);
    await route.save();
    const populated = await route.populate('fromIsland toIsland', 'name lat lng');
    res.status(201).json(populated);
  } catch (err) {
    const newRoute = inMemoryDb.addRoute(req.body);
    res.status(201).json(newRoute);
  }
});

router.patch('/:id/hazard', async (req, res) => {
  try {
    const { isHazard, isPatrolZone, hazardStatus } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const updated = inMemoryDb.updateRouteHazard(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Route not found' });
      return res.json(updated);
    }

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
    const updated = inMemoryDb.updateRouteHazard(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Route not found' });
    res.json(updated);
  }
});

router.post('/reset', (req, res) => {
  inMemoryDb.resetInMemory();
  res.json({ message: 'Archipelago waters reset to baseline' });
});

module.exports = router;
