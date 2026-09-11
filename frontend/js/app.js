/**
 * The Pirate Navigation System - Application Coordinator
 * Manages UI interactions, live Dijkstra pathfinding, automatic hazard recalculation,
 * route telemetry, and the PRD Section 7 Judge Demo Flow.
 */

class AppCoordinator {
  constructor() {
    this.islands = [];
    this.routes = [];
    this.departureId = null;
    this.destinationId = null;
    this.speedKnots = 10;
    this.currentPathResult = null;
    this.selectedRouteForModal = null;
    this.mapManager = null;
    this.isDemoRunning = false;
  }

  async init() {
    // 1. Initialize Map
    this.mapManager = new MapManager('map').init();

    // Route click callback
    this.mapManager.onRouteClicked = route => this.openRouteModal(route);

    // 2. Load Data from API
    await this.loadArchipelagoData();

    // 3. Bind UI Event Listeners
    this.bindEvents();

    // 4. Check API status
    this.checkApiStatus();

    // 5. Default initial selection for instant impressive view (Skull Cove -> Black Flag Port)
    this.setDefaultPorts();
  }

  async checkApiStatus() {
    const statusDot = document.getElementById('status-indicator-dot');
    const statusText = document.getElementById('status-text');

    try {
      const res = await fetch('/api/islands', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        if (statusDot) statusDot.style.backgroundColor = '#2a9d8f';
        if (statusText) statusText.textContent = 'Archipelago Online (Backend API)';
        return;
      }
    } catch (e) {
      // Backend not running
    }

    if (statusDot) statusDot.style.backgroundColor = '#f5cb5c';
    if (statusText) statusText.textContent = 'Client Autonomous Mode';
  }

  async loadArchipelagoData() {
    this.islands = await ApiService.getIslands();
    this.routes = await ApiService.getRoutes();

    // Populate dropdowns
    this.populatePortSelects();

    // Render on Map
    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.mapManager.fitArchipelago(this.islands);

    // Render Hazard Manager List
    this.renderHazardList();
  }

  populatePortSelects() {
    const depSelect = document.getElementById('departure-select');
    const destSelect = document.getElementById('destination-select');

    if (!depSelect || !destSelect) return;

    depSelect.innerHTML = '<option value="">-- Choose Port of Departure --</option>';
    destSelect.innerHTML = '<option value="">-- Choose Destination Port --</option>';

    this.islands.forEach(island => {
      const opt1 = document.createElement('option');
      opt1.value = island._id;
      opt1.textContent = `${island.name} (${island.lat}°N, ${island.lng}°E)`;
      depSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = island._id;
      opt2.textContent = `${island.name} (${island.lat}°N, ${island.lng}°E)`;
      destSelect.appendChild(opt2);
    });
  }

  setDefaultPorts() {
    const skullCove = this.islands.find(i => i.name.toLowerCase().includes('skull'));
    const blackFlag = this.islands.find(i => i.name.toLowerCase().includes('black flag') || i.name.toLowerCase().includes('storm'));

    if (skullCove && blackFlag) {
      this.setDeparture(skullCove._id);
      this.setDestination(blackFlag._id);
      this.plotCourse();
    }
  }

  bindEvents() {
    // Departure & Destination selects
    const depSelect = document.getElementById('departure-select');
    const destSelect = document.getElementById('destination-select');

    depSelect?.addEventListener('change', e => {
      this.departureId = e.target.value;
      this.updateSelectionVisuals();
    });

    destSelect?.addEventListener('change', e => {
      this.destinationId = e.target.value;
      this.updateSelectionVisuals();
    });

    // Swap Ports
    document.getElementById('swap-ports-btn')?.addEventListener('click', () => {
      const temp = this.departureId;
      this.departureId = this.destinationId;
      this.destinationId = temp;

      if (depSelect) depSelect.value = this.departureId || '';
      if (destSelect) destSelect.value = this.destinationId || '';

      this.updateSelectionVisuals();
      if (this.departureId && this.destinationId) {
        this.plotCourse();
      }
    });

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    speedSlider?.addEventListener('input', e => {
      this.speedKnots = parseInt(e.target.value, 10);
      if (speedDisplay) speedDisplay.textContent = `${this.speedKnots} KTS`;
      this.updateTravelTime();
    });

    // Vessel Presets
    document.querySelectorAll('.vessel-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.vessel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseInt(btn.dataset.speed, 10);
        this.speedKnots = speed;
        if (speedSlider) speedSlider.value = speed;
        if (speedDisplay) speedDisplay.textContent = `${speed} KTS`;
        this.updateTravelTime();
      });
    });

    // Plot Course Button
    document.getElementById('plot-course-btn')?.addEventListener('click', () => {
      this.plotCourse();
    });

    // Scenario Preset: Blockade
    document.getElementById('preset-blockade-btn')?.addEventListener('click', () => {
      this.triggerBlockadeScenario();
    });

    // Scenario Preset: Clear
    document.getElementById('preset-clear-btn')?.addEventListener('click', () => {
      this.clearAllHazards();
    });

    // Judge Demo Button
    document.getElementById('judge-demo-btn')?.addEventListener('click', () => {
      this.runJudgeDemoFlow();
    });

    // Modal Close
    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      this.closeRouteModal();
    });

    // Alert Banner Close
    document.getElementById('alert-close-btn')?.addEventListener('click', () => {
      this.hideRecalculationAlert();
    });
  }

  setDeparture(islandId) {
    this.departureId = islandId;
    const depSelect = document.getElementById('departure-select');
    if (depSelect) depSelect.value = islandId;
    this.updateSelectionVisuals();
    this.mapManager.map.closePopup();
  }

  setDestination(islandId) {
    this.destinationId = islandId;
    const destSelect = document.getElementById('destination-select');
    if (destSelect) destSelect.value = islandId;
    this.updateSelectionVisuals();
    this.mapManager.map.closePopup();
  }

  updateSelectionVisuals() {
    this.mapManager.setSelectedIslands(this.departureId, this.destinationId, this.islands);
  }

  /**
   * Plot Safe Course (Dijkstra)
   */
  async plotCourse(isAutoRecalculate = false) {
    if (!this.departureId || !this.destinationId) {
      alert('Please choose both Departure and Destination ports.');
      return;
    }

    if (this.departureId === this.destinationId) {
      alert('Departure and Destination cannot be the same port.');
      return;
    }

    const previousDistance = this.currentPathResult ? this.currentPathResult.totalDistance : null;

    // Call API / Dijkstra
    const result = await ApiService.calculatePath(
      this.departureId,
      this.destinationId,
      this.speedKnots
    );

    this.currentPathResult = result;

    if (!result || !result.path || result.path.length === 0) {
      this.renderNoPathState(result?.message);
      return;
    }

    // Render active course on map
    this.mapManager.drawCalculatedPath(result.path, this.islands);

    // Update Telemetry HUD
    this.renderTelemetryHUD(result);

    // Render Waypoint breakdown
    this.renderWaypointItinerary(result);

    // If this was an auto-recalculation caused by hazard
    if (isAutoRecalculate && result.isRerouted) {
      const diff = previousDistance ? (result.totalDistance - previousDistance).toFixed(1) : '0';
      const detourText = diff > 0 ? `Detour added +${diff} NM` : 'Alternate passage charted';
      this.showRecalculationAlert(
        '⚠️ Route Automatically Recalculated!',
        `Active passage blocked by hazard or naval patrol. Safest detour plotted (${detourText}).`
      );
    }
  }

  renderTelemetryHUD(result) {
    const distEl = document.getElementById('metric-distance');
    const timeEl = document.getElementById('metric-time');
    const waypointsEl = document.getElementById('metric-waypoints');
    const statusEl = document.getElementById('route-safety-status');

    if (distEl) distEl.textContent = result.totalDistance.toFixed(1);

    // Format ETA
    const totalHours = result.estimatedTimeHours || result.totalDistance / this.speedKnots;
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (timeEl) timeEl.textContent = `${hours}h ${minutes}m`;

    if (waypointsEl) waypointsEl.textContent = `${result.path.length} Ports`;

    if (statusEl) {
      if (result.isRerouted) {
        statusEl.className = 'route-safety-status rerouted';
        statusEl.innerHTML = `<span>🛡️</span> Hazard Evaded (${result.hazardsAvoided || 1} Blockade Rerouted)`;
      } else {
        statusEl.className = 'route-safety-status safe';
        statusEl.innerHTML = `<span>⚓</span> Safe Sea Lane Plotted`;
      }
    }
  }

  updateTravelTime() {
    if (!this.currentPathResult) return;
    const timeEl = document.getElementById('metric-time');
    const totalHours = this.currentPathResult.totalDistance / this.speedKnots;
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (timeEl) timeEl.textContent = `${hours}h ${minutes}m`;
  }

  renderWaypointItinerary(result) {
    const container = document.getElementById('itinerary-list');
    if (!container) return;

    container.innerHTML = '';

    const islandMap = {};
    this.islands.forEach(i => {
      islandMap[String(i._id)] = i;
    });

    result.path.forEach((id, index) => {
      const isl = islandMap[String(id)];
      if (!isl) return;

      const item = document.createElement('div');
      item.className = 'itinerary-item';

      const isFirst = index === 0;
      const isLast = index === result.path.length - 1;
      const roleLabel = isFirst ? ' (Origin)' : isLast ? ' (Destination)' : '';

      item.innerHTML = `
        <div class="itinerary-step-left">
          <div class="step-num-badge">${index + 1}</div>
          <span class="step-island-name">${isl.name}${roleLabel}</span>
        </div>
        <span class="step-distance">${isl.lat}°N, ${isl.lng}°E</span>
      `;

      container.appendChild(item);
    });
  }

  renderNoPathState(message) {
    const statusEl = document.getElementById('route-safety-status');
    if (statusEl) {
      statusEl.className = 'route-safety-status rerouted';
      statusEl.innerHTML = `<span>☠️</span> ${message || 'No safe passage available'}`;
    }
    const container = document.getElementById('itinerary-list');
    if (container) {
      container.innerHTML = `<div style="padding:10px; color:#ff758f; font-size:0.75rem;">All connecting sea lanes are blocked by naval patrols or hazards. Clear a route to chart course.</div>`;
    }
    this.mapManager.activeRouteLayer.clearLayers();
  }

  /**
   * Hazard Manager in Sidebar
   */
  renderHazardList() {
    const container = document.getElementById('hazard-list-container');
    if (!container) return;

    container.innerHTML = '';

    this.routes.forEach(route => {
      const fromName = route.fromIsland?.name || 'Island A';
      const toName = route.toIsland?.name || 'Island B';

      const row = document.createElement('div');
      row.className = `hazard-route-row ${route.isHazard ? 'is-active-hazard' : ''} ${route.isPatrolZone ? 'is-active-patrol' : ''}`;

      row.innerHTML = `
        <div class="hazard-route-info">
          <span class="route-endpoints">${fromName} ⟷ ${toName}</span>
          <span class="route-meta">${route.distance} NM &bull; ${route.isHazard ? 'Tempest' : route.isPatrolZone ? 'Naval Patrol' : 'Clear'}</span>
        </div>
        <div class="hazard-toggle-group">
          <button class="toggle-badge-btn ${route.isHazard ? 'hazard-on' : ''}" data-type="hazard" title="Toggle Sea Tempest">
            ⚠️ Hazard
          </button>
          <button class="toggle-badge-btn ${route.isPatrolZone ? 'patrol-on' : ''}" data-type="patrol" title="Toggle Naval Patrol">
            👑 Patrol
          </button>
        </div>
      `;

      // Event listeners for toggle buttons
      const hazardBtn = row.querySelector('[data-type="hazard"]');
      const patrolBtn = row.querySelector('[data-type="patrol"]');

      hazardBtn.addEventListener('click', async () => {
        const nextState = !route.isHazard;
        await this.applyRouteHazardUpdate(route._id, {
          isHazard: nextState,
          isPatrolZone: nextState ? false : route.isPatrolZone
        });
      });

      patrolBtn.addEventListener('click', async () => {
        const nextState = !route.isPatrolZone;
        await this.applyRouteHazardUpdate(route._id, {
          isHazard: nextState ? false : route.isHazard,
          isPatrolZone: nextState
        });
      });

      container.appendChild(row);
    });
  }

  async applyRouteHazardUpdate(routeId, { isHazard, isPatrolZone }) {
    await ApiService.toggleHazard(routeId, { isHazard, isPatrolZone });

    // Refresh routes
    this.routes = await ApiService.getRoutes();

    // Re-render map and list
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();

    // AUTO RECALCULATION CHECK
    // If we currently have a plotted route, re-run Dijkstra automatically!
    if (this.departureId && this.destinationId) {
      await this.plotCourse(true);
    }
  }

  /**
   * Modal for clicking on a map route
   */
  openRouteModal(route) {
    this.selectedRouteForModal = route;
    const modal = document.getElementById('route-hazard-modal');
    const infoEl = document.getElementById('modal-route-details');

    const fromName = route.fromIsland?.name || 'Island A';
    const toName = route.toIsland?.name || 'Island B';

    if (infoEl) {
      infoEl.innerHTML = `
        <div style="font-size:0.9rem; font-weight:700; color:#f5cb5c; margin-bottom:4px;">
          ${fromName} ⟷ ${toName}
        </div>
        <div style="font-size:0.75rem; color:#8e9fae;">
          Distance: <strong>${route.distance} NM</strong> | Speed: ${route.speed || 10} KTS<br/>
          Current Status: <span style="color:${route.isHazard ? '#ff758f' : route.isPatrolZone ? '#3a86ff' : '#52b788'}; font-weight:600;">
            ${route.isHazard ? '⚠️ Active Maritime Hazard' : route.isPatrolZone ? '👑 Royal Navy Patrol Zone' : '🌊 Clear Safe Sea Lane'}
          </span>
        </div>
      `;
    }

    const hazardBtn = document.getElementById('modal-toggle-hazard-btn');
    const patrolBtn = document.getElementById('modal-toggle-patrol-btn');
    const clearBtn = document.getElementById('modal-clear-btn');

    if (hazardBtn) {
      hazardBtn.onclick = async () => {
        await this.applyRouteHazardUpdate(route._id, { isHazard: true, isPatrolZone: false });
        this.closeRouteModal();
      };
    }

    if (patrolBtn) {
      patrolBtn.onclick = async () => {
        await this.applyRouteHazardUpdate(route._id, { isHazard: false, isPatrolZone: true });
        this.closeRouteModal();
      };
    }

    if (clearBtn) {
      clearBtn.onclick = async () => {
        await this.applyRouteHazardUpdate(route._id, { isHazard: false, isPatrolZone: false });
        this.closeRouteModal();
      };
    }

    modal?.classList.add('active');
  }

  closeRouteModal() {
    document.getElementById('route-hazard-modal')?.classList.remove('active');
  }

  showRecalculationAlert(title, text) {
    const banner = document.getElementById('recalculation-alert-banner');
    const titleEl = document.getElementById('alert-title');
    const descEl = document.getElementById('alert-desc');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = text;

    banner?.classList.add('visible');

    // Auto dismiss after 6 seconds
    clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => {
      this.hideRecalculationAlert();
    }, 6000);
  }

  hideRecalculationAlert() {
    document.getElementById('recalculation-alert-banner')?.classList.remove('visible');
  }

  /**
   * Scenarios
   */
  async triggerBlockadeScenario() {
    // Find the primary leg on current path to block
    if (this.currentPathResult && this.currentPathResult.path.length >= 2) {
      const from = this.currentPathResult.path[0];
      const to = this.currentPathResult.path[1];
      const targetRoute = this.routes.find(r => {
        const rf = String(r.fromIsland._id || r.fromIsland);
        const rt = String(r.toIsland._id || r.toIsland);
        return (rf === from && rt === to) || (rf === to && rt === from);
      });

      if (targetRoute) {
        await this.applyRouteHazardUpdate(targetRoute._id, { isHazard: false, isPatrolZone: true });
        return;
      }
    }

    // Fallback: block first available route
    if (this.routes.length > 0) {
      await this.applyRouteHazardUpdate(this.routes[0]._id, { isHazard: false, isPatrolZone: true });
    }
  }

  async clearAllHazards() {
    await ApiService.resetBaseline();
    this.routes = await ApiService.getRoutes();
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();
    if (this.departureId && this.destinationId) {
      await this.plotCourse(false);
    }
    this.showRecalculationAlert(
      '🌊 All Seas Cleared',
      'All naval patrol blockades and sea tempests lifted. Direct shortest lanes restored.'
    );
  }

  /**
   * PRD Section 7: Judge Demo Flow
   * Steps judges through the exact 5-step presentation script.
   */
  async runJudgeDemoFlow() {
    if (this.isDemoRunning) return;
    this.isDemoRunning = true;

    const banner = document.getElementById('demo-flow-banner');
    const stepBadge = document.getElementById('demo-step-badge');
    const titleEl = document.getElementById('demo-step-title');
    const descEl = document.getElementById('demo-step-desc');

    const updateBanner = (step, title, desc) => {
      if (stepBadge) stepBadge.textContent = `Step ${step}/5`;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = desc;
      banner?.classList.add('active');
    };

    // Step 1: Show Island Network
    updateBanner(
      1,
      'Archipelago Overview',
      '12 pirate islands connected by 22+ charted sea routes with nautical mile weights.'
    );
    await this.clearAllHazards();
    this.mapManager.fitArchipelago(this.islands);
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Select departure and destination & plot course
    updateBanner(
      2,
      'Plot Optimal Course',
      'Selecting Skull Cove ➔ Black Flag Port. Dijkstra calculates direct shortest route.'
    );
    const skull = this.islands.find(i => i.name === 'Skull Cove');
    const blackFlag = this.islands.find(i => i.name === 'Black Flag Port');
    if (skull && blackFlag) {
      this.setDeparture(skull._id);
      this.setDestination(blackFlag._id);
      await this.plotCourse();
    }
    await new Promise(r => setTimeout(r, 3500));

    // Step 3: Trigger a naval patrol hazard on the active route
    updateBanner(
      3,
      'Naval Patrol Declared!',
      'Royal Navy declares a blockade right across the current plotted sea passage!'
    );
    await this.triggerBlockadeScenario();
    await new Promise(r => setTimeout(r, 4000));

    // Step 4: Show recalculated path
    updateBanner(
      4,
      'Instant Live Recalculation',
      'Dijkstra dynamically avoided the penalized blockade and charted a safe detour around it.'
    );
    await new Promise(r => setTimeout(r, 4000));

    // Step 5: Technical summary
    updateBanner(
      5,
      'Technical Architecture Note',
      'Weighted graph shortest-path engine with dynamic edge penalties for real-time maritime avoidance.'
    );
    await new Promise(r => setTimeout(r, 5000));

    banner?.classList.remove('active');
    this.isDemoRunning = false;
  }
}

// Instantiate and attach globally
window.appCoordinator = new AppCoordinator();
document.addEventListener('DOMContentLoaded', () => {
  window.appCoordinator.init();
});
