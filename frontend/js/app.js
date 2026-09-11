/**
 * The Pirate Navigation System - Lakshadweep Archipelago Coordinator
 * Manages sub-second Dijkstra pathfinding, multi-tier hazard classification
 * (Clear, Dangerous, Storm-battered, Blocked), days at sea, and risk hazard factor.
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
    await this.loadLakshadweepData();

    // 3. Bind UI Event Listeners
    this.bindEvents();

    // 4. Check API status
    this.checkApiStatus();

    // 5. Default initial selection: Agatti -> Minicoy
    this.setDefaultAtolls();
  }

  async checkApiStatus() {
    const statusDot = document.getElementById('status-indicator-dot');
    const statusText = document.getElementById('status-text');

    try {
      const res = await fetch('/api/islands', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        if (statusDot) statusDot.style.backgroundColor = '#2a9d8f';
        if (statusText) statusText.textContent = 'Archipelago Online (Port 3000)';
        return;
      }
    } catch (e) {
      // Backend offline
    }

    if (statusDot) statusDot.style.backgroundColor = '#f5cb5c';
    // if (statusText) statusText.textContent = 'Sub-Second Autonomous Mode';
  }

  async loadLakshadweepData() {
    this.islands = await ApiService.getIslands();
    this.routes = await ApiService.getRoutes();

    this.populatePortSelects();

    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.mapManager.fitLakshadweep(this.islands);

    this.renderHazardList();
    this.renderAtollHazardList();
  }

  populatePortSelects() {
    const depSelect = document.getElementById('departure-select');
    const destSelect = document.getElementById('destination-select');

    if (!depSelect || !destSelect) return;

    depSelect.innerHTML = '<option value="">-- Choose Departure Atoll --</option>';
    destSelect.innerHTML = '<option value="">-- Choose Destination Atoll --</option>';

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

  setDefaultAtolls() {
    const agatti = this.islands.find(i => i.name.toLowerCase().includes('agatti'));
    const minicoy = this.islands.find(i => i.name.toLowerCase().includes('minicoy'));

    if (agatti && minicoy) {
      this.setDeparture(agatti._id);
      this.setDestination(minicoy._id);
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

    // Swap Atolls
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

    // Speed Slider (Knots)
    const speedSlider = document.getElementById('speed-slider');
    const speedDisplay = document.getElementById('speed-display');

    speedSlider?.addEventListener('input', e => {
      this.speedKnots = parseInt(e.target.value, 10);
      if (speedDisplay) speedDisplay.textContent = `${this.speedKnots} KTS`;
      this.updateTravelTime();
    });

    // Speed Presets
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

    // Plot Course
    document.getElementById('plot-course-btn')?.addEventListener('click', () => {
      this.plotCourse();
    });

    // Scenario Presets
    document.getElementById('preset-blockade-btn')?.addEventListener('click', () => {
      this.triggerBlockadeScenario();
    });

    document.getElementById('preset-storm-btn')?.addEventListener('click', () => {
      this.triggerStormScenario();
    });

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

    // 4-Tier Hazard Modal Actions
    document.getElementById('modal-set-clear-btn')?.addEventListener('click', async () => {
      if (this.selectedRouteForModal) {
        await this.applyRouteHazardUpdate(this.selectedRouteForModal._id, 'Clear');
        this.closeRouteModal();
      }
    });

    document.getElementById('modal-set-dangerous-btn')?.addEventListener('click', async () => {
      if (this.selectedRouteForModal) {
        await this.applyRouteHazardUpdate(this.selectedRouteForModal._id, 'Dangerous');
        this.closeRouteModal();
      }
    });

    document.getElementById('modal-set-storm-btn')?.addEventListener('click', async () => {
      if (this.selectedRouteForModal) {
        await this.applyRouteHazardUpdate(this.selectedRouteForModal._id, 'Storm-battered');
        this.closeRouteModal();
      }
    });

    document.getElementById('modal-set-blocked-btn')?.addEventListener('click', async () => {
      if (this.selectedRouteForModal) {
        await this.applyRouteHazardUpdate(this.selectedRouteForModal._id, 'Blocked');
        this.closeRouteModal();
      }
    });

    // Alert Banner Close
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

    document.getElementById('pick-on-map-btn')?.addEventListener('click', () => {
      this.closeCustomPlaceModal();
      this.showRecalculationAlert(
        '🎯 Coordinate Picker Active',
        'Click anywhere on the Lakshadweep chart to drop an anchorage pin.'
      );
      this.mapManager.enableMapClickForCoords((lat, lng) => {
        document.getElementById('custom-place-lat').value = lat;
        document.getElementById('custom-place-lng').value = lng;
        this.openCustomPlaceModal();
        this.showRecalculationAlert(
          '📍 Anchorage Selected!',
          `Coords: ${lat}°N, ${lng}°E. Name your anchorage and save.`
        );
      });
    });

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
   * Plot Safe Trajectory with Sub-Second Dijkstra Calculation
   */
  async plotCourse(isAutoRecalculate = false) {
    if (!this.departureId || !this.destinationId) {
      alert('Please choose both Departure and Destination atolls.');
      return;
    }

    if (this.departureId === this.destinationId) {
      alert('Departure and Destination cannot be the same atoll.');
      return;
    }

    const t0 = performance.now();
    const previousDistance = this.currentPathResult ? this.currentPathResult.totalDistance : null;

    const result = await ApiService.calculatePath(
      this.departureId,
      this.destinationId,
      this.speedKnots
    );

    const calculationMs = (performance.now() - t0).toFixed(1);
    this.currentPathResult = result;

    if (!result || !result.path || result.path.length === 0) {
      this.renderNoPathState(result?.message);
      return;
    }

    this.mapManager.drawCalculatedPath(result.path, this.islands);
    this.renderTelemetryHUD(result, calculationMs);
    this.renderWaypointItinerary(result);

    if (isAutoRecalculate && result.isRerouted) {
      const diff = previousDistance ? (result.totalDistance - previousDistance).toFixed(1) : '0';
      const detourText = diff > 0 ? `Detour added +${diff} NM` : 'Safe alternative strait charted';
      this.showRecalculationAlert(
        '⚡ Sub-Second Recalculation Complete',
        `Hazard detected on previous passage (${calculationMs}ms execution). Trajectory rerouted (${detourText}).`
      );
    }
  }

  renderTelemetryHUD(result, ms = '0.8') {
    const distEl = document.getElementById('metric-distance');
    const timeEl = document.getElementById('metric-time');
    const riskEl = document.getElementById('metric-risk');
    const waypointsEl = document.getElementById('metric-waypoints');
    const statusEl = document.getElementById('route-safety-status');

    if (distEl) distEl.textContent = result.totalDistance.toFixed(1);

    if (timeEl) {
      timeEl.textContent = result.estimatedDaysAtSea || `${(result.totalDistance / this.speedKnots / 24).toFixed(1)} days`;
    }

    if (riskEl) {
      riskEl.textContent = result.riskHazardFactor || '0% (Calm)';
      const pct = result.riskPercentage || 0;
      if (pct >= 50 || result.isForcedBlocked) {
        riskEl.style.color = '#ff4d6d';
      } else if (pct > 0) {
        riskEl.style.color = '#ffb703';
      } else {
        riskEl.style.color = '#52b788';
      }
    }

    if (waypointsEl) waypointsEl.textContent = `${result.path.length} Atolls`;

    if (statusEl) {
      if (result.isForcedBlocked) {
        statusEl.className = 'route-safety-status rerouted';
        statusEl.innerHTML = `<span>⚠️</span> All Viable Routes Blocked! Forced Through Blockade (${ms}ms)`;
      } else if (result.isRerouted) {
        statusEl.className = 'route-safety-status rerouted';
        statusEl.innerHTML = `<span>🛡️</span> Hazard Evaded (${result.hazardsAvoided || 1} Detour Charted in ${ms}ms)`;
      } else {
        statusEl.className = 'route-safety-status safe';
        statusEl.innerHTML = `<span>⚓</span> Clear Safe Trajectory Plotted (${ms}ms)`;
      }
    }
  }

  updateTravelTime() {
    if (!this.currentPathResult) return;
    const timeEl = document.getElementById('metric-time');
    const totalHours = parseFloat((this.currentPathResult.totalDistance / this.speedKnots).toFixed(1));
    const days = (totalHours / 24).toFixed(1);
    if (timeEl) timeEl.textContent = `${days} days (${totalHours} hrs)`;
  }

  renderWaypointItinerary(result) {
    const container = document.getElementById('itinerary-list');
    if (!container) return;

    container.innerHTML = '';

    const islandMap = {};
    this.islands.forEach(i => (islandMap[String(i._id)] = i));

    result.path.forEach((id, index) => {
      const isl = islandMap[String(id)];
      if (!isl) return;

      const item = document.createElement('div');
      item.className = 'itinerary-item';

      const isFirst = index === 0;
      const isLast = index === result.path.length - 1;
      const roleLabel = isFirst ? ' (Departure)' : isLast ? ' (Destination)' : '';

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
    const distEl = document.getElementById('metric-distance');
    const timeEl = document.getElementById('metric-time');
    const riskEl = document.getElementById('metric-risk');
    const waypointsEl = document.getElementById('metric-waypoints');
    const statusEl = document.getElementById('route-safety-status');

    if (distEl) distEl.textContent = '0.0';
    if (timeEl) timeEl.textContent = '0.0 days';
    if (riskEl) {
      riskEl.textContent = '100% (Blocked)';
      riskEl.style.color = '#ff4d6d';
    }
    if (waypointsEl) waypointsEl.textContent = '0 Atolls';

    if (statusEl) {
      statusEl.className = 'route-safety-status rerouted';
      statusEl.innerHTML = `<span>☠️</span> ${message || 'All viable routes are completely blocked! No safe sea passage found.'}`;
    }
    const container = document.getElementById('itinerary-list');
    if (container) {
      container.innerHTML = `
        <div style="padding:14px; color:#ff758f; font-size:0.78rem; background:rgba(230,57,70,0.16); border:1px solid #e63946; border-radius:4px; line-height:1.45;">
          ⚠️ <strong>WARNING: All viable routes are completely blocked!</strong><br/>
          No safe sea passage found across the Lakshadweep archipelago. All connecting straits or transit atolls are impassable due to blockades or tempestuous conditions. Clear an atoll or strait to restore navigation.
        </div>
      `;
    }
    this.mapManager.activeRouteLayer.clearLayers();
    this.showRecalculationAlert(
      '🚫 All Passages Blocked!',
      message || 'All viable routes are completely blocked! No safe sea passage found.'
    );
  }

  switchHazardTab(tab) {
    const straitsTabBtn = document.getElementById('tab-btn-straits');
    const atollsTabBtn = document.getElementById('tab-btn-atolls');
    const straitsContainer = document.getElementById('hazard-list-container');
    const atollsContainer = document.getElementById('atoll-hazard-list-container');

    if (tab === 'straits') {
      straitsTabBtn?.classList.add('active');
      atollsTabBtn?.classList.remove('active');
      if (straitsContainer) straitsContainer.style.display = 'block';
      if (atollsContainer) atollsContainer.style.display = 'none';
    } else {
      atollsTabBtn?.classList.add('active');
      straitsTabBtn?.classList.remove('active');
      if (straitsContainer) straitsContainer.style.display = 'none';
      if (atollsContainer) atollsContainer.style.display = 'block';
    }
  }

  renderHazardList() {
    const container = document.getElementById('hazard-list-container');
    if (!container) return;

    container.innerHTML = '';

    this.routes.forEach(route => {
      const fromName = route.fromIsland?.name || 'Atoll A';
      const toName = route.toIsland?.name || 'Atoll B';
      const status = route.hazardStatus || 'Clear';

      const row = document.createElement('div');
      row.className = `hazard-route-row ${status !== 'Clear' ? 'is-active-hazard' : ''}`;

      row.innerHTML = `
        <div class="hazard-route-info">
          <span class="route-endpoints">${fromName} ⟷ ${toName}</span>
          <span class="route-meta">${route.distance} NM &bull; <strong style="color:${
            status === 'Dangerous' ? '#ff9f1c' : status === 'Storm-battered' ? '#b5179e' : status === 'Blocked' ? '#e63946' : '#52b788'
          }">${status}</strong></span>
        </div>
        <div class="hazard-toggle-group">
          <select class="strait-status-select" data-id="${route._id}" style="background:#060d14; border:1px solid rgba(212,175,55,0.25); color:#f8edd7; font-size:0.68rem; padding:3px 6px; border-radius:3px; cursor:pointer;">
            <option value="Clear" ${status === 'Clear' ? 'selected' : ''}>🌊 Clear (1.0x)</option>
            <option value="Dangerous" ${status === 'Dangerous' ? 'selected' : ''}>⚠️ Dangerous (2.5x)</option>
            <option value="Storm-battered" ${status === 'Storm-battered' ? 'selected' : ''}>⛈️ Storm (5.0x)</option>
            <option value="Blocked" ${status === 'Blocked' ? 'selected' : ''}>🚫 Blocked</option>
          </select>
        </div>
      `;

      const selectEl = row.querySelector('.strait-status-select');
      selectEl.addEventListener('change', async e => {
        await this.applyRouteHazardUpdate(route._id, e.target.value);
      });

      container.appendChild(row);
    });
  }

  renderAtollHazardList() {
    const container = document.getElementById('atoll-hazard-list-container');
    if (!container) return;

    container.innerHTML = '';

    this.islands.forEach(island => {
      const status = island.hazardStatus || 'Clear';
      const row = document.createElement('div');
      row.className = `hazard-route-row ${status !== 'Clear' ? 'is-active-hazard' : ''}`;

      row.innerHTML = `
        <div class="hazard-route-info">
          <span class="route-endpoints">🏝️ ${island.name}${island.isCustom ? ' ⭐' : ''}</span>
          <span class="route-meta">${island.lat}°N, ${island.lng}°E &bull; <strong style="color:${
            status === 'Dangerous' ? '#ff9f1c' : status === 'Storm-battered' ? '#b5179e' : status === 'Blocked' ? '#e63946' : '#52b788'
          }">${status}</strong></span>
        </div>
        <div class="hazard-toggle-group">
          <select class="atoll-danger-select" data-id="${island._id}" style="background:#060d14; border:1px solid rgba(212,175,55,0.25); color:#f8edd7; font-size:0.68rem; padding:3px 6px; border-radius:3px; cursor:pointer;">
            <option value="Clear" ${status === 'Clear' ? 'selected' : ''}>🌊 Clear (1.0x)</option>
            <option value="Dangerous" ${status === 'Dangerous' ? 'selected' : ''}>⚠️ Dangerous (2.5x)</option>
            <option value="Storm-battered" ${status === 'Storm-battered' ? 'selected' : ''}>⛈️ Storm (5.0x)</option>
            <option value="Blocked" ${status === 'Blocked' ? 'selected' : ''}>🚫 Blocked</option>
          </select>
        </div>
      `;

      const selectEl = row.querySelector('.atoll-danger-select');
      selectEl.addEventListener('change', async e => {
        await this.applyIslandHazardUpdate(island._id, e.target.value);
      });

      container.appendChild(row);
    });
  }

  async applyRouteHazardUpdate(routeId, hazardStatus) {
    const t0 = performance.now();
    await ApiService.setRouteHazard(routeId, hazardStatus);

    this.routes = await ApiService.getRoutes();
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();

    const elapsed = (performance.now() - t0).toFixed(1);

    if (this.departureId && this.destinationId) {
      await this.plotCourse(true);
    }
  }

  async applyIslandHazardUpdate(islandId, hazardStatus) {
    const t0 = performance.now();
    await ApiService.setIslandHazard(islandId, hazardStatus);

    this.islands = await ApiService.getIslands();
    this.mapManager.renderIslands(this.islands);
    this.renderAtollHazardList();

    const elapsed = (performance.now() - t0).toFixed(1);

    if (this.departureId && this.destinationId) {
      await this.plotCourse(true);
      const isl = this.islands.find(i => String(i._id) === String(islandId));
      this.showRecalculationAlert(
        '⚡ Sub-Second Recalculation',
        `Atoll "${isl?.name || 'Atoll'}" danger state set to ${hazardStatus} (${elapsed}ms). Trajectory recalculated.`
      );
    }
  }

  openRouteModal(route) {
    this.selectedRouteForModal = route;
    const modal = document.getElementById('route-hazard-modal');
    const infoEl = document.getElementById('modal-route-details');

    const fromName = route.fromIsland?.name || 'Atoll A';
    const toName = route.toIsland?.name || 'Atoll B';
    const status = route.hazardStatus || 'Clear';

    if (infoEl) {
      infoEl.innerHTML = `
        <div style="font-size:0.95rem; font-weight:700; color:#f5cb5c; margin-bottom:4px;">
          ${fromName} ⟷ ${toName} Strait
        </div>
        <div style="font-size:0.75rem; color:#8e9fae;">
          Distance: <strong>${route.distance} NM</strong> | Speed: ${route.speed || 10} KTS<br/>
          Current Classification: <strong style="color:${
            status === 'Dangerous' ? '#ff9f1c' : status === 'Storm-battered' ? '#b5179e' : status === 'Blocked' ? '#e63946' : '#52b788'
          };">${status}</strong>
        </div>
      `;
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
      alert('Please name your anchorage.');
      return;
    }

    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates or click "Click On Map to Pick Coordinates".');
      return;
    }

    const newPlace = await ApiService.createCustomPlace(name, lat, lng);

    this.islands = await ApiService.getIslands();
    this.routes = await ApiService.getRoutes();

    this.populatePortSelects();
    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();

    this.closeCustomPlaceModal();
    this.mapManager.removeTempPin();

    if (!this.departureId) {
      this.setDeparture(newPlace._id);
    } else {
      this.setDestination(newPlace._id);
      this.plotCourse();
    }

    this.showRecalculationAlert(
      '⭐ Anchorage Charted!',
      `"${newPlace.name}" added to Lakshadweep and connected to nearest atolls!`
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
        await this.applyRouteHazardUpdate(targetRoute._id, 'Blocked');
        return;
      }
    }

    if (this.routes.length > 0) {
      await this.applyRouteHazardUpdate(this.routes[0]._id, 'Blocked');
    }
  }

  async triggerStormScenario() {
    if (this.currentPathResult && this.currentPathResult.path.length >= 2) {
      const from = this.currentPathResult.path[0];
      const to = this.currentPathResult.path[1];
      const targetRoute = this.routes.find(r => {
        const rf = String(r.fromIsland._id || r.fromIsland);
        const rt = String(r.toIsland._id || r.toIsland);
        return (rf === from && rt === to) || (rf === to && rt === from);
      });

      if (targetRoute) {
        await this.applyRouteHazardUpdate(targetRoute._id, 'Storm-battered');
        return;
      }
    }

    if (this.routes.length > 0) {
      await this.applyRouteHazardUpdate(this.routes[0]._id, 'Storm-battered');
    }
  }

  async clearAllHazards() {
    await ApiService.resetBaseline();
    this.routes = await ApiService.getRoutes();
    this.islands = await ApiService.getIslands();
    this.mapManager.renderIslands(this.islands);
    this.mapManager.renderRoutes(this.routes, this.islands);
    this.renderHazardList();
    this.renderAtollHazardList();
    if (this.departureId && this.destinationId) {
      await this.plotCourse(false);
    }
    this.showRecalculationAlert(
      '🌊 Archipelago Waters Cleared',
      'All blockades, storms, and dangerous shoals cleared. Optimal direct sea lanes restored.'
    );
  }

  /**
   * Lakshadweep Demo Flow (PRD Section 7)
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

    // Step 1: Lakshadweep Network Overview
    updateBanner(
      1,
      'Lakshadweep Archipelago Overview',
      '12 coral atolls connected by uncharted coral passages and the 9 Degree Channel.'
    );
    await this.clearAllHazards();
    this.mapManager.fitLakshadweep(this.islands);
    await new Promise(r => setTimeout(r, 3000));

    // Step 2: Plot Agatti to Minicoy
    updateBanner(
      2,
      'Plot Safe Trajectory',
      'Agatti ➔ Minicoy. Dijkstra finds fastest passage via Suheli Par (186.4 NM, 0% risk).'
    );
    const agatti = this.islands.find(i => i.name === 'Agatti');
    const minicoy = this.islands.find(i => i.name === 'Minicoy');
    if (agatti && minicoy) {
      this.setDeparture(agatti._id);
      this.setDestination(minicoy._id);
      await this.plotCourse();
    }
    await new Promise(r => setTimeout(r, 3500));

    // Step 3: Trigger Monsoon Tempest on Suheli Par-Minicoy
    updateBanner(
      3,
      'Monsoon Tempest Declared!',
      'Severe monsoon gale hits Suheli Par ⟷ Minicoy passage (5.0x penalty)!'
    );
    const suheliMinicoy = this.routes.find(r =>
      (r.fromIsland?.name === 'Suheli Par' && r.toIsland?.name === 'Minicoy') ||
      (r.fromIsland?.name === 'Minicoy' && r.toIsland?.name === 'Suheli Par')
    );
    if (suheliMinicoy) {
      await this.applyRouteHazardUpdate(suheliMinicoy._id, 'Storm-battered');
    } else {
      await this.triggerStormScenario();
    }
    await new Promise(r => setTimeout(r, 4000));

    // Step 4: Sub-Second Recalculation
    updateBanner(
      4,
      'Sub-Second Live Detour Plotted',
      'Dijkstra instantly recalculated trajectory via Kalpeni corridor to avoid the tempest!'
    );
    await new Promise(r => setTimeout(r, 4000));

    // Step 5: Technical Summary
    updateBanner(
      5,
      'Technical Architecture Note',
      'Sub-second Dijkstra engine with dynamic multi-tier penalties (Clear, Dangerous, Storm, Blocked).'
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
