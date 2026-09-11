require('dotenv').config();
const mongoose = require('mongoose');
const Island = require('./models/Island');
const Route = require('./models/Route');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pirate-navigation';

const islands = [
  { name: 'Kavaratti', lat: 10.5667, lng: 72.6417 },
  { name: 'Agatti', lat: 10.8533, lng: 72.1947 },
  { name: 'Bangaram', lat: 10.9400, lng: 72.2900 },
  { name: 'Minicoy', lat: 8.2833, lng: 73.0500 },
  { name: 'Kalpeni', lat: 10.0833, lng: 73.6500 },
  { name: 'Andrott', lat: 10.8167, lng: 73.6667 },
  { name: 'Amini', lat: 11.1242, lng: 72.7317 },
  { name: 'Kadmat', lat: 11.2333, lng: 72.7833 },
  { name: 'Kiltan', lat: 11.4833, lng: 73.0000 },
  { name: 'Chetlat', lat: 11.6833, lng: 72.7000 },
  { name: 'Bitra', lat: 11.6000, lng: 72.1833 },
  { name: 'Suheli Par', lat: 10.0833, lng: 72.2833 }
];

const routeDefs = [
  { from: 'Agatti', to: 'Bangaram', distance: 7.2, hazardStatus: 'Clear' },
  { from: 'Agatti', to: 'Kavaratti', distance: 32.4, hazardStatus: 'Clear' },
  { from: 'Bangaram', to: 'Amini', distance: 28.5, hazardStatus: 'Clear' },
  { from: 'Amini', to: 'Kadmat', distance: 7.1, hazardStatus: 'Clear' },
  { from: 'Kadmat', to: 'Kiltan', distance: 20.3, hazardStatus: 'Clear' },
  { from: 'Kiltan', to: 'Chetlat', distance: 21.6, hazardStatus: 'Clear' },
  { from: 'Chetlat', to: 'Bitra', distance: 31.0, hazardStatus: 'Clear' },
  { from: 'Bitra', to: 'Bangaram', distance: 40.2, hazardStatus: 'Clear' },
  { from: 'Amini', to: 'Kavaratti', distance: 34.0, hazardStatus: 'Clear' },
  { from: 'Kadmat', to: 'Andrott', distance: 57.2, hazardStatus: 'Clear' },
  { from: 'Kavaratti', to: 'Andrott', distance: 62.1, hazardStatus: 'Clear' },
  { from: 'Andrott', to: 'Kalpeni', distance: 44.0, hazardStatus: 'Clear' },
  { from: 'Kavaratti', to: 'Kalpeni', distance: 67.4, hazardStatus: 'Clear' },
  { from: 'Kavaratti', to: 'Suheli Par', distance: 35.8, hazardStatus: 'Clear' },
  { from: 'Suheli Par', to: 'Minicoy', distance: 118.2, hazardStatus: 'Clear' },
  { from: 'Kalpeni', to: 'Minicoy', distance: 114.5, hazardStatus: 'Clear' },
  { from: 'Kavaratti', to: 'Minicoy', distance: 139.0, hazardStatus: 'Clear' }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await Island.deleteMany({});
    await Route.deleteMany({});
    console.log('Cleared existing data');

    const savedIslands = await Island.insertMany(islands);
    console.log(`Seeded ${savedIslands.length} islands`);

    const nameToId = {};
    savedIslands.forEach(island => {
      nameToId[island.name] = island._id;
    });

    const routes = routeDefs.map(def => ({
      fromIsland: nameToId[def.from],
      toIsland: nameToId[def.to],
      distance: def.distance,
      speed: 10
    }));

    const savedRoutes = await Route.insertMany(routes);
    console.log(`Seeded ${savedRoutes.length} routes`);

    console.log('\nIslands:');
    savedIslands.forEach(i => console.log(`  ${i.name}: (${i.lat}, ${i.lng})`));
    console.log('\nRoutes:');
    savedRoutes.forEach(r => {
      const from = savedIslands.find(i => i._id.equals(r.fromIsland));
      const to = savedIslands.find(i => i._id.equals(r.toIsland));
      console.log(`  ${from.name} <-> ${to.name}: ${r.distance}nm`);
    });

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
