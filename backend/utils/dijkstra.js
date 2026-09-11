/**
 * The Pirate Navigation System - Multi-Tier Dijkstra Algorithm (Lakshadweep Archipelago)
 * Dynamic Hazard Classification:
 * - Clear (1.0x)
 * - Dangerous (2.5x penalty)
 * - Storm-battered (5.0x penalty)
 * - Blocked (Infinity / strictly impassable)
 * 
 * Accurately handles both Strait and Island hazard states.
 * Gracefully returns null when all viable passages are blocked.
 */

const PENALTY_MAP = {
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

  // If destination or origin island is Blocked, passage is impassable
  if (toIsland?.hazardStatus === 'Blocked' || fromIsland?.hazardStatus === 'Blocked') {
    return Infinity;
  }

  const straitMult = PENALTY_MAP[straitStatus] || 1.0;
  const toIslandMult = PENALTY_MAP[toIsland?.hazardStatus] || 1.0;
  const fromIslandMult = PENALTY_MAP[fromIsland?.hazardStatus] || 1.0;

  // Combine strait penalty with intermediate atoll hazards
  const effectiveMultiplier = straitMult * Math.max(toIslandMult, fromIslandMult);
  return route.distance * effectiveMultiplier;
}

function runDijkstraCore(islands, routes, fromId, toId) {
  const islandMap = {};
  const graph = {};

  islands.forEach(island => {
    const id = island._id.toString();
    islandMap[id] = island;
    graph[id] = [];
  });

  const depIsland = islandMap[fromId];
  const destIsland = islandMap[toId];

  // If departure or destination atoll itself is Blocked, no safe passage is possible
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

function dijkstra(islands, routes, fromId, toId) {
  const result = runDijkstraCore(islands, routes, fromId, toId);

  // If all viable passages or atolls are blocked, return null gracefully
  if (!result) return null;

  const islandMap = {};
  islands.forEach(i => (islandMap[i._id.toString()] = i));

  // Calculate Risk Hazard Factor (0% to 100%)
  let totalHazardScore = 0;
  result.legs.forEach(l => {
    const status = l.route?.hazardStatus ||
      (l.route?.isPatrolZone ? 'Blocked' : l.route?.isHazard ? 'Storm-battered' : 'Clear');
    if (status === 'Dangerous') totalHazardScore += 25;
    else if (status === 'Storm-battered') totalHazardScore += 50;
    else if (status === 'Blocked') totalHazardScore += 100;
  });

  // Factor in intermediate island danger states
  result.path.forEach(nodeId => {
    const isl = islandMap[nodeId];
    if (isl?.hazardStatus === 'Dangerous') totalHazardScore += 25;
    else if (isl?.hazardStatus === 'Storm-battered') totalHazardScore += 50;
    else if (isl?.hazardStatus === 'Blocked') totalHazardScore += 100;
  });

  const totalElements = Math.max(1, result.legs.length + result.path.length);
  const maxPossible = totalElements * 50;
  const riskPercentage = Math.min(100, Math.round((totalHazardScore / maxPossible) * 100));

  return {
    ...result,
    isForcedBlocked: false,
    riskHazardFactor: riskPercentage
  };
}

module.exports = dijkstra;
