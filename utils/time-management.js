/**
 * Time management utility functions
 * Port of Python time_management.py functionality
 */

// Define timezone mappings for supported locations
const LOCATION_TIMEZONES = {
    'melbourne': 'Australia/Melbourne',
    'brisbane': 'Australia/Brisbane',
    'sydney': 'Australia/Sydney',
    // Add more locations as needed
  };
  
  // Default timezone for locations not explicitly mapped
  const DEFAULT_TIMEZONE = 'UTC';
  
  /**
   * Get the timezone for a specific location
   * @param {string} location - Location name
   * @returns {string} - Timezone string
   */
  function getLocationTimezone(location) {
    const locationKey = location.toLowerCase();
    return LOCATION_TIMEZONES[locationKey] || DEFAULT_TIMEZONE;
  }
  
  /**
   * Check if monitoring should be active for the given location based on its local time
   * @param {string} location - Location name
   * @param {Object} settings - User settings
   * @returns {Object} - Status information including isActive, reason, and nextChangeTime
   */
  function isMonitoringActive(location, settings) {
    // Default settings if not provided
    const {
      monitoringMode = 'auto',
      startTime = '06:30',
      endTime = '22:00'
    } = settings || {};
    
    // If manual mode, always respect the monitoring state
    if (monitoringMode === 'manual') {
      return {
        isActive: settings.isMonitoring || false,
        reason: `Manual mode: ${settings.isMonitoring ? 'Active' : 'Inactive'}`,
        nextChangeTime: null
      };
    }
    
    // If always mode, always active
    if (monitoringMode === 'always') {
      return {
        isActive: true,
        reason: 'Always active mode',
        nextChangeTime: null
      };
    }
    
    // Get timezone for location
    const timezone = getLocationTimezone(location);
    
    // Get current time in location's timezone
    const now = new Date().toLocaleString('en-US', { timeZone: timezone });
    const currentTime = new Date(now);
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    
    // Parse monitoring hours from settings
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Calculate if current time is within monitoring period
    const currentTotalMinutes = hours * 60 + minutes;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    const isActive = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    
    // Calculate next change time
    let nextChangeTime = new Date(currentTime);
    if (isActive) {
      // If active, next change is to become inactive
      nextChangeTime.setHours(endHour, endMinute, 0, 0);
      if (nextChangeTime <= currentTime) {
        nextChangeTime.setDate(nextChangeTime.getDate() + 1);
      }
    } else {
      // If inactive, next change is to become active
      nextChangeTime.setHours(startHour, startMinute, 0, 0);
      if (nextChangeTime <= currentTime) {
        nextChangeTime.setDate(nextChangeTime.getDate() + 1);
      }
    }
    
    return {
      isActive,
      reason: isActive 
        ? `Daytime hours in ${location} (local time: ${hours}:${minutes < 10 ? '0' + minutes : minutes})` 
        : `Nighttime hours in ${location} (local time: ${hours}:${minutes < 10 ? '0' + minutes : minutes})`,
      nextChangeTime
    };
  }
  
  /**
   * Get the current monitoring schedule for a location
   * @param {string} location - Location name
   * @param {Object} settings - User settings
   * @returns {Object} - Schedule information including active status, local time, and next status change
   */
  function getMonitoringSchedule(location, settings) {
    // Default settings if not provided
    const {
      monitoringMode = 'auto',
      startTime = '06:30',
      endTime = '22:00'
    } = settings || {};
    
    // If manual mode, return current state
    if (monitoringMode === 'manual') {
      return {
        location,
        timezone: getLocationTimezone(location),
        localTime: new Date().toLocaleString(),
        isActive: settings.isMonitoring || false,
        nextChange: null,
        nextStatus: null,
        activeHours: 'Manual control'
      };
    }
    
    // If always mode, always active
    if (monitoringMode === 'always') {
      return {
        location,
        timezone: getLocationTimezone(location),
        localTime: new Date().toLocaleString(),
        isActive: true,
        nextChange: null,
        nextStatus: null,
        activeHours: 'Always active'
      };
    }
    
    // Get timezone for location
    const timezone = getLocationTimezone(location);
    
    // Get current time in location's timezone
    const now = new Date().toLocaleString('en-US', { timeZone: timezone });
    const currentTime = new Date(now);
    
    // Parse monitoring hours from settings
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    // Calculate if current time is within monitoring period
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const currentTotalMinutes = hours * 60 + minutes;
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    const isActive = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    
    // Calculate next change time
    let nextChange = new Date(currentTime);
    let nextStatus;
    
    if (isActive) {
      // If active, next change is to become inactive
      nextChange.setHours(endHour, endMinute, 0, 0);
      if (nextChange <= currentTime) {
        nextChange.setDate(nextChange.getDate() + 1);
      }
      nextStatus = 'inactive';
    } else {
      // If inactive, next change is to become active
      nextChange.setHours(startHour, startMinute, 0, 0);
      if (nextChange <= currentTime) {
        nextChange.setDate(nextChange.getDate() + 1);
      }
      nextStatus = 'active';
    }
    
    return {
      location,
      timezone,
      localTime: currentTime.toLocaleString(),
      isActive,
      nextChange: nextChange.toISOString(),
      nextStatus,
      activeHours: `${startTime} - ${endTime}`
    };
  }
  
  /**
   * Format time for display
   * @param {Date} date - Date object
   * @returns {string} - Formatted time string (HH:MM)
   */
  function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  // Export functions for use in other files
  export {
    getLocationTimezone,
    isMonitoringActive,
    getMonitoringSchedule,
    formatTime
  };