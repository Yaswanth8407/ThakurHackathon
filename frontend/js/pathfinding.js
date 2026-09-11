/**
 * The Pirate Navigation System - Lakshadweep Archipelago Pathfinding Engine
 * Implements sub-second Dijkstra shortest-path calculations with dynamic multi-tier hazard classification:
 * - Clear (1.0x)
 * - Dangerous (2.5x penalty)
 * - Storm-battered (5.0x penalty)
 * - Blocked (Infinity / strictly impassable)
 * 
 * Supports both Strait hazards and Island/Atoll danger states.
 * Computes Nautical Distance (NM), Knots, Estimated Days at Sea, and Risk Hazard Factor.
 * Gracefully displays warning when all viable passages are blocked.
 */

const NAUTICAL_MILE_RADIUS = 3440.065; // Earth radius in Nautical Miles

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

// 12 Authentic Coral Atolls & Islands of Lakshadweep
const SEED_ISLANDS = [
  { _id: '65f000000000000000000001', name: 'Kavaratti', lat: 10.5667, lng: 72.6417, type: 'Capital Port', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000002', name: 'Agatti', lat: 10.8533, lng: 72.1947, type: 'Lagoon Airstrip', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000003', name: 'Bangaram', lat: 10.9400, lng: 72.2900, type: 'Coral Atoll', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000004', name: 'Minicoy', lat: 8.2833, lng: 73.0500, type: 'Lighthouse Atoll', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000005', name: 'Kalpeni', lat: 10.0833, lng: 73.6500, type: 'Lagoon Atoll', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000006', name: 'Andrott', lat: 10.8167, lng: 73.6667, type: 'Eastern Isle', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000007', name: 'Amini', lat: 11.1242, lng: 72.7317, type: 'Historic Atoll', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000008', name: 'Kadmat', lat: 11.2333, lng: 72.7833, type: 'Barrier Reef', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f000000000000000000009', name: 'Kiltan', lat: 11.4833, lng: 73.0000, type: 'Northern Port', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f00000000000000000000a', name: 'Chetlat', lat: 11.6833, lng: 72.7000, type: 'Northern Atoll', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f00000000000000000000b', name: 'Bitra', lat: 11.6000, lng: 72.1833, type: 'Western Lagoon', hazardStatus: 'Clear', isCustom: false },
  { _id: '65f00000000000000000000c', name: 'Suheli Par', lat: 10.0833, lng: 72.2833, type: 'Fishing Reef', hazardStatus: 'Clear', isCustom: false }
];

const SEED_ROUTE_DEFS = [
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

function generateSeedRoutes(islands) {
  const nameToIsland = {};
  islands.forEach(i => (nameToIsland[i.name] = i));

  return SEED_ROUTE_DEFS.map((def, idx) => {
    const from = nameToIsland[def.from];
    const to = nameToIsland[def.to];
    const hex = (7000 + idx + 1).toString(16).padStart(24, '0');

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

const MULTI_TIER_PENALTIES = {
  'Clear': 1.0,
  'Dangerous': 2.5,
  'Storm-battered': 5.0,
  'Blocked': Infinity
};

function getRouteWeight(route, fromIsland, toIsland) {
  const straitStatus = route.hazardStatus ||
    (route.isPatrolZone ? 'Blocked' : route.isHazard ? 'Storm-battered' : 'Clear');

  if (straitStatus === 'Blocked') {
    return Infinity;
  }

  if (fromIsland?.hazardStatus === 'Blocked' || toIsland?.hazardStatus === 'Blocked') {
    return Infinity;
  }

  const straitMult = MULTI_TIER_PENALTIES[straitStatus] || 1.0;
  const toIslandMult = MULTI_TIER_PENALTIES[toIsland?.hazardStatus] || 1.0;
  const fromIslandMult = MULTI_TIER_PENALTIES[fromIsland?.hazardStatus] || 1.0;

  const combinedMultiplier = straitMult * Math.max(toIslandMult, fromIslandMult);
  return route.distance * combinedMultiplier;
}

/**
 * Core Dijkstra Shortest Path Calculation
 */
function dijkstraCore(islands, routes, fromId, toId) {
  const islandMap = {};
  const graph = {};

  islands.forEach(island => {
    const id = island._id.toString();
    islandMap[id] = island;
    graph[id] = [];
  });

  const depIsland = islandMap[fromId];
  const destIsland = islandMap[toId];

  // If departure or destination is blocked, return null immediately
  if (depIsland?.hazardStatus === 'Blocked' || destIsland?.hazardStatus === 'Blocked') {
    return null;
  }

  routes.forEach(route => {
    const from = (route.fromIsland?._id || route.fromIsland).toString();
    const to = (route.toIsland?._id || route.toIsland).toString();
    const fromIsl = islandMap[from];
    const toIsl = islandMap[to];

    const weight = getRouteWeight(route, fromIsl, toIsl);

    if (weight !== Infinity) {
      if (graph[from]) graph[from].push({ node: to, weight, originalDistance: route.distance, route });
      if (graph[to]) graph[to].push({ node: from, weight, originalDistance: route.distance, route });
    }
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
    totalDistance: parseFloat(totalPhysicalDistance.toFixed(1)),
    weightedDistance: parseFloat(distances[toId].toFixed(1))
  };
}

/**
 * High-level Path Calculation with Days at Sea and Risk Hazard Factor
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
    throw new Error('Departure or destination atoll not found in Lakshadweep archipelago.');
  }

  if (fromStr === toStr) {
    return {
      path: [fromStr],
      islandDetails: [islandMap[fromStr]],
      totalDistance: 0,
      estimatedTimeHours: 0,
      estimatedDaysAtSea: '0.0 days',
      riskHazardFactor: '0% (Calm Lagoon)',
      riskPercentage: 0,
      legs: [],
      isRerouted: false,
      hazardsAvoided: 0,
      isForcedBlocked: false
    };
  }

  // Clean baseline route (calm seas) for detour comparison
  const cleanIslands = islands.map(i => ({ ...i, hazardStatus: 'Clear' }));
  const cleanRoutes = routes.map(r => ({ ...r, hazardStatus: 'Clear', isHazard: false, isPatrolZone: false }));
  const baselineResult = dijkstraCore(cleanIslands, cleanRoutes, fromStr, toStr);

  // Active path attempt strictly excluding Blocked passages & islands
  const activeResult = dijkstraCore(islands, routes, fromStr, toStr);

  // Gracefully handle complete blockage
  if (!activeResult) {
    return {
      path: [],
      islandDetails: [],
      totalDistance: 0,
      estimatedTimeHours: 0,
      estimatedDaysAtSea: '0.0 days',
      riskHazardFactor: '100% (Blocked)',
      riskPercentage: 100,
      legs: [],
      isRerouted: false,
      hazardsAvoided: 0,
      isForcedBlocked: false,
      message: 'All viable routes are completely blocked! No safe sea passage found.'
    };
  }

  // Calculate Risk Hazard Factor (0% to 100%)
  let totalHazardScore = 0;
  activeResult.legs.forEach(l => {
    const status = l.route?.hazardStatus ||
      (l.route?.isPatrolZone ? 'Blocked' : l.route?.isHazard ? 'Storm-battered' : 'Clear');
    if (status === 'Dangerous') totalHazardScore += 25;
    else if (status === 'Storm-battered') totalHazardScore += 50;
    else if (status === 'Blocked') totalHazardScore += 100;
  });

  // Factor in intermediate island danger states
  activeResult.path.forEach(nodeId => {
    const isl = islandMap[nodeId];
    if (isl?.hazardStatus === 'Dangerous') totalHazardScore += 25;
    else if (isl?.hazardStatus === 'Storm-battered') totalHazardScore += 50;
    else if (isl?.hazardStatus === 'Blocked') totalHazardScore += 100;
  });

  const totalElements = Math.max(1, activeResult.legs.length + activeResult.path.length);
  const maxPossible = totalElements * 50;
  const riskPercentage = Math.min(100, Math.round((totalHazardScore / maxPossible) * 100));

  let riskDescription = 'Low Risk (Calm Waters)';
  if (riskPercentage >= 50) riskDescription = 'High Risk (Storm-battered Seas)';
  else if (riskPercentage > 0) riskDescription = 'Moderate Risk (Dangerous Shoals)';

  // Calculate Days at Sea
  const estimatedTimeHours = parseFloat((activeResult.totalDistance / speed).toFixed(2));
  const daysAtSea = parseFloat((estimatedTimeHours / 24).toFixed(1));
  const estimatedDaysAtSea = `${daysAtSea} days (${estimatedTimeHours} hrs)`;

  // Check if active path took a detour around a hazard compared to baseline
  let isRerouted = false;
  let hazardsAvoided = 0;
  if (baselineResult && baselineResult.path.length > 0) {
    baselineResult.legs.forEach(bLeg => {
      const match = routes.find(r => {
        const rf = String(r.fromIsland?._id || r.fromIsland);
        const rt = String(r.toIsland?._id || r.toIsland);
        return (rf === bLeg.from && rt === bLeg.to) || (rf === bLeg.to && rt === bLeg.from);
      });
      const bStatus = match?.hazardStatus || (match?.isPatrolZone ? 'Blocked' : match?.isHazard ? 'Storm-battered' : 'Clear');
      if (bStatus !== 'Clear') {
        isRerouted = true;
        hazardsAvoided++;
      }
    });

    baselineResult.path.forEach(nodeId => {
      const isl = islandMap[nodeId];
      if (isl && isl.hazardStatus && isl.hazardStatus !== 'Clear') {
        isRerouted = true;
        hazardsAvoided++;
      }
    });
  }

  return {
    path: activeResult.path,
    islandDetails: activeResult.path.map(id => islandMap[id]),
    totalDistance: activeResult.totalDistance,
    speedKnots: speed,
    estimatedTimeHours,
    estimatedDaysAtSea,
    riskHazardFactor: `${riskPercentage}% (${riskDescription})`,
    riskPercentage,
    isForcedBlocked: false,
    isRerouted,
    hazardsAvoided,
    legs: activeResult.legs.map(leg => {
      const status = leg.route?.hazardStatus ||
        (leg.route?.isPatrolZone ? 'Blocked' : leg.route?.isHazard ? 'Storm-battered' : 'Clear');
      return {
        from: leg.from,
        to: leg.to,
        fromName: islandMap[leg.from]?.name || 'Atoll',
        toName: islandMap[leg.to]?.name || 'Atoll',
        distance: leg.distance,
        hazardStatus: status
      };
    })
  };
}

/**
 * Connect a custom anchorage/waypoint to nearest atolls in Lakshadweep
 */
function integrateCustomLocation(customPlace, existingIslands) {
  const candidates = existingIslands
    .filter(i => String(i._id) !== String(customPlace._id))
    .map(i => ({
      island: i,
      distance: calculateNauticalDistance(customPlace.lat, customPlace.lng, i.lat, i.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  const nearest = candidates.slice(0, 2);

  return nearest.map((cand, idx) => {
    const hex = (9000 + Math.floor(Math.random() * 9000) + idx).toString(16).padStart(24, '0');
    return {
      _id: hex,
      fromIsland: customPlace,
      toIsland: cand.island,
      distance: cand.distance,
      speed: 10,
      hazardStatus: 'Clear',
      isHazard: false,
      isPatrolZone: false
    };
  });
}

// Global browser export
window.PathfindingEngine = {
  calculateNauticalDistance,
  SEED_ISLANDS,
  generateSeedRoutes,
  dijkstraCore,
  calculateRoutePath,
  integrateCustomLocation
};
