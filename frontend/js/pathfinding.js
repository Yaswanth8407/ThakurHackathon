/**
 * The Pirate Navigation System - Client Pathfinding Engine
 * Mirrors the backend Dijkstra algorithm and data model exactly.
 * Operates seamlessly both in tandem with the backend and as an autonomous fallback.
 */

const HAZARD_PENALTY = 10;

// Earth radius in nautical miles for spherical distance fallback
const NAUTICAL_MILE_RADIUS = 3440.065;

function calculateNauticalDistance(lat1, lon1, lat2, lon2) {
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

// 12 Archipelago Island Nodes matching backend/seed.js
const SEED_ISLANDS = [
  { _id: '65f000000000000000000001', name: 'Skull Cove', lat: 12.5, lng: 77.8, type: 'Cove' },
  { _id: '65f000000000000000000002', name: 'Tortuga Bay', lat: 13.2, lng: 76.5, type: 'Port' },
  { _id: '65f000000000000000000003', name: 'Port Royal', lat: 11.8, lng: 78.2, type: 'Port' },
  { _id: '65f000000000000000000004', name: 'Isla de Muerta', lat: 14.0, lng: 75.8, type: 'Abyss' },
  { _id: '65f000000000000000000005', name: 'Shipwreck Island', lat: 12.0, lng: 75.0, type: 'Atoll' },
  { _id: '65f000000000000000000006', name: "Dead Man's Pass", lat: 13.5, lng: 78.5, type: 'Cove' },
  { _id: '65f00000000000000000007', name: "Buccaneer's Landing", lat: 14.5, lng: 77.2, type: 'Fortress' },
  { _id: '65f000000000000000000008', name: 'Coral Reef Point', lat: 11.5, lng: 76.0, type: 'Reef' },
  { _id: '65f000000000000000000009', name: 'Storm Breaker', lat: 13.8, lng: 79.0, type: 'Fortress' },
  { _id: '65f00000000000000000000a', name: 'Emerald Isle', lat: 12.8, lng: 74.5, type: 'Atoll' },
  { _id: '65f00000000000000000000b', name: 'Black Flag Port', lat: 14.2, lng: 79.5, type: 'Port' },
  { _id: '65f00000000000000000000c', name: 'Mystic Shores', lat: 11.2, lng: 77.5, type: 'Outpost' }
];

const SEED_ROUTE_DEFS = [
  { from: 'Skull Cove', to: 'Tortuga Bay', distance: 85 },
  { from: 'Skull Cove', to: 'Port Royal', distance: 62 },
  { from: 'Skull Cove', to: 'Coral Reef Point', distance: 45 },
  { from: 'Tortuga Bay', to: 'Isla de Muerta', distance: 70 },
  { from: 'Tortuga Bay', to: 'Shipwreck Island', distance: 55 },
  { from: 'Port Royal', to: "Dead Man's Pass", distance: 78 },
  { from: 'Port Royal', to: 'Skull Cove', distance: 62 },
  { from: 'Isla de Muerta', to: "Buccaneer's Landing", distance: 50 },
  { from: 'Isla de Muerta', to: 'Storm Breaker', distance: 65 },
  { from: 'Shipwreck Island', to: 'Emerald Isle', distance: 90 },
  { from: 'Shipwreck Island', to: 'Coral Reef Point', distance: 40 },
  { from: "Dead Man's Pass", to: 'Storm Breaker', distance: 35 },
  { from: "Dead Man's Pass", to: 'Black Flag Port', distance: 58 },
  { from: "Buccaneer's Landing", to: 'Skull Cove', distance: 110 },
  { from: "Buccaneer's Landing", to: 'Black Flag Port', distance: 42 },
  { from: 'Coral Reef Point', to: 'Mystic Shores', distance: 48 },
  { from: 'Coral Reef Point', to: 'Shipwreck Island', distance: 40 },
  { from: 'Storm Breaker', to: 'Black Flag Port', distance: 30 },
  { from: 'Emerald Isle', to: 'Mystic Shores', distance: 72 },
  { from: 'Mystic Shores', to: 'Port Royal', distance: 55 },
  { from: 'Skull Cove', to: "Dead Man's Pass", distance: 120 },
  { from: 'Tortuga Bay', to: "Buccaneer's Landing", distance: 88 }
];

function generateSeedRoutes(islands) {
  const nameToIsland = {};
  islands.forEach(i => {
    nameToIsland[i.name] = i;
  });

  return SEED_ROUTE_DEFS.map((def, idx) => {
    const from = nameToIsland[def.from];
    const to = nameToIsland[def.to];
    const hex = (7000 + idx + 1).toString(16).padStart(24, '0');

    return {
      _id: hex,
      fromIsland: {
        _id: from._id,
        name: from.name,
        lat: from.lat,
        lng: from.lng
      },
      toIsland: {
        _id: to._id,
        name: to.name,
        lat: to.lat,
        lng: to.lng
      },
      distance: def.distance,
      speed: 10,
      isHazard: false,
      isPatrolZone: false
    };
  });
}

/**
 * Dijkstra Pathfinding Algorithm
 * Exactly matching backend/utils/dijkstra.js
 */
function dijkstra(islands, routes, fromId, toId) {
  const graph = {};

  islands.forEach(island => {
    graph[island._id.toString()] = [];
  });

  routes.forEach(route => {
    const from = (route.fromIsland._id || route.fromIsland).toString();
    const to = (route.toIsland._id || route.toIsland).toString();
    let weight = route.distance;

    if (route.isHazard || route.isPatrolZone) {
      weight *= HAZARD_PENALTY;
    }

    if (graph[from]) graph[from].push({ node: to, weight, originalDistance: route.distance, route });
    if (graph[to]) graph[to].push({ node: from, weight, originalDistance: route.distance, route });
  });

  const distances = {};
  const previous = {};
  const edgeUsed = {};
  const visited = new Set();
  const pq = [];

  islands.forEach(island => {
    const id = island._id.toString();
    distances[id] = Infinity;
    previous[id] = null;
  });

  distances[fromId] = 0;
  pq.push({ node: fromId, distance: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.distance - b.distance);
    const { node: current } = pq.shift();

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === toId) break;

    const neighbors = graph[current] || [];
    for (const edge of neighbors) {
      const { node: neighbor, weight } = edge;
      if (visited.has(neighbor)) continue;

      const alt = distances[current] + weight;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
        edgeUsed[neighbor] = edge;
        pq.push({ node: neighbor, distance: alt });
      }
    }
  }

  if (distances[toId] === Infinity) {
    return null;
  }

  const path = [];
  const legs = [];
  let current = toId;
  let totalPhysicalDistance = 0;

  while (current !== null) {
    path.unshift(current);
    if (previous[current]) {
      const legEdge = edgeUsed[current];
      totalPhysicalDistance += legEdge.originalDistance;
      legs.unshift({
        from: previous[current],
        to: current,
        distance: legEdge.originalDistance,
        route: legEdge.route
      });
    }
    current = previous[current];
  }

  if (path[0] !== fromId) return null;

  return {
    path,
    legs,
    totalDistance: parseFloat(totalPhysicalDistance.toFixed(2)),
    weightedDistance: parseFloat(distances[toId].toFixed(2))
  };
}

/**
 * High-level Path Calculation
 */
function calculateRoutePath(islands, routes, fromId, toId, speedKnots = 10) {
  const speed = Number(speedKnots) > 0 ? Number(speedKnots) : 10;
  const fromStr = String(fromId);
  const toStr = String(toId);

  const islandMap = {};
  islands.forEach(i => {
    islandMap[String(i._id)] = i;
  });

  if (!islandMap[fromStr] || !islandMap[toStr]) {
    throw new Error('Departure or destination not found');
  }

  if (fromStr === toStr) {
    return {
      path: [fromStr],
      islandDetails: [islandMap[fromStr]],
      totalDistance: 0,
      estimatedTimeHours: 0,
      legs: [],
      isRerouted: false,
      hazardsAvoided: 0
    };
  }

  // Baseline unhindered route (clean seas)
  const cleanRoutes = routes.map(r => ({ ...r, isHazard: false, isPatrolZone: false }));
  const baselineResult = dijkstra(islands, cleanRoutes, fromStr, toStr);

  // Active route with current hazards
  const activeResult = dijkstra(islands, routes, fromStr, toStr);

  if (!activeResult) {
    return {
      path: [],
      islandDetails: [],
      totalDistance: 0,
      estimatedTimeHours: 0,
      legs: [],
      isRerouted: false,
      hazardsAvoided: 0,
      message: 'No safe route found between these islands'
    };
  }

  // Detect if route was diverted
  let isRerouted = false;
  let hazardsAvoided = 0;

  if (baselineResult && baselineResult.path.length > 0) {
    // Check if the baseline path intersected any currently active hazards
    baselineResult.legs.forEach(leg => {
      const match = routes.find(r => {
        const rf = String(r.fromIsland._id || r.fromIsland);
        const rt = String(r.toIsland._id || r.toIsland);
        return (rf === leg.from && rt === leg.to) || (rf === leg.to && rt === leg.from);
      });
      if (match && (match.isHazard || match.isPatrolZone)) {
        isRerouted = true;
        hazardsAvoided++;
      }
    });
  }

  const estimatedTimeHours = parseFloat((activeResult.totalDistance / speed).toFixed(2));

  return {
    path: activeResult.path,
    islandDetails: activeResult.path.map(id => islandMap[id]),
    totalDistance: activeResult.totalDistance,
    estimatedTimeHours,
    speedKnots: speed,
    legs: activeResult.legs.map(leg => ({
      from: leg.from,
      to: leg.to,
      fromName: islandMap[leg.from]?.name || 'Unknown',
      toName: islandMap[leg.to]?.name || 'Unknown',
      distance: leg.distance,
      isHazard: Boolean(leg.route?.isHazard),
      isPatrolZone: Boolean(leg.route?.isPatrolZone)
    })),
    isRerouted,
    hazardsAvoided
  };
}

// Export for browser global
window.PathfindingEngine = {
  calculateNauticalDistance,
  SEED_ISLANDS,
  generateSeedRoutes,
  dijkstra,
  calculateRoutePath
};
