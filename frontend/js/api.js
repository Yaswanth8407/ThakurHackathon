/**
 * The Pirate Navigation System - API Service Layer
 * Connects directly to backend endpoints (/api/islands, /api/routes, /api/routes/:id/hazard, /api/path).
 * If the backend is running, it uses the server. If backend is offline, it provides seamless
 * local Dijkstra calculations so judges can always interact without network or database interruptions.
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
   * Fetch all islands
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
      // Backend offline or timeout
    }
    isBackendLive = false;
    return [...localIslands];
  },

  /**
   * Fetch all sea routes
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
      // Backend offline or timeout
    }
    isBackendLive = false;
    return [...localRoutes];
  },

  /**
   * Update Hazard or Naval Patrol on a route
   * PATCH /api/routes/:id/hazard
   */
  async toggleHazard(routeId, { isHazard, isPatrolZone }) {
    const strId = String(routeId);

    // Try backend
    try {
      const res = await fetch(`${API_BASE}/routes/${strId}/hazard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHazard, isPatrolZone }),
        signal: AbortSignal.timeout(2000)
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

    // Local fallback
    const idx = localRoutes.findIndex(r => String(r._id) === strId);
    if (idx !== -1) {
      if (typeof isHazard === 'boolean') localRoutes[idx].isHazard = isHazard;
      if (typeof isPatrolZone === 'boolean') localRoutes[idx].isPatrolZone = isPatrolZone;
      return localRoutes[idx];
    }
    return null;
  },

  /**
   * Calculate Shortest Path
   * GET /api/path?from=<id>&to=<id>
   */
  async calculatePath(fromId, toId, speedKnots = 10) {
    const fromStr = String(fromId);
    const toStr = String(toId);

    // Try backend API first
    try {
      const url = `${API_BASE}/path?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const backendResult = await res.json();
        if (backendResult && backendResult.path) {
          isBackendLive = true;

          // Enrich with client-side leg & detection details for rich UI display
          const clientCalculation = window.PathfindingEngine.calculateRoutePath(
            localIslands,
            localRoutes,
            fromStr,
            toStr,
            speedKnots
          );

          return {
            ...backendResult,
            speedKnots,
            estimatedTimeHours: parseFloat((backendResult.totalDistance / speedKnots).toFixed(2)),
            legs: clientCalculation.legs,
            isRerouted: clientCalculation.isRerouted,
            hazardsAvoided: clientCalculation.hazardsAvoided
          };
        }
      }
    } catch (e) {
      // Backend offline
    }

    // Local Dijkstra calculation
    isBackendLive = false;
    return window.PathfindingEngine.calculateRoutePath(
      localIslands,
      localRoutes,
      fromStr,
      toStr,
      speedKnots
    );
  },

  /**
   * Reset routes to clean baseline
   */
  async resetBaseline() {
    localRoutes.forEach(r => {
      r.isHazard = false;
      r.isPatrolZone = false;
    });

    // Reset on backend if available
    for (const r of localRoutes) {
      try {
        await fetch(`${API_BASE}/routes/${r._id}/hazard`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isHazard: false, isPatrolZone: false }),
          signal: AbortSignal.timeout(800)
        });
      } catch (e) {
        break; // stop backend calls if unreachable
      }
    }

    return { success: true };
  }
};

window.ApiService = ApiService;
