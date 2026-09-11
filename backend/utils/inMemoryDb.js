/**
 * The Pirate Navigation System - Mumbai In-Memory Store
 * Used when MongoDB is offline to ensure 100% server uptime and zero demo failure.
 */

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const DEFAULT_MUMBAI_ISLANDS = [
  { _id: '65f000000000000000000001', name: 'Colaba', lat: 18.9067, lng: 72.8147 },
  { _id: '65f000000000000000000002', name: 'Marine Drive', lat: 18.9438, lng: 72.8232 },
  { _id: '65f000000000000000000003', name: 'Dadar', lat: 19.0178, lng: 72.8478 },
  { _id: '65f000000000000000000004', name: 'Bandra', lat: 19.0596, lng: 72.8295 },
  { _id: '65f000000000000000000005', name: 'Kurla', lat: 19.0726, lng: 72.8845 },
  { _id: '65f000000000000000000006', name: 'Ghatkopar', lat: 19.0860, lng: 72.9090 },
  { _id: '65f000000000000000000007', name: 'Andheri', lat: 19.1197, lng: 72.8464 },
  { _id: '65f000000000000000000008', name: 'Borivali', lat: 19.2307, lng: 72.8567 },
  { _id: '65f000000000000000000009', name: 'Thane', lat: 19.2183, lng: 72.9781 },
  { _id: '65f00000000000000000000a', name: 'Vashi', lat: 19.0771, lng: 72.9986 },
  { _id: '65f00000000000000000000b', name: 'Trombay', lat: 19.0160, lng: 72.9150 },
  { _id: '65f00000000000000000000c', name: 'Elephanta Island', lat: 18.9633, lng: 72.9315 }
];

const DEFAULT_MUMBAI_ROUTE_DEFS = [
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

let memIslands = [];
let memRoutes = [];

function resetInMemory() {
  memIslands = JSON.parse(JSON.stringify(DEFAULT_MUMBAI_ISLANDS));
  const islandMap = {};
  memIslands.forEach(i => (islandMap[i.name] = i));

  memRoutes = DEFAULT_MUMBAI_ROUTE_DEFS.map((def, idx) => {
    const from = islandMap[def.from];
    const to = islandMap[def.to];
    const hex = (8000 + idx + 1).toString(16).padStart(24, '0');
    return {
      _id: hex,
      fromIsland: from,
      toIsland: to,
      distance: def.distance,
      speed: 30,
      isHazard: false,
      isPatrolZone: false
    };
  });
}

resetInMemory();

module.exports = {
  calculateHaversineKm,
  getIslands: () => memIslands,
  getIslandById: id => memIslands.find(i => String(i._id) === String(id)),
  addIsland: island => {
    const hex = (memIslands.length + 1).toString(16).padStart(24, '0');
    const newIsland = {
      _id: hex,
      name: island.name,
      lat: Number(island.lat),
      lng: Number(island.lng)
    };
    memIslands.push(newIsland);
    return newIsland;
  },
  getRoutes: () => memRoutes,
  getRouteById: id => memRoutes.find(r => String(r._id) === String(id)),
  addRoute: route => {
    const from = memIslands.find(i => String(i._id) === String(route.fromIsland));
    const to = memIslands.find(i => String(i._id) === String(route.toIsland));
    const distance = Number(route.distance) || calculateHaversineKm(from.lat, from.lng, to.lat, to.lng);
    const hex = (8000 + memRoutes.length + 1).toString(16).padStart(24, '0');
    const newRoute = {
      _id: hex,
      fromIsland: from,
      toIsland: to,
      distance,
      speed: Number(route.speed) || 30,
      isHazard: Boolean(route.isHazard),
      isPatrolZone: Boolean(route.isPatrolZone)
    };
    memRoutes.push(newRoute);
    return newRoute;
  },
  updateRouteHazard: (id, { isHazard, isPatrolZone }) => {
    const r = memRoutes.find(r => String(r._id) === String(id));
    if (!r) return null;
    if (typeof isHazard === 'boolean') r.isHazard = isHazard;
    if (typeof isPatrolZone === 'boolean') r.isPatrolZone = isPatrolZone;
    return r;
  },
  resetInMemory
};
