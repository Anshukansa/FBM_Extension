/**
 * Storage management utility for the extension
 * Handles reading and writing to Chrome's storage API
 */

// Default settings for the extension
const DEFAULT_SETTINGS = {
    initialized: true,
    telegramToken: '',
    telegramChatId: '',
    location: 'melbourne',
    keywords: [],
    excludedWords: [],
    products: [],
    fixedLat: -37.8136,
    fixedLon: 144.9631,
    monitoringMode: 'auto',
    startTime: '06:30',
    endTime: '22:00',
    modeOnlyPreferred: false,
    nearGoodDeals: true,
    goodDeals: false,
    isMonitoring: false
  };
  
  /**
   * Initialize storage with default settings if not already set
   */
  async function initializeStorage() {
    try {
      const settings = await chrome.storage.sync.get('initialized');
      
      if (!settings.initialized) {
        console.log('Initializing extension storage with default settings');
        await chrome.storage.sync.set(DEFAULT_SETTINGS);
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing storage:', error);
      return false;
    }
  }
  
  /**
   * Get all settings from storage
   * @returns {Promise<Object>} - Settings object
   */
  async function getSettings() {
    try {
      return await chrome.storage.sync.get();
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }
  
  /**
   * Save settings to storage
   * @param {Object} settings - Settings to save
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }
  
  /**
   * Get a specific setting from storage
   * @param {string} key - Setting key
   * @returns {Promise<any>} - Setting value
   */
  async function getSetting(key) {
    try {
      const result = await chrome.storage.sync.get(key);
      return result[key];
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Save a specific setting to storage
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function saveSetting(key, value) {
    try {
      await chrome.storage.sync.set({ [key]: value });
      return true;
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Reset all settings to default values
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function resetSettings() {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }
  
  /**
   * Get the seen listings from local storage
   * @returns {Promise<Set<string>>} - Set of seen listing URLs
   */
  async function getSeenListings() {
    try {
      const result = await chrome.storage.local.get('seenListings');
      return new Set(result.seenListings || []);
    } catch (error) {
      console.error('Error getting seen listings:', error);
      return new Set();
    }
  }
  
  /**
   * Save the seen listings to local storage
   * @param {Set<string>} listings - Set of seen listing URLs
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function saveSeenListings(listings) {
    try {
      await chrome.storage.local.set({ 
        seenListings: Array.from(listings) 
      });
      return true;
    } catch (error) {
      console.error('Error saving seen listings:', error);
      return false;
    }
  }
  
  /**
   * Add a listing to the seen listings
   * @param {string} listingUrl - URL of the listing
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function addSeenListing(listingUrl) {
    try {
      const listings = await getSeenListings();
      listings.add(listingUrl);
      
      // Keep only the most recent 1000 listings to avoid storage limits
      const listingsArray = Array.from(listings);
      if (listingsArray.length > 1000) {
        const trimmedListings = new Set(listingsArray.slice(-1000));
        return await saveSeenListings(trimmedListings);
      }
      
      return await saveSeenListings(listings);
    } catch (error) {
      console.error('Error adding seen listing:', error);
      return false;
    }
  }
  
  /**
   * Clear the seen listings
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function clearSeenListings() {
    try {
      await chrome.storage.local.remove('seenListings');
      return true;
    } catch (error) {
      console.error('Error clearing seen listings:', error);
      return false;
    }
  }
  
  /**
   * Log a message to the extension log
   * @param {string} message - Log message
   * @param {string} type - Log type (info, warning, error)
   */
  async function logMessage(message, type = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const log = { timestamp, message, type };
      
      // Get existing logs
      const result = await chrome.storage.local.get('logs');
      const logs = result.logs || [];
      
      // Add new log
      logs.push(log);
      
      // Keep only the most recent 100 logs
      if (logs.length > 100) {
        logs.shift();
      }
      
      // Save updated logs
      await chrome.storage.local.set({ logs });
    } catch (error) {
      console.error('Error logging message:', error);
    }
  }
  
  /**
   * Get the extension logs
   * @returns {Promise<Array>} - Array of log objects
   */
  async function getLogs() {
    try {
      const result = await chrome.storage.local.get('logs');
      return result.logs || [];
    } catch (error) {
      console.error('Error getting logs:', error);
      return [];
    }
  }
  
  /**
   * Clear the extension logs
   * @returns {Promise<boolean>} - True if successful, false otherwise
   */
  async function clearLogs() {
    try {
      await chrome.storage.local.remove('logs');
      return true;
    } catch (error) {
      console.error('Error clearing logs:', error);
      return false;
    }
  }
  
  // Export functions for use in other files
  export {
    initializeStorage,
    getSettings,
    saveSettings,
    getSetting,
    saveSetting,
    resetSettings,
    getSeenListings,
    saveSeenListings,
    addSeenListing,
    clearSeenListings,
    logMessage,
    getLogs,
    clearLogs
  };