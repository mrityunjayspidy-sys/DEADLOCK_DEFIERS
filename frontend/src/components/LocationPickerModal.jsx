import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  X,
  Crosshair,
  Search,
  Navigation,
  Compass,
  Check,
  Trash2,
  Layers,
  Globe,
  Trees,
  Bookmark,
  Loader2
} from 'lucide-react';
import {
  reverseGeocode,
  searchLocations,
  getSavedManualLocations,
  saveManualLocation,
  deleteSavedManualLocation,
  DEFAULT_PRESET_STATIONS
} from '../utils/location';

export default function LocationPickerModal({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  onUseLiveGps,
  isGpsLoading,
  soundFx
}) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState('28.6139');
  const [lng, setLng] = useState('77.2090');
  const [saveToPresets, setSaveToPresets] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [activeTab, setActiveTab] = useState('reserves'); // 'reserves' | 'saved'
  const [mapType, setMapType] = useState('dark'); // 'dark' | 'satellite'

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Initialize values when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initialLat = currentLocation?.lat ? currentLocation.lat.toString() : '28.6139';
    const initialLng = currentLocation?.lng ? currentLocation.lng.toString() : '77.2090';
    const initialName = currentLocation?.name || 'Field Station';

    setLat(initialLat);
    setLng(initialLng);
    setName(initialName);
    setSavedLocations(getSavedManualLocations());
    setSearchResults([]);
    setSearchQuery('');
  }, [isOpen, currentLocation]);

  // Handle Leaflet Map Initialization & Tile Switching
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const parsedLat = parseFloat(lat) || 28.6139;
    const parsedLng = parseFloat(lng) || 77.2090;

    const tileUrls = {
      dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };

    const tileAttributions = {
      dark: '&copy; Esri &mdash; National Geographic, DeLorme, NAVTEQ',
      satellite: '&copy; Esri, Maxar, Earthstar Geographics'
    };

    if (!mapInstanceRef.current) {
      // Create map
      const map = L.map(mapContainerRef.current, {
        center: [parsedLat, parsedLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // Zoom control placed bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution
      L.control.attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('&copy; Esri GIS')
        .addTo(map);

      // Tile Layer
      const tileLayer = L.tileLayer(tileUrls[mapType], {
        attribution: tileAttributions[mapType],
        maxZoom: 17
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Custom high-tech marker pin
      const markerIcon = L.divIcon({
        className: 'tactical-pin-wrapper',
        html: `
          <div class="tactical-pulse-pin">
            <span class="pin-radar-ring"></span>
            <span class="pin-inner-glow"></span>
            <span class="pin-center-dot"></span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([parsedLat, parsedLng], { icon: markerIcon }).addTo(map);
      markerRef.current = marker;

      // Click to pin & reverse geocode
      map.on('click', async (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const formattedLat = parseFloat(clickLat.toFixed(6));
        const formattedLng = parseFloat(clickLng.toFixed(6));

        setLat(formattedLat.toString());
        setLng(formattedLng.toString());
        marker.setLatLng([formattedLat, formattedLng]);

        if (soundFx?.playTapClick) soundFx.playTapClick();

        setIsResolvingAddress(true);
        try {
          const resolved = await reverseGeocode(formattedLat, formattedLng);
          if (resolved) {
            setName(resolved);
          }
        } catch (err) {
          console.warn('Reverse geocode error:', err);
        } finally {
          setIsResolvingAddress(false);
        }
      });

      mapInstanceRef.current = map;
    } else {
      // Map already exists, update view
      const map = mapInstanceRef.current;
      map.setView([parsedLat, parsedLng]);
      if (markerRef.current) {
        markerRef.current.setLatLng([parsedLat, parsedLng]);
      }

      // Update tile layer if changed
      if (tileLayerRef.current) {
        tileLayerRef.current.setUrl(tileUrls[mapType]);
      }
    }

    // Force Leaflet to recalculate container dimensions
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 150);
    const t3 = setTimeout(invalidate, 350);
    const t4 = setTimeout(invalidate, 600);

    // ResizeObserver ensures smooth sizing if window or modal changes
    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      resizeObserver.disconnect();
    };
  }, [isOpen, mapType]);

  // Clean up map on unmount/close
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
    }
  }, [isOpen]);

  // Pan map when coordinates manually edited
  const handleLatChange = (val) => {
    setLat(val);
    const numLat = parseFloat(val);
    const numLng = parseFloat(lng);
    if (!isNaN(numLat) && !isNaN(numLng) && mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([numLat, numLng]);
      mapInstanceRef.current.panTo([numLat, numLng]);
    }
  };

  const handleLngChange = (val) => {
    setLng(val);
    const numLat = parseFloat(lat);
    const numLng = parseFloat(val);
    if (!isNaN(numLat) && !isNaN(numLng) && mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([numLat, numLng]);
      mapInstanceRef.current.panTo([numLat, numLng]);
    }
  };

  // Search places via Nominatim
  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(val);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelectSearchResult = (res) => {
    setLat(res.lat.toString());
    setLng(res.lng.toString());
    setName(res.shortName || res.name);
    setSearchResults([]);
    setSearchQuery('');

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([res.lat, res.lng], 13, { duration: 1 });
      markerRef.current.setLatLng([res.lat, res.lng]);
    }

    if (soundFx?.playTapClick) soundFx.playTapClick();
  };

  // Select a preset station (Corbett, Kaziranga, etc.)
  const handleSelectPreset = (preset) => {
    setLat(preset.lat.toString());
    setLng(preset.lng.toString());
    setName(preset.name);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([preset.lat, preset.lng], 13, { duration: 1.2 });
      markerRef.current.setLatLng([preset.lat, preset.lng]);
    }

    if (soundFx?.playTapClick) soundFx.playTapClick();
  };

  // Delete saved custom station
  const handleDeleteSaved = (id, e) => {
    e.stopPropagation();
    const updated = deleteSavedManualLocation(id);
    setSavedLocations(updated);
    if (soundFx?.playTapClick) soundFx.playTapClick();
  };

  // Save and Apply Location
  const handleSaveAndApply = (e) => {
    if (e) e.preventDefault();

    const parsedLat = parseFloat(lat) || 28.6139;
    const parsedLng = parseFloat(lng) || 77.2090;
    const locName = name.trim() || `Field Station (${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)})`;

    const newLoc = {
      lat: parsedLat,
      lng: parsedLng,
      name: locName,
      isLive: false,
      accuracy: null
    };

    if (saveToPresets) {
      const updated = saveManualLocation(newLoc);
      setSavedLocations(updated);
    }

    if (onSelectLocation) {
      onSelectLocation(newLoc);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="location-modal-backdrop" onClick={onClose}>
      <div className="location-modal-shell" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="location-modal-header">
          <div className="header-badge-group">
            <div className="header-icon-pill">
              <Compass size={17} className="text-white" />
            </div>
            <div className="header-text-block">
              <div className="header-title-row">
                <h3 className="location-modal-title">Set Field Station & Location</h3>
                <span className="badge-tactical-mono">GPS OVERLAY</span>
              </div>
              <p className="location-modal-subtitle">
                Click on the map, search reserve names, or fine-tune GPS coordinates.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="location-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="location-modal-grid">
          {/* LEFT: MAP VIEWPORT WITH CONTROLS */}
          <div className="location-map-wrapper">
            {/* Top map toolbar: Search bar + Map switcher */}
            <div className="map-toolbar-overlay">
              <div className="map-search-bar">
                {isSearching ? (
                  <Loader2 size={14} className="search-spin-icon" />
                ) : (
                  <Search size={14} className="search-input-icon" />
                )}
                <input
                  type="text"
                  placeholder="Search wildlife park, outpost, city..."
                  value={searchQuery}
                  onChange={handleSearchInput}
                  className="map-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  >
                    <X size={12} />
                  </button>
                )}

                {/* Autocomplete dropdown */}
                {searchResults.length > 0 && (
                  <div className="map-search-dropdown">
                    {searchResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        className="search-result-row"
                        onClick={() => handleSelectSearchResult(res)}
                      >
                        <MapPin size={13} className="search-result-icon" />
                        <div className="search-result-meta">
                          <span className="search-result-title">{res.shortName}</span>
                          <span className="search-result-sub">{res.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Map layer toggle pills */}
              <div className="map-layer-pills">
                <button
                  type="button"
                  className={`layer-pill-btn ${mapType === 'dark' ? 'active' : ''}`}
                  onClick={() => { setMapType('dark'); if (soundFx?.playTapClick) soundFx.playTapClick(); }}
                  title="Monochrome Tactical Dark View"
                >
                  <Layers size={12} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`layer-pill-btn ${mapType === 'satellite' ? 'active' : ''}`}
                  onClick={() => { setMapType('satellite'); if (soundFx?.playTapClick) soundFx.playTapClick(); }}
                  title="High-Resolution Satellite Imagery"
                >
                  <Globe size={12} />
                  <span>Satellite</span>
                </button>
              </div>
            </div>

            {/* Interactive Leaflet Map Container */}
            <div ref={mapContainerRef} className="interactive-leaflet-box" />

            {/* Bottom Floating Info Badge */}
            <div className="map-coords-floating-pill">
              <Crosshair size={12} className="text-white" />
              <span>
                {parseFloat(lat || 0).toFixed(4)}° N, {parseFloat(lng || 0).toFixed(4)}° E
              </span>
              <span className="map-hint-text">&bull; Click map to pin</span>
            </div>
          </div>

          {/* RIGHT: COORDINATES FORM & QUICK PRESETS */}
          <div className="location-form-wrapper">
            <form onSubmit={handleSaveAndApply} className="location-fields-form">
              {/* Location Identifier / Name */}
              <div className="clean-input-group">
                <label className="clean-field-label">
                  <Compass size={13} />
                  <span>Station / Location Name</span>
                  {isResolvingAddress && <span className="resolving-pill">Resolving address...</span>}
                </label>
                <div className="input-with-icon">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. North Gate Watchtower, River Outpost 4"
                    className="clean-text-input"
                    required
                  />
                </div>
              </div>

              {/* Lat / Lng Grid */}
              <div className="coords-dual-grid">
                <div className="clean-input-group">
                  <label className="clean-field-label">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => handleLatChange(e.target.value)}
                    className="clean-text-input mono-font"
                    required
                  />
                </div>
                <div className="clean-input-group">
                  <label className="clean-field-label">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={lng}
                    onChange={(e) => handleLngChange(e.target.value)}
                    className="clean-text-input mono-font"
                    required
                  />
                </div>
              </div>

              {/* Save to quick presets checkbox */}
              <label className="clean-checkbox-row">
                <input
                  type="checkbox"
                  checked={saveToPresets}
                  onChange={(e) => setSaveToPresets(e.target.checked)}
                  className="clean-checkbox-input"
                />
                <span className="clean-checkbox-text">Save to my custom field stations</span>
              </label>

              {/* Action Buttons */}
              <div className="location-actions-grid">
                <button
                  type="button"
                  className="btn-live-gps-action"
                  onClick={() => {
                    if (onUseLiveGps) onUseLiveGps();
                  }}
                  disabled={isGpsLoading}
                >
                  <Navigation size={14} className={isGpsLoading ? 'search-spin-icon' : ''} />
                  <span>{isGpsLoading ? 'Acquiring GPS...' : 'Use Device GPS'}</span>
                </button>

                <button type="submit" className="btn-apply-location-action">
                  <Check size={16} />
                  <span>Confirm Location</span>
                </button>
              </div>
            </form>

            {/* PRESETS TABS & LIST */}
            <div className="location-presets-section">
              <div className="presets-tabs-bar">
                <button
                  type="button"
                  className={`preset-tab-btn ${activeTab === 'reserves' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reserves')}
                >
                  <Trees size={12} />
                  <span>Wildlife Reserves ({DEFAULT_PRESET_STATIONS.length})</span>
                </button>

                <button
                  type="button"
                  className={`preset-tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
                  onClick={() => setActiveTab('saved')}
                >
                  <Bookmark size={12} />
                  <span>My Saved ({savedLocations.length})</span>
                </button>
              </div>

              <div className="presets-scroll-area">
                {activeTab === 'reserves' && (
                  <div className="presets-cards-stack">
                    {DEFAULT_PRESET_STATIONS.map((res) => (
                      <div
                        key={res.id}
                        className="preset-station-card"
                        onClick={() => handleSelectPreset(res)}
                      >
                        <div className="preset-card-left">
                          <span className="preset-card-region">{res.region}</span>
                          <div className="preset-card-names">
                            <span className="preset-main-name">{res.shortName}</span>
                            <span className="preset-coords-sub">
                              {res.lat.toFixed(3)}°N, {res.lng.toFixed(3)}°E
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-load-preset"
                          onClick={(e) => { e.stopPropagation(); handleSelectPreset(res); }}
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'saved' && (
                  <div className="presets-cards-stack">
                    {savedLocations.length === 0 ? (
                      <div className="empty-saved-placeholder">
                        <MapPin size={22} className="empty-icon" />
                        <p>No saved custom stations yet.</p>
                        <small>Check "Save to my custom field stations" when setting a point.</small>
                      </div>
                    ) : (
                      savedLocations.map((loc) => (
                        <div
                          key={loc.id}
                          className="preset-station-card"
                          onClick={() => handleSelectPreset(loc)}
                        >
                          <div className="preset-card-left">
                            <span className="preset-card-region saved">SAVED</span>
                            <div className="preset-card-names">
                              <span className="preset-main-name">{loc.name}</span>
                              <span className="preset-coords-sub">
                                {parseFloat(loc.lat).toFixed(4)}°N, {parseFloat(loc.lng).toFixed(4)}°E
                              </span>
                            </div>
                          </div>
                          <div className="saved-item-actions">
                            <button
                              type="button"
                              className="btn-load-preset"
                              onClick={(e) => { e.stopPropagation(); handleSelectPreset(loc); }}
                            >
                              Select
                            </button>
                            <button
                              type="button"
                              className="btn-delete-saved-station"
                              onClick={(e) => handleDeleteSaved(loc.id, e)}
                              title="Delete saved location"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
