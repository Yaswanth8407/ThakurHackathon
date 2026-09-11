/**
 * The Pirate Navigation System - Leaflet Map Manager
 * Handles maritime chart rendering, custom SVG pirate markers,
 * route polylines (base, active gold course, hazards, naval patrols),
 * interactive click events, and route animations.
 */

class MapManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.islandMarkers = {};
    this.routePolylines = {};
    this.activePathPolyline = null;
    this.activePathHalo = null;
    this.departureMarkerId = null;
    this.destinationMarkerId = null;

    // Callbacks
    this.onSelectIslandAsDeparture = null;
    this.onSelectIslandAsDestination = null;
    this.onRouteClicked = null;
  }

  init() {
    // Initial archipelago center coordinates
    const initialCenter = [13.0, 77.0];
    const initialZoom = 8;

    this.map = L.map(this.containerId, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 6,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // Custom Zoom control in bottom left
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Free Open-Source Tile Layer (Zero API Key Required)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Layer groups
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.activeRouteLayer = L.layerGroup().addTo(this.map);
    this.hazardIconLayer = L.layerGroup().addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);

    return this;
  }

  /**
   * Render or update island markers
   */
  renderIslands(islands) {
    this.markerLayer.clearLayers();
    this.islandMarkers = {};

    islands.forEach(island => {
      const isDep = String(island._id) === String(this.departureMarkerId);
      const isDest = String(island._id) === String(this.destinationMarkerId);

      const customClass = isDep
        ? 'island-marker-pin departure'
        : isDest
        ? 'island-marker-pin destination'
        : 'island-marker-pin';

      const iconHtml = `
        <div class="${customClass}" id="marker-${island._id}">
          <div class="island-marker-icon">
            <svg viewBox="0 0 24 24">
              ${
                isDep
                  ? '<path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2L18 8v8.6l-6 3.7-6-3.7V8l6-3.8z"/>' // Ship/Compass
                  : isDest
                  ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>' // Target/X
                  : '<path d="M12 2a3 3 0 00-3 3c0 1.3.8 2.4 2 2.8V11H8v2h3v7h2v-7h3v-2h-3V7.8c1.2-.4 2-1.5 2-2.8a3 3 0 00-3-3z"/>' // Anchor
              }
            </svg>
          </div>
          <div class="island-marker-label">${island.name}</div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'custom-island-marker-wrapper',
        html: iconHtml,
        iconSize: [80, 50],
        iconAnchor: [40, 25]
      });

      const marker = L.marker([island.lat, island.lng], { icon: markerIcon });

      // Interactive popup
      const popupContent = `
        <div style="padding: 10px; font-family: 'Inter', sans-serif;">
          <div class="map-popup-header">${island.name}</div>
          <div class="map-popup-desc">
            <strong>Coords:</strong> ${island.lat}°N, ${island.lng}°E<br/>
            ${island.type ? `<strong>Classification:</strong> ${island.type}` : ''}
          </div>
          <div class="map-popup-actions">
            <button class="btn btn-primary map-popup-btn" onclick="window.appCoordinator.setDeparture('${island._id}')">
              ⚓ Set Departure
            </button>
            <button class="btn btn-secondary map-popup-btn" onclick="window.appCoordinator.setDestination('${island._id}')">
              🎯 Set Destination
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 220 });
      this.markerLayer.addLayer(marker);
      this.islandMarkers[String(island._id)] = marker;
    });
  }

  /**
   * Set Highlight Roles for Departure & Destination
   */
  setSelectedIslands(departureId, destinationId, islands) {
    this.departureMarkerId = departureId;
    this.destinationMarkerId = destinationId;
    if (islands) {
      this.renderIslands(islands);
    }
  }

  /**
   * Render Sea Routes
   */
  renderRoutes(routes, islands) {
    this.routeLayer.clearLayers();
    this.hazardIconLayer.clearLayers();
    this.routePolylines = {};

    const islandMap = {};
    islands.forEach(i => {
      islandMap[String(i._id)] = i;
    });

    routes.forEach(route => {
      const fromId = String(route.fromIsland?._id || route.fromIsland);
      const toId = String(route.toIsland?._id || route.toIsland);
      const from = islandMap[fromId];
      const to = islandMap[toId];

      if (!from || !to) return;

      const latlngs = [
        [from.lat, from.lng],
        [to.lat, to.lng]
      ];

      // Base style
      let color = 'rgba(212, 175, 55, 0.3)';
      let dashArray = '5, 8';
      let weight = 2.5;
      let opacity = 0.6;

      if (route.isHazard) {
        color = '#e63946';
        dashArray = '6, 6';
        weight = 3.5;
        opacity = 0.95;
      } else if (route.isPatrolZone) {
        color = '#3a86ff';
        dashArray = '6, 6';
        weight = 3.5;
        opacity = 0.95;
      }

      // Polyline
      const polyline = L.polyline(latlngs, {
        color,
        weight,
        dashArray,
        opacity,
        lineCap: 'round',
        lineJoin: 'round'
      });

      // Hover and Click interaction
      polyline.on('mouseover', () => {
        polyline.setStyle({
          weight: weight + 2,
          opacity: 1
        });
      });

      polyline.on('mouseout', () => {
        polyline.setStyle({
          weight,
          opacity
        });
      });

      polyline.on('click', () => {
        if (this.onRouteClicked) {
          this.onRouteClicked(route);
        }
      });

      // Tooltip
      const hazardText = route.isHazard
        ? '⚠️ DANGER: ACTIVE MARITIME HAZARD'
        : route.isPatrolZone
        ? '⚔️ RESTRICTED: NAVAL PATROL BLOCKADE'
        : '🌊 Open Sea Lane';

      polyline.bindTooltip(
        `<strong>${from.name} ⟷ ${to.name}</strong><br/>${route.distance} NM &bull; ${hazardText}<br/><em>Click sea lane to toggle hazard</em>`,
        { sticky: true, className: 'maritime-route-tooltip' }
      );

      this.routeLayer.addLayer(polyline);
      this.routePolylines[String(route._id)] = polyline;

      // Add badge at midpoint for active hazards or patrol zones
      if (route.isHazard || route.isPatrolZone) {
        const midLat = (from.lat + to.lat) / 2;
        const midLng = (from.lng + to.lng) / 2;
        const iconHtml = route.isHazard
          ? `<div style="background:#e63946; border:1px solid #fff; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; box-shadow:0 0 10px #e63946;">⚠️</div>`
          : `<div style="background:#1d3557; border:1px solid #3a86ff; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; box-shadow:0 0 10px #3a86ff;">👑</div>`;

        const hazardMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: iconHtml,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          }),
          interactive: false
        });
        this.hazardIconLayer.addLayer(hazardMarker);
      }
    });
  }

  /**
   * Draw the Active Calculated Course Polyline
   */
  drawCalculatedPath(pathIslandIds, islands) {
    this.activeRouteLayer.clearLayers();

    if (!pathIslandIds || pathIslandIds.length < 2) return;

    const islandMap = {};
    islands.forEach(i => {
      islandMap[String(i._id)] = i;
    });

    const coords = [];
    for (const id of pathIslandIds) {
      const isl = islandMap[String(id)];
      if (isl) coords.push([isl.lat, isl.lng]);
    }

    if (coords.length < 2) return;

    // Glowing outer halo
    const halo = L.polyline(coords, {
      color: '#ffb703',
      weight: 9,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    });

    // Core radiant gold route line
    const core = L.polyline(coords, {
      color: '#f5cb5c',
      weight: 4.5,
      opacity: 1,
      dashArray: '10, 8',
      lineCap: 'round',
      lineJoin: 'round'
    });

    this.activeRouteLayer.addLayer(halo);
    this.activeRouteLayer.addLayer(core);

    // Zoom/pan to fit the active course
    this.map.fitBounds(L.latLngBounds(coords), {
      padding: [60, 60],
      maxZoom: 9,
      animate: true,
      duration: 0.8
    });
  }

  /**
   * Fit view to all archipelago islands
   */
  fitArchipelago(islands) {
    if (!islands || islands.length === 0) return;
    const bounds = L.latLngBounds(islands.map(i => [i.lat, i.lng]));
    this.map.fitBounds(bounds, { padding: [50, 50], animate: true });
  }
}

window.MapManager = MapManager;
