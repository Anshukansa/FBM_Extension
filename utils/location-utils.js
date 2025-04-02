/**
 * Location utilities for calculating distances and handling geocoding
 * Port of Python location_check.py functionality
 */

// Cache for geocoding results to minimize API calls
let geocodeCache = {};

/**
 * Load geocode cache from storage
 */
async function loadGeocodeCache() {
  try {
    const data = await chrome.storage.local.get('geocodeCache');
    if (data.geocodeCache) {
      geocodeCache = JSON.parse(data.geocodeCache);
    }
  } catch (error) {
    console.error('Error loading geocode cache:', error);
    geocodeCache = {};
  }
}

/**
 * Save geocode cache to storage
 */
async function saveGeocodeCache() {
  try {
    await chrome.storage.local.set({
      geocodeCache: JSON.stringify(geocodeCache)
    });
  } catch (error) {
    console.error('Error saving geocode cache:', error);
  }
}

/**
 * Initialize the location utilities
 */
async function initLocationUtils() {
  await loadGeocodeCache();
}

/**
 * Reverse geocode coordinates to get an address
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} - Address string
 */
async function reverseGeocode(lat, lon) {
  // Round coordinates to reduce cache size and avoid precision issues
  lat = parseFloat(parseFloat(lat).toFixed(6));
  lon = parseFloat(parseFloat(lon).toFixed(6));
  
  // Generate cache key
  const cacheKey = `${lat},${lon}`;
  
  // Check cache first
  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }
  
  try {
    // Use Nominatim API (same as Python version uses through geopy)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'FacebookMarketplaceMonitorExtension/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the relevant address components
    let address = 'Address not found';
    
    if (data && data.address) {
      const components = [];
      
      // Try to get suburb and city/town
      if (data.address.suburb) components.push(data.address.suburb);
      if (data.address.city) components.push(data.address.city);
      else if (data.address.town) components.push(data.address.town);
      else if (data.address.village) components.push(data.address.village);
      
      // Add state if available
      if (data.address.state) components.push(data.address.state);
      
      if (components.length > 0) {
        address = components.join(', ');
      } else {
        // Fallback to display name
        address = data.display_name;
      }
    }
    
    // Cache the result
    geocodeCache[cacheKey] = address;
    await saveGeocodeCache();
    
    return address;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return 'Address not found';
  }
}

/**
 * Calculate distance between two geographic coordinates
 * @param {number} fixedLat - Latitude of fixed point
 * @param {number} fixedLon - Longitude of fixed point
 * @param {number} targetLat - Latitude of target point
 * @param {number} targetLon - Longitude of target point
 * @returns {string} - Distance formatted as "10km"
 */
function calculateDistance(fixedLat, fixedLon, targetLat, targetLon) {
  try {
    // Ensure inputs are floats
    fixedLat = parseFloat(fixedLat);
    fixedLon = parseFloat(fixedLon);
    targetLat = parseFloat(targetLat);
    targetLon = parseFloat(targetLon);
    
    // Validate inputs
    if (isNaN(fixedLat) || isNaN(fixedLon) || isNaN(targetLat) || isNaN(targetLon)) {
      return 'Invalid coordinates';
    }
    
    // Haversine formula to calculate great-circle distance
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(targetLat - fixedLat);
    const dLon = deg2rad(targetLon - fixedLon);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(fixedLat)) * Math.cos(deg2rad(targetLat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km
    
    // Round distance and format
    const distanceRounded = Math.round(distance);
    return `${distanceRounded}km`;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 'Distance calculation error';
  }
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} - Radians
 */
function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Export functions for use in other files
export {
  initLocationUtils,
  reverseGeocode,
  calculateDistance
};