/**
 * The Pirate Navigation System - Mumbai Coordinator
 * Manages UI interactions, live Dijkstra pathfinding in kilometers,
 * automatic hazard recalculation, custom place creation, and Mumbai demo flow.
 */

class AppCoordinator {
  constructor() {
    this.islands = [];
    this.routes = [];
    this.departureId = null;
    this.destinationId = null;
    this.speedKmH = 30;
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
    await this.loadMumbaiData();

    // 3. Bind UI Event Listeners
    this.bindEvents();

    // 4. Check API status
    this.checkApiStatus();

    // 5. Default initial selection: Kurla -> Thane
    this.setDefaultPorts();
  }

  async checkApiStatus() {
    const statusDot = document.getElementById('status-indicator-dot');
    const statusText = document.getElementById('status-text');

    try {
      const res = await fetch('/api/islands', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        if (statusDot) statusDot.style.backgroundColor = '#2a9d8f';
        if (statusText) statusText.textContent = 'Backend Connected (Port 3000)';
        return;
      }
    } catch (e) {
      // Backend not running directly on same host
    }

    if (statusDot) statusDot.style.backgroundColor = '#f5cb5c';
    if (statusText) statusText.textContent = 'Autonomous Engine (Client/API Ready)';
  }

  async loadMumbaiData() {
    this.islands = await ApiService.getIslands();
    this.routes = await ApiService.getRoutes();

    this.populatePortSelects();

    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.mapManager.fitMumbai(this.islands);

    this.renderHazardList();
  }

  populatePortSelects() {
    const depSelect = document.getElementById('departure-select');
    const destSelect = document.getElementById('destination-select');

    if (!depSelect || !destSelect) return;

    depSelect.innerHTML = '<option value="">-- Choose Starting Point --</option>';
    destSelect.innerHTML = '<option value="">-- Choose Ending Point --</option>';

    this.islands.forEach(island => {
      const opt1 = document.createElement('option');
      opt1.value = island._id;
      opt1.textContent = `${island.name}${island.isCustom ? ' (Custom)' : ''} (${island.lat}°N, ${island.lng}°E)`;
      depSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = island._id;
      opt2.textContent = `${island.name}${island.isCustom ? ' (Custom)' : ''} (${island.lat}°N, ${island.lng}°E)`;
      destSelect.appendChild(opt2);
    });

    if (this.departureId) depSelect.value = this.departureId;
    if (this.destinationId) destSelect.value = this.destinationId;
  }

  setDefaultPorts() {
    const kurla = this.islands.find(i => i.name.toLowerCase().includes('kurla'));
    const thane = this.islands.find(i => i.name.toLowerCase().includes('thane'));

    if (kurla && thane) {
      this.setDeparture(kurla._id);
      this.setDestination(thane._id);
      this.plotCourse();
    }
  }

  bindEvents() {
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

    // Speed Slider (km/h)
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    speedSlider?.addEventListener('input', e => {
      this.speedKmH = parseInt(e.target.value, 10);
      if (speedDisplay) speedDisplay.textContent = `${this.speedKmH} km/h`;
      this.updateTravelTime();
    });

    // Speed Presets
    document.querySelectorAll('.vessel-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.vessel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseInt(btn.dataset.speed, 10);
        this.speedKmH = speed;
        if (speedSlider) speedSlider.value = speed;
        if (speedDisplay) speedDisplay.textContent = `${speed} km/h`;
        this.updateTravelTime();
      });
    });

    // Plot Course
    document.getElementById('plot-course-btn')?.addEventListener('click', () => {
      this.plotCourse();
    });

    // Scenario Preset: Blockade
    document.getElementById('preset-blockade-btn')?.addEventListener('click', () => {
      this.triggerBlockadeScenario();
    });

    // Clear Hazards
    document.getElementById('preset-clear-btn')?.addEventListener('click', () => {
      this.clearAllHazards();
    });

    // Judge Demo
    document.getElementById('judge-demo-btn')?.addEventListener('click', () => {
      this.runJudgeDemoFlow();
    });

    // Hazard Modal Close
    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      this.closeRouteModal();
    });

    // Recalculation Alert Close
    document.getElementById('alert-close-btn')?.addEventListener('click', () => {
      this.hideRecalculationAlert();
    });

    // Custom Place Modal
    document.getElementById('open-custom-place-modal-btn')?.addEventListener('click', () => {
      this.openCustomPlaceModal();
    });

    document.getElementById('custom-modal-close-btn')?.addEventListener('click', () => {
      this.closeCustomPlaceModal();
    });

    // Pick Coordinates on Map
    document.getElementById('pick-on-map-btn')?.addEventListener('click', () => {
      this.closeCustomPlaceModal();
      this.showRecalculationAlert(
        '🎯 Map Coordinate Picker Active',
        'Click anywhere on the Mumbai map to drop a pin and set your custom starting/ending point.'
      );
      this.mapManager.enableMapClickForCoords((lat, lng) => {
        document.getElementById('custom-place-lat').value = lat;
        document.getElementById('custom-place-lng').value = lng;
        this.openCustomPlaceModal();
        this.showRecalculationAlert(
          '📍 Pin Dropped!',
          `Selected coordinates: ${lat}°N, ${lng}°E. Enter a name and click Save.`
        );
      });
    });

    // Save Custom Place
    document.getElementById('save-custom-place-btn')?.addEventListener('click', async () => {
      await this.handleSaveCustomPlace();
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
   * Plot Safe Route in Kilometers
   */
  async plotCourse(isAutoRecalculate = false) {
    if (!this.departureId || !this.destinationId) {
      alert('Please choose both Departure and Destination locations.');
      return;
    }

    if (this.departureId === this.destinationId) {
      alert('Departure and Destination cannot be the same place.');
      return;
    }

    const previousDistance = this.currentPathResult ? this.currentPathResult.totalDistance : null;

    const result = await ApiService.calculatePath(
      this.departureId,
      this.destinationId,
      this.speedKmH
    );

    this.currentPathResult = result;

    if (!result || !result.path || result.path.length === 0) {
      this.renderNoPathState(result?.message);
      return;
    }

    this.mapManager.drawCalculatedPath(result.path, this.islands);
    this.renderTelemetryHUD(result);
    this.renderWaypointItinerary(result);

    if (isAutoRecalculate && result.isRerouted) {
      const diff = previousDistance ? (result.totalDistance - previousDistance).toFixed(1) : '0';
      const detourText = diff > 0 ? `Detour added +${diff} km` : 'Alternative safe route found';
      this.showRecalculationAlert(
        '⚠️ Route Recalculated!',
        `Active corridor blocked by hazard or blockade. Safest detour plotted (${detourText}).`
      );
    }
  }

  renderTelemetryHUD(result) {
    const distEl = document.getElementById('metric-distance');
    const timeEl = document.getElementById('metric-time');
    const waypointsEl = document.getElementById('metric-waypoints');
    const statusEl = document.getElementById('route-safety-status');

    if (distEl) distEl.textContent = result.totalDistance.toFixed(1);

    const totalHours = result.estimatedTimeHours || result.totalDistance / this.speedKmH;
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (timeEl) timeEl.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;

    if (waypointsEl) waypointsEl.textContent = `${result.path.length} Stops`;

    if (statusEl) {
      if (result.isRerouted) {
        statusEl.className = 'route-safety-status rerouted';
        statusEl.innerHTML = `<span>🛡️</span> Hazard Evaded (${result.hazardsAvoided || 1} Detour Plotted)`;
      } else {
        statusEl.className = 'route-safety-status safe';
        statusEl.innerHTML = `<span>⚓</span> Clear Safe Corridor Plotted`;
      }
    }
  }

  updateTravelTime() {
    if (!this.currentPathResult) return;
    const timeEl = document.getElementById('metric-time');
    const totalHours = this.currentPathResult.totalDistance / this.speedKmH;
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (timeEl) timeEl.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} mins`;
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
      container.innerHTML = `<div style="padding:10px; color:#ff758f; font-size:0.75rem;">All connecting corridors are blocked. Clear a route to chart passage.</div>`;
    }
    this.mapManager.activeRouteLayer.clearLayers();
  }

  renderHazardList() {
    const container = document.getElementById('hazard-list-container');
    if (!container) return;

    container.innerHTML = '';

    this.routes.forEach(route => {
      const fromName = route.fromIsland?.name || 'Place A';
      const toName = route.toIsland?.name || 'Place B';

      const row = document.createElement('div');
      row.className = `hazard-route-row ${route.isHazard ? 'is-active-hazard' : ''} ${route.isPatrolZone ? 'is-active-patrol' : ''}`;

      row.innerHTML = `
        <div class="hazard-route-info">
          <span class="route-endpoints">${fromName} ⟷ ${toName}</span>
          <span class="route-meta">${route.distance} km &bull; ${route.isHazard ? 'Hazard' : route.isPatrolZone ? 'Patrol' : 'Clear'}</span>
        </div>
        <div class="hazard-toggle-group">
          <button class="toggle-badge-btn ${route.isHazard ? 'hazard-on' : ''}" data-type="hazard" title="Toggle Hazard">
            ⚠️ Hazard
          </button>
          <button class="toggle-badge-btn ${route.isPatrolZone ? 'patrol-on' : ''}" data-type="patrol" title="Toggle Patrol Blockade">
            👑 Patrol
          </button>
        </div>
      `;

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

    this.routes = await ApiService.getRoutes();
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();

    if (this.departureId && this.destinationId) {
      await this.plotCourse(true);
    }
  }

  openRouteModal(route) {
    this.selectedRouteForModal = route;
    const modal = document.getElementById('route-hazard-modal');
    const infoEl = document.getElementById('modal-route-details');

    const fromName = route.fromIsland?.name || 'Place A';
    const toName = route.toIsland?.name || 'Place B';

    if (infoEl) {
      infoEl.innerHTML = `
        <div style="font-size:0.9rem; font-weight:700; color:#f5cb5c; margin-bottom:4px;">
          ${fromName} ⟷ ${toName}
        </div>
        <div style="font-size:0.75rem; color:#8e9fae;">
          Distance: <strong>${route.distance} km</strong> | Speed: ${route.speed || 30} km/h<br/>
          Current Status: <span style="color:${route.isHazard ? '#ff758f' : route.isPatrolZone ? '#3a86ff' : '#52b788'}; font-weight:600;">
            ${route.isHazard ? '⚠️ Active Maritime / Road Hazard' : route.isPatrolZone ? '👑 Restricted Patrol Blockade' : '🌊 Clear Safe Corridor'}
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

  openCustomPlaceModal() {
    document.getElementById('custom-place-modal')?.classList.add('active');
  }

  closeCustomPlaceModal() {
    document.getElementById('custom-place-modal')?.classList.remove('active');
  }

  async handleSaveCustomPlace() {
    const nameInput = document.getElementById('custom-place-name');
    const latInput = document.getElementById('custom-place-lat');
    const lngInput = document.getElementById('custom-place-lng');

    const name = nameInput.value.trim();
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!name) {
      alert('Please provide a name for this custom location.');
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid numerical latitude and longitude, or click "Click On Map to Pick Coordinates".');
      return;
    }

    // Create custom place via API
    const newPlace = await ApiService.createCustomPlace(name, lat, lng);

    // Refresh data
    this.islands = await ApiService.getIslands();
    this.routes = await ApiService.getRoutes();

    this.populatePortSelects();
    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();

    this.closeCustomPlaceModal();
    this.mapManager.removeTempPin();

    // Auto set as Destination or Departure
    if (!this.departureId) {
      this.setDeparture(newPlace._id);
    } else {
      this.setDestination(newPlace._id);
      this.plotCourse();
    }

    this.showRecalculationAlert(
      '⭐ Custom Place Added!',
      `"${newPlace.name}" added and automatically connected to nearest Mumbai network nodes!`
    );
  }

  showRecalculationAlert(title, text) {
    const banner = document.getElementById('recalculation-alert-banner');
    const titleEl = document.getElementById('alert-title');
    const descEl = document.getElementById('alert-desc');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = text;

    banner?.classList.add('visible');

    clearTimeout(this.alertTimeout);
    this.alertTimeout = setTimeout(() => {
      this.hideRecalculationAlert();
    }, 6000);
  }

  hideRecalculationAlert() {
    document.getElementById('recalculation-alert-banner')?.classList.remove('visible');
  }

  async triggerBlockadeScenario() {
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
      '🌊 All Corridors Cleared',
      'All patrol blockades and hazards lifted. Direct shortest paths restored.'
    );
  }

  /**
   * Mumbai Demo Flow (PRD Section 7)
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

    // Step 1: Network Overview
    updateBanner(
      1,
      'Mumbai Network Overview',
      'Displaying Mumbai corridors (Kurla, Thane, Bandra, Colaba, Vashi) with kilometer distances.'
    );
    await this.clearAllHazards();
    this.mapManager.fitMumbai(this.islands);
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Plot Kurla to Thane
    updateBanner(
      2,
      'Plot Optimal Route',
      'Plotting Kurla ➔ Thane. Dijkstra finds shortest route via Ghatkopar (20.7 km).'
    );
    const kurla = this.islands.find(i => i.name === 'Kurla');
    const thane = this.islands.find(i => i.name === 'Thane');
    if (kurla && thane) {
      this.setDeparture(kurla._id);
      this.setDestination(thane._id);
      await this.plotCourse();
    }
    await new Promise(r => setTimeout(r, 3500));

    // Step 3: Trigger blockade on Ghatkopar-Thane
    updateBanner(
      3,
      'Patrol Blockade Declared!',
      'Declaring a blockade on Ghatkopar ⟷ Thane corridor!'
    );
    const gkThane = this.routes.find(r => 
      (r.fromIsland?.name === 'Ghatkopar' && r.toIsland?.name === 'Thane') ||
      (r.fromIsland?.name === 'Thane' && r.toIsland?.name === 'Ghatkopar')
    );
    if (gkThane) {
      await this.applyRouteHazardUpdate(gkThane._id, { isHazard: false, isPatrolZone: true });
    } else {
      await this.triggerBlockadeScenario();
    }
    await new Promise(r => setTimeout(r, 4000));

    // Step 4: Live Recalculation around hazard
    updateBanner(
      4,
      'Instant Live Recalculation',
      'Dijkstra dynamically avoided the blockade and rerouted via Vashi (33.7 km)!'
    );
    await new Promise(r => setTimeout(r, 4000));

    // Step 5: Technical Architecture
    updateBanner(
      5,
      'Technical Architecture Note',
      'Real-time Dijkstra over a weighted Mumbai graph with dynamic hazard penalties & kilometers.'
    );
    await new Promise(r => setTimeout(r, 5000));

    banner?.classList.remove('active');
    this.isDemoRunning = false;
  }
}

window.appCoordinator = new AppCoordinator();
document.addEventListener('DOMContentLoaded', () => {
  window.appCoordinator.init();
});
