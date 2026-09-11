/**
 * The Pirate Navigation System - Mumbai Edition API Client
 * Connects frontend and backend (/api/islands, /api/routes, /api/routes/:id/hazard, /api/path).
 * Also handles creating custom places via POST /api/islands and POST /api/routes.
 */

const API_BASE = window.location.origin.includes('http')
  ? `${window.location.origin}/api`
  : 'http://localhost:3000/api';

let isBackendLive = false;
let localIslands = [];
let localRoutes = [];

function initLocalCache() {
  localIslands = JSON.parse(JSON.stringify(window.PathfindingEngine.SEED_ISLANDS));
  localRoutes = window.PathfindingEngine.generateSeedRoutes(localIslands);
}

initLocalCache();

const ApiService = {
  isLive() {
    return isBackendLive;
  },

  /**
   * Fetch all islands / Mumbai locations
   */
  async getIslands() {
    try {
      const res = await fetch(`${API_BASE}/islands`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localIslands = data;
          isBackendLive = true;
          return data;
        }
      }
    } catch (e) {
      // Backend fallback
    }
    isBackendLive = false;
    return [...localIslands];
  },

  /**
   * Fetch all sea routes / corridors
   */
  async getRoutes() {
    try {
      const res = await fetch(`${API_BASE}/routes`, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localRoutes = data;
          isBackendLive = true;
          return data;
        }
      }
    } catch (e) {
      // Backend fallback
    }
    isBackendLive = false;
    return [...localRoutes];
  },

  /**
   * Update Hazard or Patrol Zone on a route
   * PATCH /api/routes/:id/hazard
   */
  async toggleHazard(routeId, { isHazard, isPatrolZone }) {
    const strId = String(routeId);

    try {
      const res = await fetch(`${API_BASE}/routes/${strId}/hazard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHazard, isPatrolZone }),
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        const updated = await res.json();
        const idx = localRoutes.findIndex(r => String(r._id) === strId);
        if (idx !== -1) localRoutes[idx] = updated;
        isBackendLive = true;
        return updated;
      }
    } catch (e) {
      // Fallback
    }

    const idx = localRoutes.findIndex(r => String(r._id) === strId);
    if (idx !== -1) {
      if (typeof isHazard === 'boolean') localRoutes[idx].isHazard = isHazard;
      if (typeof isPatrolZone === 'boolean') localRoutes[idx].isPatrolZone = isPatrolZone;
      return localRoutes[idx];
    }
    return null;
  },

  /**
   * Calculate Shortest Path in Kilometers
   * GET /api/path?from=<id>&to=<id>&speed=<kmh>
   */
  async calculatePath(fromId, toId, speedKmH = 30) {
    const fromStr = String(fromId);
    const toStr = String(toId);

    try {
      const url = `${API_BASE}/path?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&speed=${encodeURIComponent(speedKmH)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const backendResult = await res.json();
        if (backendResult && backendResult.path) {
          isBackendLive = true;

          const clientCalculation = window.PathfindingEngine.calculateRoutePath(
            localIslands,
            localRoutes,
            fromStr,
            toStr,
            speedKmH
          );

          return {
            ...backendResult,
            speedKmH,
            estimatedTimeHours: parseFloat((backendResult.totalDistance / speedKmH).toFixed(2)),
            legs: clientCalculation.legs,
            isRerouted: clientCalculation.isRerouted,
            hazardsAvoided: clientCalculation.hazardsAvoided
          };
        }
      }
    } catch (e) {
      // Fallback
    }

    isBackendLive = false;
    return window.PathfindingEngine.calculateRoutePath(
      localIslands,
      localRoutes,
      fromStr,
      toStr,
      speedKmH
    );
  },

  /**
   * Create a Custom Place and connect to nearest nodes
   */
  async createCustomPlace(name, lat, lng) {
    let createdPlace = null;

    // 1. Post new island/place
    try {
      const res = await fetch(`${API_BASE}/islands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat: Number(lat), lng: Number(lng) }),
        signal: AbortSignal.timeout(2500)
      });
      if (res.ok) {
        createdPlace = await res.json();
      }
    } catch (e) {
      // ignore
    }

    if (!createdPlace) {
      const hex = (localIslands.length + 1).toString(16).padStart(24, '0');
      createdPlace = {
        _id: hex,
        name,
        lat: Number(lat),
        lng: Number(lng),
        isCustom: true
      };
    }

    createdPlace.isCustom = true;
    localIslands.push(createdPlace);

    // 2. Connect to 2 nearest nodes
    const connectingRoutes = window.PathfindingEngine.integrateCustomLocation(createdPlace, localIslands);

    for (const cr of connectingRoutes) {
      try {
        const rRes = await fetch(`${API_BASE}/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromIsland: cr.fromIsland._id,
            toIsland: cr.toIsland._id,
            distance: cr.distance,
            speed: 30
          }),
          signal: AbortSignal.timeout(2000)
        });
        if (rRes.ok) {
          const savedR = await rRes.json();
          localRoutes.push(savedR);
          continue;
        }
      } catch (e) {
        // fallback
      }
      localRoutes.push(cr);
    }

    return createdPlace;
  },

  /**
   * Reset all hazards
   */
  async resetBaseline() {
    localRoutes.forEach(r => {
      r.isHazard = false;
      r.isPatrolZone = false;
    });

    for (const r of localRoutes) {
      try {
        await fetch(`${API_BASE}/routes/${r._id}/hazard`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHazard: false, isPatrolZone: false }),
          signal: AbortSignal.timeout(500)
        });
      } catch (e) {
        break;
      }
    }

    return { success: true };
  }
};

window.ApiService = ApiService;
