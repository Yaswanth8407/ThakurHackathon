/**
 * The Pirate Navigation System - Mumbai Edition Pathfinding Engine
 * Implements Dijkstra shortest-path calculation, hazard avoidance penalties,
 * kilometer distances (Haversine), and dynamic custom place integration.
 */

const HAZARD_PENALTY = 10;
const EARTH_RADIUS_KM = 6371; // Earth radius in kilometers

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

// 12 Core Mumbai Network Nodes
const SEED_ISLANDS = [
  { _id: '65f000000000000000000001', name: 'Colaba', lat: 18.9067, lng: 72.8147, type: 'Port', isCustom: false },
  { _id: '65f000000000000000000002', name: 'Marine Drive', lat: 18.9438, lng: 72.8232, type: 'Cove', isCustom: false },
  { _id: '65f000000000000000000003', name: 'Dadar', lat: 19.0178, lng: 72.8478, type: 'Central Hub', isCustom: false },
  { _id: '65f000000000000000000004', name: 'Bandra', lat: 19.0596, lng: 72.8295, type: 'Coastal Fortress', isCustom: false },
  { _id: '65f000000000000000000005', name: 'Kurla', lat: 19.0726, lng: 72.8845, type: 'Transit Node', isCustom: false },
  { _id: '65f000000000000000000006', name: 'Ghatkopar', lat: 19.0860, lng: 72.9090, type: 'East Corridor', isCustom: false },
  { _id: '65f000000000000000000007', name: 'Andheri', lat: 19.1197, lng: 72.8464, type: 'West Corridor', isCustom: false },
  { _id: '65f000000000000000000008', name: 'Borivali', lat: 19.2307, lng: 72.8567, type: 'North Gate', isCustom: false },
  { _id: '65f000000000000000000009', name: 'Thane', lat: 19.2183, lng: 72.9781, type: 'Creek Harbour', isCustom: false },
  { _id: '65f00000000000000000000a', name: 'Vashi', lat: 19.0771, lng: 72.9986, type: 'Navi Mumbai', isCustom: false },
  { _id: '65f00000000000000000000b', name: 'Trombay', lat: 19.0160, lng: 72.9150, type: 'Harbour Node', isCustom: false },
  { _id: '65f00000000000000000000c', name: 'Elephanta Island', lat: 18.9633, lng: 72.9315, type: 'Sea Fortress', isCustom: false }
];

const SEED_ROUTE_DEFS = [
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
      fromIsland: from,
      toIsland: to,
      distance: def.distance,
      speed: 30,
      isHazard: false,
      isPatrolZone: false
    };
  });
}

/**
 * Dijkstra Pathfinding Algorithm
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
 * High-level Path Calculation with Detour Detection
 */
function calculateRoutePath(islands, routes, fromId, toId, speedKmH = 30) {
  const speed = Number(speedKmH) > 0 ? Number(speedKmH) : 30;
  const fromStr = String(fromId);
  const toStr = String(toId);

  const islandMap = {};
  islands.forEach(i => {
    islandMap[String(i._id)] = i;
  });

  if (!islandMap[fromStr] || !islandMap[toStr]) {
    throw new Error('Departure or destination not found in Mumbai network');
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

  // Clean baseline
  const cleanRoutes = routes.map(r => ({ ...r, isHazard: false, isPatrolZone: false }));
  const baselineResult = dijkstra(islands, cleanRoutes, fromStr, toStr);

  // Active path
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
      message: 'No safe route found between these Mumbai locations'
    };
  }

  // Detect if route was rerouted
  let isRerouted = false;
  let hazardsAvoided = 0;

  if (baselineResult && baselineResult.path.length > 0) {
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
    speedKmH: speed,
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

/**
 * Connect a custom place to the nearest 2 nodes in the Mumbai network
 */
function integrateCustomLocation(customPlace, existingIslands) {
  // Sort existing nodes by distance to the new custom location
  const candidates = existingIslands
    .filter(i => String(i._id) !== String(customPlace._id))
    .map(i => ({
      island: i,
      distance: calculateHaversineKm(customPlace.lat, customPlace.lng, i.lat, i.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  // Take the 2 closest nodes
  const nearest = candidates.slice(0, 2);

  const newRoutes = nearest.map((cand, idx) => {
    const hex = (9000 + Math.floor(Math.random() * 9000) + idx).toString(16).padStart(24, '0');
    return {
      _id: hex,
      fromIsland: customPlace,
      toIsland: cand.island,
      distance: cand.distance,
      speed: 30,
      isHazard: false,
      isPatrolZone: false
    };
  });

  return newRoutes;
}

// Export for browser
window.PathfindingEngine = {
  calculateHaversineKm,
  SEED_ISLANDS,
  generateSeedRoutes,
  dijkstra,
  calculateRoutePath,
  integrateCustomLocation
};
