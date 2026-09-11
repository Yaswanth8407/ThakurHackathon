const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Island = require('../models/Island');
const Route = require('../models/Route');
const dijkstra = require('../utils/dijkstra');
const inMemoryDb = require('../utils/inMemoryDb');

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }

    if (from === to) {
      return res.status(400).json({ error: 'Departure and destination cannot be the same' });
    }

    let allIslands = [];
    let allRoutes = [];

    if (mongoose.connection.readyState !== 1) {
      allIslands = inMemoryDb.getIslands();
      allRoutes = inMemoryDb.getRoutes();
    } else {
      try {
        const [islands, routes] = await Promise.all([
          Island.find(),
          Route.find()
        ]);
        allIslands = islands;
        allRoutes = routes;
      } catch (e) {
        allIslands = inMemoryDb.getIslands();
        allRoutes = inMemoryDb.getRoutes();
      }
    }

    const depFound = allIslands.find(i => String(i._id) === String(from));
    const destFound = allIslands.find(i => String(i._id) === String(to));

    if (!depFound) return res.status(404).json({ error: 'Departure location not found' });
    if (!destFound) return res.status(404).json({ error: 'Destination location not found' });

    const result = dijkstra(allIslands, allRoutes, from, to);

    if (!result) {
      return res.json({
        path: [],
        totalDistance: 0,
        estimatedTimeHours: 0,
        estimatedDaysAtSea: '0.0 days',
        riskHazardFactor: '100% (Blocked)',
        message: 'All viable routes are completely blocked! No safe sea passage found.'
      });
    }

    const speedKnots = req.query.speed ? Math.max(1, parseFloat(req.query.speed)) : 10;
    const estimatedTimeHours = parseFloat((result.totalDistance / speedKnots).toFixed(2));
    const estimatedDaysAtSea = parseFloat((estimatedTimeHours / 24).toFixed(1));

    res.json({
      path: result.path,
      totalDistance: parseFloat(result.totalDistance.toFixed(1)),
      speedKnots,
      estimatedTimeHours,
      estimatedDaysAtSea: `${estimatedDaysAtSea} days (${estimatedTimeHours} hrs)`,
      riskHazardFactor: `${result.riskHazardFactor}%`,
      isForcedBlocked: Boolean(result.isForcedBlocked),
      legs: result.legs.map(l => ({
        from: l.from,
        to: l.to,
        distance: l.distance,
        hazardStatus: l.route?.hazardStatus || (l.route?.isPatrolZone ? 'Blocked' : l.route?.isHazard ? 'Storm-battered' : 'Clear')
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
