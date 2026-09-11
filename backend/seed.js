require('dotenv').config();
const mongoose = require('mongoose');
const Island = require('./models/Island');
const Route = require('./models/Route');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pirate-navigation';

const islands = [
  { name: 'Colaba', lat: 18.9067, lng: 72.8147 },
  { name: 'Marine Drive', lat: 18.9438, lng: 72.8232 },
  { name: 'Dadar', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
  { name: 'Kurla', lat: 19.0726, lng: 72.8845 },
  { name: 'Ghatkopar', lat: 19.0860, lng: 72.9090 },
  { name: 'Andheri', lat: 19.1197, lng: 72.8464 },
  { name: 'Borivali', lat: 19.2307, lng: 72.8567 },
  { name: 'Thane', lat: 19.2183, lng: 72.9781 },
  { name: 'Vashi', lat: 19.0771, lng: 72.9986 },
  { name: 'Trombay', lat: 19.0160, lng: 72.9150 },
  { name: 'Elephanta Island', lat: 18.9633, lng: 72.9315 }
];

const routeDefs = [
  { from: 'Colaba', to: 'Marine Drive', distance: 4.5 },
  { from: 'Colaba', to: 'Elephanta Island', distance: 11.2 },
  { from: 'Marine Drive', to: 'Dadar', distance: 9.2 },
  { from: 'Dadar', to: 'Bandra', distance: 5.1 },
  { from: 'Dadar', to: 'Kurla', distance: 7.3 },
  { from: 'Bandra', to: 'Kurla', distance: 6.8 },
  { from: 'Bandra', to: 'Andheri', distance: 8.4 },
  { from: 'Kurla', to: 'Ghatkopar', distance: 4.2 },
  { from: 'Kurla', to: 'Andheri', distance: 8.1 },
  { from: 'Kurla', to: 'Trombay', distance: 7.5 },
  { from: 'Trombay', to: 'Elephanta Island', distance: 7.2 },
  { from: 'Trombay', to: 'Vashi', distance: 12.5 },
  { from: 'Ghatkopar', to: 'Vashi', distance: 14.0 },
  { from: 'Ghatkopar', to: 'Thane', distance: 16.5 },
  { from: 'Andheri', to: 'Borivali', distance: 13.8 },
  { from: 'Borivali', to: 'Thane', distance: 18.2 },
  { from: 'Thane', to: 'Vashi', distance: 15.5 },
  { from: 'Andheri', to: 'Ghatkopar', distance: 7.8 },
  { from: 'Colaba', to: 'Dadar', distance: 13.5 },
  { from: 'Dadar', to: 'Trombay', distance: 11.0 }
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
