/**
 * Real-time Geolocation and Manual Location Management Module.
 * Connects directly to device GPS (navigator.geolocation) and
 * provides reverse geocoding via OpenStreetMap Nominatim.
 */

const SAVED_LOCATIONS_KEY = 'sentrywing_saved_locations';

/**
 * Acquire high-accuracy real-time GPS coordinates from device hardware.
 */
export async function getRealTimeLocation() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      return reject(new Error('Geolocation hardware not supported by browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 0);

        let placeName = `Real-Time GPS: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
        try {
          const resolvedName = await reverseGeocode(lat, lng);
          if (resolvedName) {
            placeName = resolvedName;
          }
        } catch (e) {
          console.warn('Reverse geocode fallback:', e);
        }

        resolve({
          lat,
          lng,
          name: placeName,
          accuracy,
          isLive: true,
          timestamp: new Date().toISOString()
        });
      },
      (err) => {
        reject(new Error(err.message || 'Unable to retrieve device GPS fix.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Reverse geocodes coordinates to a human-readable place name.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SentryWing-Wildlife-Intelligence-Platform/2.0'
      }
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.display_name) {
        // Return concise address components (e.g. Village/Subdistrict, District, State)
        const a = data.address || {};
        const parts = [
          a.suburb || a.village || a.town || a.city_district || a.city,
          a.county || a.state_district || a.state,
          a.country
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',');
      }
    }
  } catch (err) {
    console.warn('Reverse geocode request failed:', err);
  }
  return null;
}

/**
 * Load user's saved manual locations from localStorage.
 */
export function getSavedManualLocations() {
  try {
    const raw = localStorage.getItem(SAVED_LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save a new manual location to localStorage.
 */
export function saveManualLocation(loc) {
  try {
    const existing = getSavedManualLocations();
    const newLoc = {
      id: 'loc_' + Date.now().toString(36),
      name: loc.name.trim(),
      lat: parseFloat(parseFloat(loc.lat).toFixed(6)),
      lng: parseFloat(parseFloat(loc.lng).toFixed(6)),
      isLive: false,
      createdAt: new Date().toISOString()
    };
    const updated = [newLoc, ...existing.filter(item => item.name !== newLoc.name)].slice(0, 20);
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save manual location:', e);
    return [];
  }
}

/**
 * Search locations via OpenStreetMap Nominatim forward geocoding.
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query.trim())}&limit=5`;
    const resp = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SentryWing-Wildlife-Intelligence-Platform/2.0'
      }
    });
    if (resp.ok) {
      const data = await resp.json();
      return (data || []).map(item => {
        const parts = item.display_name.split(',').map(s => s.trim());
        const shortName = parts.length > 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
        return {
          id: `search_${item.place_id}`,
          name: item.display_name,
          shortName,
          lat: parseFloat(parseFloat(item.lat).toFixed(6)),
          lng: parseFloat(parseFloat(item.lon).toFixed(6))
        };
      });
    }
  } catch (err) {
    console.warn('Geocode search failed:', err);
  }
  return [];
}

/**
 * Curated Wildlife Reserves & Research Field Stations
 */
export const DEFAULT_PRESET_STATIONS = [
  { id: 'res_corbett', name: 'Jim Corbett National Park, Uttarakhand', shortName: 'Corbett NP', lat: 29.5312, lng: 78.7744, region: 'North' },
  { id: 'res_kaziranga', name: 'Kaziranga National Park, Assam', shortName: 'Kaziranga NP', lat: 26.5775, lng: 93.1711, region: 'East' },
  { id: 'res_gir', name: 'Gir National Park & Wildlife Sanctuary, Gujarat', shortName: 'Gir Forest', lat: 21.1245, lng: 70.8242, region: 'West' },
  { id: 'res_bandipur', name: 'Bandipur Tiger Reserve, Karnataka', shortName: 'Bandipur TR', lat: 11.6664, lng: 76.6291, region: 'South' },
  { id: 'res_ranthambore', name: 'Ranthambore Tiger Reserve, Rajasthan', shortName: 'Ranthambore TR', lat: 26.0173, lng: 76.5026, region: 'North' },
  { id: 'res_sundarbans', name: 'Sundarbans Biosphere Reserve, West Bengal', shortName: 'Sundarbans BR', lat: 21.9497, lng: 89.1833, region: 'East' },
  { id: 'res_periyar', name: 'Periyar Tiger Reserve, Kerala', shortName: 'Periyar TR', lat: 9.4622, lng: 77.2368, region: 'South' }
];

/**
 * Delete a saved manual location.
 */
export function deleteSavedManualLocation(id) {
  try {
    const existing = getSavedManualLocations();
    const updated = existing.filter(l => l.id !== id);
    localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
}

