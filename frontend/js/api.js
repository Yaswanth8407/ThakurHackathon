/**
 * The Pirate Navigation System - Lakshadweep API Client
 * Connects frontend and backend (/api/islands, /api/routes, /api/routes/:id/hazard, /api/islands/:id/hazard, /api/path).
 * Features dynamic multi-tier hazard toggling for both islands and straits with sub-second recalculation.
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
   * Fetch all islands / atolls
   */
  async getIslands() {
    try {
      const res = await fetch(`${API_BASE}/islands`, { signal: AbortSignal.timeout(2000) });
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
   * Fetch all sea routes / straits
   */
  async getRoutes() {
    try {
      const res = await fetch(`${API_BASE}/routes`, { signal: AbortSignal.timeout(2000) });
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
   * Update Hazard Classification on a route/strait
   * status: 'Clear' | 'Dangerous' | 'Storm-battered' | 'Blocked'
   */
  async setRouteHazard(routeId, hazardStatus) {
    const strId = String(routeId);
    const isHazard = hazardStatus === 'Dangerous' || hazardStatus === 'Storm-battered';
    const isPatrolZone = hazardStatus === 'Blocked';

    try {
      const res = await fetch(`${API_BASE}/routes/${strId}/hazard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hazardStatus, isHazard, isPatrolZone }),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const updated = await res.json();
        const idx = localRoutes.findIndex(r => String(r._id) === strId);
        if (idx !== -1) {
          localRoutes[idx] = { ...localRoutes[idx], ...updated, hazardStatus };
        }
        isBackendLive = true;
        return localRoutes[idx] || updated;
      }
    } catch (e) {
      // Fallback
    }

    const idx = localRoutes.findIndex(r => String(r._id) === strId);
    if (idx !== -1) {
      localRoutes[idx].hazardStatus = hazardStatus;
      localRoutes[idx].isHazard = isHazard;
      localRoutes[idx].isPatrolZone = isPatrolZone;
      return localRoutes[idx];
    }
    return null;
  },

  /**
   * Update Danger State on an island/atoll
   * status: 'Clear' | 'Dangerous' | 'Storm-battered' | 'Blocked'
   */
  async setIslandHazard(islandId, hazardStatus) {
    const strId = String(islandId);
    try {
      const res = await fetch(`${API_BASE}/islands/${strId}/hazard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hazardStatus }),
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const updated = await res.json();
        const idx = localIslands.findIndex(i => String(i._id) === strId);
        if (idx !== -1) {
          localIslands[idx] = { ...localIslands[idx], ...updated, hazardStatus };
        }
        isBackendLive = true;
        return localIslands[idx] || updated;
      }
    } catch (e) {
      // Fallback
    }

    const idx = localIslands.findIndex(i => String(i._id) === strId);
    if (idx !== -1) {
      localIslands[idx].hazardStatus = hazardStatus;
      return localIslands[idx];
    }
    return null;
  },

  /**
   * Calculate Shortest Safe Path
   * GET /api/path?from=<id>&to=<id>&speed=<knots>
   */
  async calculatePath(fromId, toId, speedKnots = 10) {
    const fromStr = String(fromId);
    const toStr = String(toId);

    // Fast sub-second client calculation
    const clientCalculation = window.PathfindingEngine.calculateRoutePath(
      localIslands,
      localRoutes,
      fromStr,
      toStr,
      speedKnots
    );

    // If completely blocked according to active state, return graceful warning immediately
    if (!clientCalculation.path || clientCalculation.path.length === 0) {
      return {
        path: [],
        totalDistance: 0,
        estimatedTimeHours: 0,
        estimatedDaysAtSea: '0.0 days',
        riskHazardFactor: '100% (Blocked)',
        riskPercentage: 100,
        legs: [],
        isRerouted: false,
        hazardsAvoided: 0,
        isForcedBlocked: false,
        message: clientCalculation.message || 'All viable routes are completely blocked! No safe sea passage found.'
      };
    }

    try {
      const url = `${API_BASE}/path?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&speed=${encodeURIComponent(speedKnots)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const backendResult = await res.json();
        if (backendResult && backendResult.path) {
          isBackendLive = true;

          if (backendResult.path.length === 0) {
            return {
              path: [],
              totalDistance: 0,
              estimatedTimeHours: 0,
              estimatedDaysAtSea: '0.0 days',
              riskHazardFactor: '100% (Blocked)',
              riskPercentage: 100,
              legs: [],
              isRerouted: false,
              hazardsAvoided: 0,
              isForcedBlocked: false,
              message: backendResult.message || 'All viable routes are completely blocked! No safe sea passage found.'
            };
          }

          return {
            ...backendResult,
            speedKnots,
            estimatedTimeHours: clientCalculation.estimatedTimeHours,
            estimatedDaysAtSea: clientCalculation.estimatedDaysAtSea,
            riskHazardFactor: clientCalculation.riskHazardFactor,
            riskPercentage: clientCalculation.riskPercentage,
            legs: clientCalculation.legs,
            isRerouted: clientCalculation.isRerouted,
            hazardsAvoided: clientCalculation.hazardsAvoided,
            isForcedBlocked: false
          };
        }
      }
    } catch (e) {
      // Fallback to client calculation
    }

    isBackendLive = false;
    return clientCalculation;
  },

  /**
   * Create a Custom Anchorage / Waypoint
   */
  async createCustomPlace(name, lat, lng) {
    let createdPlace = null;

    try {
      const res = await fetch(`${API_BASE}/islands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat: Number(lat), lng: Number(lng), hazardStatus: 'Clear' }),
        signal: AbortSignal.timeout(2000)
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
        type: 'Custom Anchorage',
        hazardStatus: 'Clear',
        isCustom: true
      };
    }

    createdPlace.isCustom = true;
    localIslands.push(createdPlace);

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
            speed: 10,
            hazardStatus: 'Clear'
          }),
          signal: AbortSignal.timeout(1500)
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
   * Reset all straits and islands to Clear state
   */
  async resetBaseline() {
    localRoutes.forEach(r => {
      r.hazardStatus = 'Clear';
      r.isHazard = false;
      r.isPatrolZone = false;
    });

    localIslands.forEach(i => {
      i.hazardStatus = 'Clear';
    });

    try {
      await fetch(`${API_BASE}/routes/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000)
      });
    } catch (e) {
      // ignore
    }

    return { success: true };
  }
};

window.ApiService = ApiService;
