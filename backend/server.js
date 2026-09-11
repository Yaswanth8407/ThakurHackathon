require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pirate-navigation';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const islandsRouter = require('./routes/islands');
const routesRouter = require('./routes/routes');
const pathfindingRouter = require('./routes/pathfinding');

app.use('/api/islands', islandsRouter);
app.use('/api/routes', routesRouter);
app.use('/api/path', pathfindingRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

console.log(`[INIT] Connecting to MongoDB at ${MONGODB_URI}...`);
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 2000,
  connectTimeoutMS: 2000
})
  .then(() => {
    console.log('[DB] Connected to MongoDB database successfully.');
  })
  .catch(err => {
    console.warn(`[DB] MongoDB offline (${err.message}). Using autonomous Mumbai in-memory storage.`);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`
============================================================
      THE PIRATE NAVIGATION SYSTEM — MUMBAI EDITION
============================================================
  Server Port:      ${PORT}
  API Endpoints:    http://localhost:${PORT}/api
  Frontend App:     http://localhost:${PORT}/
  Distance Units:   Kilometers (km)
  Network Nodes:    Mumbai Corridors (Kurla, Thane, Colaba...)
============================================================
      `);
    });
  });
