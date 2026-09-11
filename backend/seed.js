require('dotenv').config();
const mongoose = require('mongoose');
const Island = require('./models/Island');
const Route = require('./models/Route');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pirate-navigation';

const islands = [
  { name: 'Skull Cove', lat: 12.5, lng: 77.8 },
  { name: 'Tortuga Bay', lat: 13.2, lng: 76.5 },
  { name: 'Port Royal', lat: 11.8, lng: 78.2 },
  { name: 'Isla de Muerta', lat: 14.0, lng: 75.8 },
  { name: 'Shipwreck Island', lat: 12.0, lng: 75.0 },
  { name: 'Dead Man\'s Pass', lat: 13.5, lng: 78.5 },
  { name: 'Buccaneer\'s Landing', lat: 14.5, lng: 77.2 },
  { name: 'Coral Reef Point', lat: 11.5, lng: 76.0 },
  { name: 'Storm Breaker', lat: 13.8, lng: 79.0 },
  { name: 'Emerald Isle', lat: 12.8, lng: 74.5 },
  { name: 'Black Flag Port', lat: 14.2, lng: 79.5 },
  { name: 'Mystic Shores', lat: 11.2, lng: 77.5 }
];

const routeDefs = [
  { from: 'Skull Cove', to: 'Tortuga Bay', distance: 85 },
  { from: 'Skull Cove', to: 'Port Royal', distance: 62 },
  { from: 'Skull Cove', to: 'Coral Reef Point', distance: 45 },
  { from: 'Tortuga Bay', to: 'Isla de Muerta', distance: 70 },
  { from: 'Tortuga Bay', to: 'Shipwreck Island', distance: 55 },
  { from: 'Port Royal', to: 'Dead Man\'s Pass', distance: 78 },
  { from: 'Port Royal', to: 'Skull Cove', distance: 62 },
  { from: 'Isla de Muerta', to: 'Buccaneer\'s Landing', distance: 50 },
  { from: 'Isla de Muerta', to: 'Storm Breaker', distance: 65 },
  { from: 'Shipwreck Island', to: 'Emerald Isle', distance: 90 },
  { from: 'Shipwreck Island', to: 'Coral Reef Point', distance: 40 },
  { from: 'Dead Man\'s Pass', to: 'Storm Breaker', distance: 35 },
  { from: 'Dead Man\'s Pass', to: 'Black Flag Port', distance: 58 },
  { from: 'Buccaneer\'s Landing', to: 'Skull Cove', distance: 110 },
  { from: 'Buccaneer\'s Landing', to: 'Black Flag Port', distance: 42 },
  { from: 'Coral Reef Point', to: 'Mystic Shores', distance: 48 },
  { from: 'Coral Reef Point', to: 'Shipwreck Island', distance: 40 },
  { from: 'Storm Breaker', to: 'Black Flag Port', distance: 30 },
  { from: 'Emerald Isle', to: 'Mystic Shores', distance: 72 },
  { from: 'Mystic Shores', to: 'Port Royal', distance: 55 },
  { from: 'Skull Cove', to: 'Dead Man\'s Pass', distance: 120 },
  { from: 'Tortuga Bay', to: 'Buccaneer\'s Landing', distance: 88 }
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
