const HAZARD_PENALTY = 10;

function dijkstra(islands, routes, fromId, toId) {
  const graph = {};

  islands.forEach(island => {
    graph[island._id.toString()] = [];
  });

  routes.forEach(route => {
    const from = route.fromIsland.toString();
    const to = route.toIsland.toString();
    let weight = route.distance;

    if (route.isHazard || route.isPatrolZone) {
      weight *= HAZARD_PENALTY;
    }

    if (graph[from]) graph[from].push({ node: to, weight });
    if (graph[to]) graph[to].push({ node: from, weight });
  });

  const distances = {};
  const previous = {};
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
    for (const { node: neighbor, weight } of neighbors) {
      if (visited.has(neighbor)) continue;

      const alt = distances[current] + weight;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = current;
        pq.push({ node: neighbor, distance: alt });
      }
    }
  }

  if (distances[toId] === Infinity) {
    return null;
  }

  const path = [];
  let current = toId;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  if (path[0] !== fromId) return null;

  return {
    path,
    totalDistance: distances[toId]
  };
}

module.exports = dijkstra;
