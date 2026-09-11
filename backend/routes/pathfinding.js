const express = require('express');
const router = express.Router();
const Island = require('../models/Island');
const Route = require('../models/Route');
const dijkstra = require('../utils/dijkstra');

router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
    }

    if (from === to) {
      return res.status(400).json({ error: 'Departure and destination cannot be the same' });
    }

    const [island, destination] = await Promise.all([
      Island.findById(from),
      Island.findById(to)
    ]);

    if (!island) return res.status(404).json({ error: 'Departure island not found' });
    if (!destination) return res.status(404).json({ error: 'Destination island not found' });

    const [allIslands, allRoutes] = await Promise.all([
      Island.find(),
      Route.find()
    ]);

    const result = dijkstra(allIslands, allRoutes, from, to);

    if (!result) {
      return res.json({
        path: [],
        totalDistance: 0,
        estimatedTimeHours: 0,
        message: 'No safe route found between these islands'
      });
    }

    const avgSpeed = 10;
    const estimatedTimeHours = parseFloat((result.totalDistance / avgSpeed).toFixed(2));

    res.json({
      path: result.path,
      totalDistance: parseFloat(result.totalDistance.toFixed(2)),
      estimatedTimeHours
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
