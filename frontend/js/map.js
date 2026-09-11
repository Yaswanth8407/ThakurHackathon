/**
 * The Pirate Navigation System - Mumbai Map Manager
 * Handles OpenStreetMap rendering centered on Mumbai, custom SVG markers,
 * route polylines in kilometers, map pin picking, and route animations.
 */

class MapManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.map = null;
    this.islandMarkers = {};
    this.routePolylines = {};
    this.activePathPolyline = null;
    this.departureMarkerId = null;
    this.destinationMarkerId = null;
    this.tempPinMarker = null;
    this.isPickingCoordinates = false;
    this.onCoordPickedCallback = null;

    // Callbacks
    this.onRouteClicked = null;
  }

  init() {
    // Mumbai center coordinates
    const initialCenter = [19.0760, 72.8777];
    const initialZoom = 11;

    this.map = L.map(this.containerId, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 8,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    // Custom Zoom control
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    // Free Open-Source OpenStreetMap Tile Layer (NO API KEY REQUIRED)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    // Layer groups
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.activeRouteLayer = L.layerGroup().addTo(this.map);
    this.hazardIconLayer = L.layerGroup().addTo(this.map);
    this.markerLayer = L.layerGroup().addTo(this.map);

    // Map click for coordinate picking
    this.map.on('click', e => {
      if (this.isPickingCoordinates && this.onCoordPickedCallback) {
        const lat = parseFloat(e.latlng.lat.toFixed(4));
        const lng = parseFloat(e.latlng.lng.toFixed(4));
        this.showTempPin(lat, lng);
        this.onCoordPickedCallback(lat, lng);
        this.disableMapClickForCoords();
      }
    });

    return this;
  }

  enableMapClickForCoords(callback) {
    this.isPickingCoordinates = true;
    this.onCoordPickedCallback = callback;
    const mapEl = document.getElementById(this.containerId);
    if (mapEl) mapEl.style.cursor = 'crosshair';
  }

  disableMapClickForCoords() {
    this.isPickingCoordinates = false;
    this.onCoordPickedCallback = null;
    const mapEl = document.getElementById(this.containerId);
    if (mapEl) mapEl.style.cursor = '';
  }

  showTempPin(lat, lng) {
    if (this.tempPinMarker) {
      this.map.removeLayer(this.tempPinMarker);
    }
    const pinIcon = L.divIcon({
      className: 'temp-pin-icon',
      html: `<div style="background:#ffb703; border:2px solid #fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px #ffb703; font-size:12px;">📍</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    this.tempPinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(this.map);
  }

  removeTempPin() {
    if (this.tempPinMarker) {
      this.map.removeLayer(this.tempPinMarker);
      this.tempPinMarker = null;
    }
  }

  /**
   * Render or update Mumbai location markers
   */
  renderIslands(islands) {
    this.markerLayer.clearLayers();
    this.islandMarkers = {};

    islands.forEach(island => {
      const isDep = String(island._id) === String(this.departureMarkerId);
      const isDest = String(island._id) === String(this.destinationMarkerId);
      const isCustom = Boolean(island.isCustom);

      let customClass = 'island-marker-pin';
      if (isDep) customClass += ' departure';
      else if (isDest) customClass += ' destination';
      if (isCustom) customClass += ' custom-node';

      const iconHtml = `
        <div class="${customClass}" id="marker-${island._id}">
          <div class="island-marker-icon">
            <svg viewBox="0 0 24 24">
              ${
                isDep
                  ? '<path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2L18 8v8.6l-6 3.7-6-3.7V8l6-3.8z"/>' // Ship/Compass
                  : isDest
                  ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/>' // Target
                  : isCustom
                  ? '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' // Star for Custom
                  : '<path d="M12 2a3 3 0 00-3 3c0 1.3.8 2.4 2 2.8V11H8v2h3v7h2v-7h3v-2h-3V7.8c1.2-.4 2-1.5 2-2.8a3 3 0 00-3-3z"/>' // Anchor
              }
            </svg>
          </div>
          <div class="island-marker-label">${island.name}${isCustom ? ' ⭐' : ''}</div>
        </div>
      `;

      const markerIcon = L.divIcon({
        className: 'custom-island-marker-wrapper',
        html: iconHtml,
        iconSize: [80, 50],
        iconAnchor: [40, 25]
      });

      const marker = L.marker([island.lat, island.lng], { icon: markerIcon });

      const popupContent = `
        <div style="padding: 10px; font-family: 'Inter', sans-serif;">
          <div class="map-popup-header">${island.name} ${isCustom ? '(Custom Place)' : ''}</div>
          <div class="map-popup-desc">
            <strong>Location:</strong> ${island.lat}°N, ${island.lng}°E<br/>
            ${island.type ? `<strong>Corridor:</strong> ${island.type}` : ''}
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

  setSelectedIslands(departureId, destinationId, islands) {
    this.departureMarkerId = departureId;
    this.destinationMarkerId = destinationId;
    if (islands) {
      this.renderIslands(islands);
    }
  }

  /**
   * Render Sea & Urban Routes
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

      let color = 'rgba(212, 175, 55, 0.35)';
      let dashArray = '5, 8';
      let weight = 2.5;
      let opacity = 0.65;

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

      const polyline = L.polyline(latlngs, {
        color,
        weight,
        dashArray,
        opacity,
        lineCap: 'round',
        lineJoin: 'round'
      });

      polyline.on('mouseover', () => {
        polyline.setStyle({ weight: weight + 2, opacity: 1 });
      });

      polyline.on('mouseout', () => {
        polyline.setStyle({ weight, opacity });
      });

      polyline.on('click', () => {
        if (this.onRouteClicked) {
          this.onRouteClicked(route);
        }
      });

      const hazardText = route.isHazard
        ? '⚠️ DANGER: MARITIME / ROAD HAZARD'
        : route.isPatrolZone
        ? '⚔️ RESTRICTED: NAVAL / POLICE PATROL BLOCKADE'
        : '🌊 Open Sea / Road Corridor';

      polyline.bindTooltip(
        `<strong>${from.name} ⟷ ${to.name}</strong><br/>${route.distance} km &bull; ${hazardText}<br/><em>Click corridor to toggle hazard</em>`,
        { sticky: true, className: 'maritime-route-tooltip' }
      );

      this.routeLayer.addLayer(polyline);
      this.routePolylines[String(route._id)] = polyline;

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

    this.map.fitBounds(L.latLngBounds(coords), {
      padding: [50, 50],
      maxZoom: 12,
      animate: true,
      duration: 0.8
    });
  }

  fitMumbai(islands) {
    if (!islands || islands.length === 0) return;
    const bounds = L.latLngBounds(islands.map(i => [i.lat, i.lng]));
    this.map.fitBounds(bounds, { padding: [40, 40], animate: true });
  }
}

window.MapManager = MapManager;
