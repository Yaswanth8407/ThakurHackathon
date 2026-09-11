/**
 * The Pirate Navigation System - Lakshadweep In-Memory Store
 * Ensures 100% backend uptime and sub-second Dijkstra calculations.
 */

const NAUTICAL_MILE_RADIUS = 3440.065; // Earth radius in Nautical Miles

function calculateNauticalMiles(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(NAUTICAL_MILE_RADIUS * c * 10) / 10;
}

const DEFAULT_LAKSHADWEEP_ISLANDS = [
  { _id: '65f000000000000000000001', name: 'Kavaratti', lat: 10.5667, lng: 72.6417, type: 'Capital Port', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000002', name: 'Agatti', lat: 10.8533, lng: 72.1947, type: 'Lagoon Airstrip', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000003', name: 'Bangaram', lat: 10.9400, lng: 72.2900, type: 'Coral Atoll', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000004', name: 'Minicoy', lat: 8.2833, lng: 73.0500, type: 'Lighthouse Atoll', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000005', name: 'Kalpeni', lat: 10.0833, lng: 73.6500, type: 'Lagoon Atoll', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000006', name: 'Andrott', lat: 10.8167, lng: 73.6667, type: 'Eastern Isle', hazardStatus: 'Clear' },
  { _id: '65f000000000000000000007', name: 'Amini', lat: 11.1242, lng: 72.7317, type: 'Historic Atoll', hazardStatus: 'Clear' },
  { _id: '65f00000000000000000008', name: 'Kadmat', lat: 11.2333, lng: 72.7833, type: 'Barrier Reef', hazardStatus: 'Clear' },
  { _id: '65f00000000000000000009', name: 'Kiltan', lat: 11.4833, lng: 73.0000, type: 'Northern Port', hazardStatus: 'Clear' },
  { _id: '65f0000000000000000000a', name: 'Chetlat', lat: 11.6833, lng: 72.7000, type: 'Northern Atoll', hazardStatus: 'Clear' },
  { _id: '65f0000000000000000000b', name: 'Bitra', lat: 11.6000, lng: 72.1833, type: 'Western Lagoon', hazardStatus: 'Clear' },
  { _id: '65f0000000000000000000c', name: 'Suheli Par', lat: 10.0833, lng: 72.2833, type: 'Fishing Reef', hazardStatus: 'Clear' }
];

const DEFAULT_LAKSHADWEEP_ROUTES = [
  { from: 'Agatti', to: 'Bangaram', distance: 7.2 },
  { from: 'Agatti', to: 'Kavaratti', distance: 32.4 },
  { from: 'Bangaram', to: 'Amini', distance: 28.5 },
  { from: 'Amini', to: 'Kadmat', distance: 7.1 },
  { from: 'Kadmat', to: 'Kiltan', distance: 20.3 },
  { from: 'Kiltan', to: 'Chetlat', distance: 21.6 },
  { from: 'Chetlat', to: 'Bitra', distance: 31.0 },
  { from: 'Bitra', to: 'Bangaram', distance: 40.2 },
  { from: 'Amini', to: 'Kavaratti', distance: 34.0 },
  { from: 'Kadmat', to: 'Andrott', distance: 57.2 },
  { from: 'Kavaratti', to: 'Andrott', distance: 62.1 },
  { from: 'Andrott', to: 'Kalpeni', distance: 44.0 },
  { from: 'Kavaratti', to: 'Kalpeni', distance: 67.4 },
  { from: 'Kavaratti', to: 'Suheli Par', distance: 35.8 },
  { from: 'Suheli Par', to: 'Minicoy', distance: 118.2 },
  { from: 'Kalpeni', to: 'Minicoy', distance: 114.5 },
  { from: 'Kavaratti', to: 'Minicoy', distance: 139.0 }
];

let memIslands = [];
let memRoutes = [];

function resetInMemory() {
  memIslands = JSON.parse(JSON.stringify(DEFAULT_LAKSHADWEEP_ISLANDS));
  const islandMap = {};
  memIslands.forEach(i => (islandMap[i.name] = i));

  memRoutes = DEFAULT_LAKSHADWEEP_ROUTES.map((def, idx) => {
    const from = islandMap[def.from];
    const to = islandMap[def.to];
    const hex = (8000 + idx + 1).toString(16).padStart(24, '0');
    return {
      _id: hex,
      fromIsland: from,
      toIsland: to,
      distance: def.distance,
      speed: 10,
      hazardStatus: 'Clear', // 'Clear' | 'Dangerous' | 'Storm-battered' | 'Blocked'
      isHazard: false,
      isPatrolZone: false
    };
  });
}

resetInMemory();

module.exports = {
  calculateNauticalMiles,
  getIslands: () => memIslands,
  getIslandById: id => memIslands.find(i => String(i._id) === String(id)),
  addIsland: island => {
    const hex = (memIslands.length + 1).toString(16).padStart(24, '0');
    const newIsland = {
      _id: hex,
      name: island.name,
      lat: Number(island.lat),
      lng: Number(island.lng),
      type: island.type || 'Custom Anchorage',
      hazardStatus: island.hazardStatus || 'Clear',
      isCustom: true
    };
    memIslands.push(newIsland);
    return newIsland;
  },
  updateIslandHazard: (id, payload) => {
    const isl = memIslands.find(i => String(i._id) === String(id));
    if (!isl) return null;
    if (payload.hazardStatus) {
      isl.hazardStatus = payload.hazardStatus;
    }
    return isl;
  },
  getRoutes: () => memRoutes,
  getRouteById: id => memRoutes.find(r => String(r._id) === String(id)),
  addRoute: route => {
    const from = memIslands.find(i => String(i._id) === String(route.fromIsland));
    const to = memIslands.find(i => String(i._id) === String(route.toIsland));
    const distance = Number(route.distance) || calculateNauticalMiles(from.lat, from.lng, to.lat, to.lng);
    const hex = (8000 + memRoutes.length + 1).toString(16).padStart(24, '0');
    const newRoute = {
      _id: hex,
      fromIsland: from,
      toIsland: to,
      distance,
      speed: Number(route.speed) || 10,
      hazardStatus: route.hazardStatus || 'Clear',
      isHazard: route.hazardStatus === 'Dangerous' || route.hazardStatus === 'Storm-battered',
      isPatrolZone: route.hazardStatus === 'Blocked'
    };
    memRoutes.push(newRoute);
    return newRoute;
  },
  updateRouteHazard: (id, payload) => {
    const r = memRoutes.find(r => String(r._id) === String(id));
    if (!r) return null;

    if (payload.hazardStatus) {
      r.hazardStatus = payload.hazardStatus;
      r.isHazard = payload.hazardStatus === 'Dangerous' || payload.hazardStatus === 'Storm-battered';
      r.isPatrolZone = payload.hazardStatus === 'Blocked';
    } else {
      if (typeof payload.isHazard === 'boolean') {
        r.isHazard = payload.isHazard;
        if (payload.isHazard) r.hazardStatus = 'Storm-battered';
        else if (!r.isPatrolZone) r.hazardStatus = 'Clear';
      }
      if (typeof payload.isPatrolZone === 'boolean') {
        r.isPatrolZone = payload.isPatrolZone;
        if (payload.isPatrolZone) r.hazardStatus = 'Blocked';
        else if (!r.isHazard) r.hazardStatus = 'Clear';
      }
    }
    return r;
  },
  resetInMemory
};
