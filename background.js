// Global state
const state = {
  isMonitoring: false,
  seenListings: new Set(),
  firstRun: true,  // Start with firstRun true
  firstRunKeywords: new Set(), // Track which keywords have completed first run
  currentLocation: '',
  monitoringStatus: {},
  activeTab: null,  // Store the active tab for reuse
  previouslyActive: false // Track if monitoring was previously active for first run handling
};

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Facebook Marketplace Monitor installed/updated');
  
  // Prefill settings - based on user data
  const PREFILLED_SETTINGS = {
    telegramToken: '7811938134:AAH4sVBBh9zbt8oecdtdRgAhC5El9ONJfSc',
    telegramChatId: '7932502148',
    location: 'melbourne',
    keywords: ['iPhone'],
    excludedWords: ['Warranty', 'Controller', 'For', 'Stand', 'Car', 'Names', 'Stereo', 'LCD', 'C@$h', 'Ca$h', 'Shop'],
    products: [
      { name: 'iPhone 11', minPrice: 100, maxPrice: 200, preferred: true },
      { name: 'iPhone 11 Pro', minPrice: 100, maxPrice: 250, preferred: true },
      { name: 'iPhone 11 Pro Max', minPrice: 100, maxPrice: 300, preferred: true },
      { name: 'iPhone 12', minPrice: 100, maxPrice: 320, preferred: true },
      { name: 'iPhone 12 Pro', minPrice: 100, maxPrice: 450, preferred: true },
      { name: 'iPhone 12 Pro Max', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 12 Mini', minPrice: 100, maxPrice: 250, preferred: true },
      { name: 'iPhone 13', minPrice: 100, maxPrice: 450, preferred: true },
      { name: 'iPhone 13 Pro', minPrice: 100, maxPrice: 550, preferred: true },
      { name: 'iPhone 13 Pro Max', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 13 Mini', minPrice: 100, maxPrice: 350, preferred: true },
      { name: 'iPhone 14', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 14 Plus', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 14 Pro', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 14 Pro Max', minPrice: 100, maxPrice: 600, preferred: true },
      { name: 'iPhone 8', minPrice: 100, maxPrice: 100, preferred: false },
      { name: 'iPhone 7', minPrice: 100, maxPrice: 100, preferred: false },
      { name: 'iPhone 6', minPrice: 100, maxPrice: 100, preferred: false }
    ],
    fixedLat: -37.9322368,
    fixedLon: 145.1229184,
    monitoringMode: 'auto',
    startTime: '06:30',
    endTime: '22:00',
    modeOnlyPreferred: false,
    nearGoodDeals: true,
    goodDeals: false,
    initialized: true
  };
  
  // Set default settings if not already set
  const settings = await chrome.storage.sync.get('initialized');
  if (!settings.initialized) {
    console.log('Initializing with prefilled settings...');
    await chrome.storage.sync.set(PREFILLED_SETTINGS);
  }
  
  // Load first run state
  const firstRunData = await chrome.storage.local.get(['firstRun', 'firstRunKeywords']);
  if (firstRunData.firstRun !== undefined) {
    state.firstRun = firstRunData.firstRun;
  }
  if (firstRunData.firstRunKeywords) {
    state.firstRunKeywords = new Set(firstRunData.firstRunKeywords);
  }
  
  // Load seen listings from storage
  const seenListingsData = await chrome.storage.local.get('seenListings');
  if (seenListingsData.seenListings) {
    state.seenListings = new Set(seenListingsData.seenListings);
    console.log(`Loaded ${state.seenListings.size} seen listings from storage`);
  }
  
  // Setup continuous checking (instead of using alarms)
  // Only set up the schedule check alarm
  chrome.alarms.create('updateSchedule', { periodInMinutes: 15 });
  
  // Start the continuous checking process immediately
  if (state.isMonitoring) {
    startContinuousMonitoring();
  }
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'updateSchedule') {
    await updateMonitoringSchedule();
  }
});

// Reset first run state when transitioning from inactive to active
async function resetFirstRunState() {
  console.log("Transition from inactive to active detected. Treating as first run.");
  state.firstRunKeywords.clear();
  state.firstRun = true;
  await chrome.storage.local.set({
    firstRun: true,
    firstRunKeywords: []
  });
}

// Start continuous monitoring loop
async function startContinuousMonitoring() {
  // Only start if not already monitoring
  if (!state.isMonitoring) {
    console.log('Starting continuous monitoring');
    
    // Reset first run state when user manually starts monitoring
    await resetFirstRunState();
    
    state.isMonitoring = true;
    
    // Update badge to indicate active status
    chrome.action.setBadgeText({
      text: 'ON'
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#4CAF50'
    });
    
    // Start the first check
    await checkMarketplace();
  }
}

// Check if monitoring should be active based on time
async function isMonitoringActive(location) {
  const settings = await chrome.storage.sync.get();
  
  // If manual mode, always respect the monitoring state
  if (settings.monitoringMode === 'manual') {
    return {
      isActive: state.isMonitoring,
      reason: `Manual mode: ${state.isMonitoring ? 'Active' : 'Inactive'}`,
      nextChangeTime: null
    };
  }
  
  // If always mode, always active (for testing)
  if (settings.monitoringMode === 'always') {
    return {
      isActive: true,
      reason: 'Always active mode (testing)',
      nextChangeTime: null
    };
  }
  
  // Get timezone for location
  const timezones = {
    'melbourne': 'Australia/Melbourne',
    'brisbane': 'Australia/Brisbane',
    'sydney': 'Australia/Sydney'
    // Add more as needed
  };
  
  const timezone = timezones[location.toLowerCase()] || 'UTC';
  
  // Get current time in location's timezone
  const now = new Date().toLocaleString('en-US', { timeZone: timezone });
  const currentTime = new Date(now);
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  
  // Parse monitoring hours from settings
  const [startHour, startMinute] = settings.startTime.split(':').map(Number);
  const [endHour, endMinute] = settings.endTime.split(':').map(Number);
  
  // Calculate if current time is within monitoring period
  const currentTotalMinutes = hours * 60 + minutes;
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  
  const isActive = currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
  
  // If monitoring was previously inactive and is now active, reset first run
  if (!state.previouslyActive && isActive) {
    await resetFirstRunState();
  }
  
  // Update previous state
  state.previouslyActive = isActive;
  
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

// Update monitoring schedule
async function updateMonitoringSchedule() {
  const settings = await chrome.storage.sync.get();
  const location = settings.location;
  
  if (!location) return;
  
  const status = await isMonitoringActive(location);
  
  // If status has changed, notify
  if (state.monitoringStatus[location]?.isActive !== status.isActive) {
    await notifyStatusChange(location, status.isActive, status.reason, status.nextChangeTime);
  }
  
  state.monitoringStatus[location] = status;
  
  // Update badge text
  chrome.action.setBadgeText({
    text: status.isActive ? 'ON' : 'OFF'
  });
  
  chrome.action.setBadgeBackgroundColor({
    color: status.isActive ? '#4CAF50' : '#F44336'
  });
}

// Send notification about monitoring status change
async function notifyStatusChange(location, isActive, reason, nextChangeTime) {
  const settings = await chrome.storage.sync.get();
  
  if (!settings.telegramToken || !settings.telegramChatId) {
    console.log('Telegram not configured, skipping notification');
    return;
  }
  
  const nextTimeStr = nextChangeTime ? 
    `${nextChangeTime.getHours()}:${nextChangeTime.getMinutes() < 10 ? '0' + nextChangeTime.getMinutes() : nextChangeTime.getMinutes()}` : 
    'Unknown';
  
  const message = isActive 
    ? `📢 Monitoring has been resumed for ${location}.\nReason: ${reason}\nWill stop at: ${nextTimeStr}`
    : `🛑 Monitoring has been paused for ${location}.\nReason: ${reason}\nWill resume at: ${nextTimeStr}`;
  
  await sendTelegramMessage(settings.telegramToken, settings.telegramChatId, message);
}

// Check Facebook Marketplace for new listings
async function checkMarketplace() {
  if (!state.isMonitoring) {
    console.log('Monitoring stopped, ending check cycle');
    return;
  }

  const settings = await chrome.storage.sync.get();
  
  // Check if we have the necessary configuration
  if (!settings.telegramToken || !settings.telegramChatId || !settings.location || !settings.keywords || settings.keywords.length === 0) {
    console.log('Incomplete configuration, will retry in a few seconds');
    scheduleNextCheck();
    return;
  }
  
  // Update state
  state.currentLocation = settings.location;
  
  // Check if monitoring should be active
  const monitoringStatus = await isMonitoringActive(settings.location);
  state.monitoringStatus[settings.location] = monitoringStatus;
  
  if (!monitoringStatus.isActive) {
    console.log(`Monitoring inactive for ${settings.location}: ${monitoringStatus.reason}`);
    scheduleNextCheck();
    return;
  }
  
  console.log(`Beginning marketplace check for ${settings.keywords.length} keywords in ${settings.location}`);
  
  // Check each keyword
  for (const keyword of settings.keywords) {
    if (!state.isMonitoring) {
      console.log('Monitoring stopped during keyword checks, ending cycle');
      return;
    }
    await checkKeyword(keyword, settings);
  }
  
  // Update and save first run state to storage
  if (state.firstRun && state.firstRunKeywords.size >= settings.keywords.length) {
    state.firstRun = false;
    await chrome.storage.local.set({ firstRun: false });
    console.log('All keywords have completed first run - future checks will send notifications for new listings');
  }
  
  // Schedule next check with random delay
  scheduleNextCheck();
}

// Schedule the next marketplace check with random delay
function scheduleNextCheck() {
  if (state.isMonitoring) {
    // Random delay between 15-25 seconds
    const delay = Math.floor(Math.random() * 10000) + 15000; // 15000-25000ms
    console.log(`Scheduling next check in ${delay/1000} seconds`);
    
    setTimeout(() => {
      checkMarketplace();
    }, delay);
  } else {
    console.log('Monitoring is inactive, not scheduling next check');
  }
}

// Check a specific keyword for new listings using the same tab
async function checkKeyword(keyword, settings) {
  try {
    console.log(`Checking marketplace for keyword: "${keyword}"`);
    
    // Generate random price range to avoid detection by Facebook's anti-scraping measures
    // Using exact same randomization as original Python code
    const minPrice = Math.floor(Math.random() * 11) + 90;  // 90-100 (inclusive)
    const maxPrice = Math.floor(Math.random() * 11) + 990; // 990-1000 (inclusive)
    
    // Build the Facebook Marketplace search URL with parameters
    const url = `https://www.facebook.com/marketplace/${settings.location}/search?minPrice=${minPrice}&maxPrice=${maxPrice}&daysSinceListed=1&sortBy=creation_time_descend&query=${encodeURIComponent(keyword)}`;
    console.log(`Loading search URL: ${url}`);
    
    // Create or reuse a tab
    if (!state.activeTab) {
      // First time - create a new tab
      console.log('Creating new tab for monitoring');
      state.activeTab = await chrome.tabs.create({ 
        url: url, 
        active: false // Open in background
      });
    } else {
      // Reuse existing tab
      console.log('Reusing existing tab for monitoring');
      try {
        await chrome.tabs.update(state.activeTab.id, { url: url });
      } catch (error) {
        // Tab might have been closed - create a new one
        console.log('Tab not available, creating new one');
        state.activeTab = await chrome.tabs.create({ 
          url: url, 
          active: false // Open in background
        });
      }
    }
    
    // Wait for page to load completely (5 seconds)
    console.log(`Waiting for page to load fully...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Inject content script to extract listings from the page
    console.log(`Extracting listings from page...`);
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: state.activeTab.id },
      function: extractListings
    });
    
    // Process the extracted listings
    if (results && results.result) {
      const listingsCount = results.result.length;
      console.log(`Found ${listingsCount} listings for "${keyword}"`);
      await processListings(results.result, keyword, settings);
    } else {
      console.log(`No listings found for "${keyword}" or error extracting listings`);
    }
  } catch (error) {
    console.error(`Error checking keyword ${keyword}:`, error);
    // Reset tab reference in case of errors
    state.activeTab = null;
  }
}

// Extract listings from the page
function extractListings() {
  try {
    const listings = [];
    const elements = document.querySelectorAll('div.xjp7ctv');
    
    for (const element of elements) {
      const linkElement = element.querySelector('a.x1i10hfl');
      const priceElement = element.querySelector('div.x1gslohp');
      const titleElement = element.querySelector('span.x1lliihq');
      
      if (linkElement && priceElement && titleElement) {
        const link = linkElement.getAttribute('href');
        const price = priceElement.textContent.trim();
        const title = titleElement.textContent.trim();
        
        if (link) {
          listings.push({ link, price, title });
        }
      }
    }
    
    return listings;
  } catch (error) {
    console.error('Error extracting listings:', error);
    return [];
  }
}

// Extract listing ID from Facebook link
function extractListingId(link) {
  // First try to match the standard marketplace listing ID pattern
  const idMatch = link.match(/marketplace\/item\/(\d+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  // Second pattern for some Facebook links
  const altMatch = link.match(/\/(\d+)\/?(?:\?|$)/);
  if (altMatch && altMatch[1]) {
    return altMatch[1];
  }
  
  // If no ID can be extracted, use the whole link as fallback
  return link;
}

// Process extracted listings
async function processListings(listings, keyword, settings) {
  // Ensure seenListings is initialized
  if (!state.seenListings) {
    state.seenListings = new Set();
    console.log('Initialized seenListings set');
  }
  
  // Load the latest seen listings from storage to ensure we have the most current data
  try {
    const seenListingsData = await chrome.storage.local.get('seenListings');
    if (seenListingsData.seenListings && seenListingsData.seenListings.length > 0) {
      // Merge with existing set to ensure we have everything
      seenListingsData.seenListings.forEach(listing => state.seenListings.add(listing));
      console.log(`Refreshed seen listings from storage: ${state.seenListings.size} total listings`);
    }
  } catch (error) {
    console.error('Error refreshing seen listings from storage:', error);
  }
  
  // Check if this is the first run for this keyword
  const isFirstRunForKeyword = !state.firstRunKeywords.has(keyword);
  
  // Log the current state
  console.log(`Processing listings for "${keyword}":
  - First run for this keyword: ${isFirstRunForKeyword}
  - Current seen listings count: ${state.seenListings.size}
  - New listings to process: ${listings.length}`);
  
  // First run logic - just store listings without sending notifications
  if (isFirstRunForKeyword) {
    console.log(`FIRST RUN for keyword "${keyword}" - storing ${listings.length} listings without sending notifications`);
    
    // Add all listings to seen list by their ID
    for (const listing of listings) {
      const listingId = extractListingId(listing.link);
      state.seenListings.add(listingId);
      console.log(`First run: Adding listing ID ${listingId} to seen list`);
    }
    
    // Mark this keyword as having completed first run
    state.firstRunKeywords.add(keyword);
    
    // Save first run status to storage
    await chrome.storage.local.set({
      firstRun: false,
      firstRunKeywords: Array.from(state.firstRunKeywords)
    });
    
    // Save seen listings to storage
    await chrome.storage.local.set({
      seenListings: Array.from(state.seenListings)
    });
    
    console.log(`First run complete for "${keyword}". Total seen listings: ${state.seenListings.size}`);
    return;
  }
  
  // Process each listing for notifications (only for non-first runs)
  let newListingsCount = 0;
  let processedListings = [];
  
  for (const listing of listings) {
    // Extract the listing ID for more reliable duplicate detection
    const listingId = extractListingId(listing.link);
    
    // Skip if already seen
    if (state.seenListings.has(listingId)) {
      console.log(`Skipping already seen listing: ${listingId} (${listing.title.substring(0, 30)}...)`);
      continue;
    }
    
    console.log(`NEW LISTING FOUND: ${listingId} (${listing.title.substring(0, 30)}...)`);
    
    // Count new listings
    newListingsCount++;
    
    // Add to seen listings immediately
    state.seenListings.add(listingId);
    
    // Save immediately to prevent duplicates even if there's an error later
    try {
      await chrome.storage.local.set({
        seenListings: Array.from(state.seenListings)
      });
    } catch (error) {
      console.error('Error saving seen listing ID immediately:', error);
    }
    
    // Track processed listings for logging
    processedListings.push({
      id: listingId,
      title: listing.title,
      price: listing.price
    });
    
    // Check for excluded words
    if (containsExcludedWords(listing.title, settings.excludedWords)) {
      console.log(`Skipping listing with excluded words: ${listing.title}`);
      continue;
    }
    
    // Check product preferences using our updated product checker
    const productResult = checkProduct(listing.title, listing.price, settings.products);
    console.log(`Product check for "${listing.title}" (${listing.price}):`, productResult);
    
    // Apply user mode filters exactly as in Python code
    if (settings.modeOnlyPreferred && !productResult.preferred) {
      console.log(`Skipping non-preferred product: ${productResult.productName}`);
      continue;
    }
    
    if (settings.nearGoodDeals && !(productResult.isGoodDeal || productResult.nearGoodDeal)) {
      console.log(`Skipping product that's not a good or near-good deal: ${productResult.productName}`);
      continue;
    }
    
    if (settings.goodDeals && !productResult.isGoodDeal) {
      console.log(`Skipping product that's not a good deal: ${productResult.productName}`);
      continue;
    }
    
    // Prepare deal message prefix
    let dealMessage = '';
    if (productResult.isGoodDeal) {
      dealMessage = '✅ Good Deal @ ';
    } else if (productResult.nearGoodDeal) {
      dealMessage = '⚠️ Near Good Deal @ ';
    }
    
    // Send initial message
    const initialText = `${dealMessage}For ${listing.price}\nLink: https://www.facebook.com${listing.link}`;
    
    try {
      const msgId = await sendTelegramMessage(
        settings.telegramToken, 
        settings.telegramChatId, 
        initialText
      );
      
      if (msgId) {
        // Get detailed location information
        const locationInfo = await getListingLocation(listing.link);
        
        // Calculate distance
        let distanceStr = 'Distance unknown';
        if (locationInfo.latitude && locationInfo.longitude) {
          distanceStr = calculateDistance(
            settings.fixedLat, 
            settings.fixedLon, 
            locationInfo.latitude, 
            locationInfo.longitude
          );
        }
        
        // Update message with location information
        const updatedText = `${dealMessage}${locationInfo.address} (${distanceStr}) For ${listing.price}\nLink: https://www.facebook.com${listing.link}`;
        
        await editTelegramMessage(
          settings.telegramToken,
          settings.telegramChatId,
          msgId,
          updatedText
        );
      }
    } catch (error) {
      console.error('Error sending/updating Telegram message:', error);
    }
  }
  
  // Save updated seen listings to storage (do it again at the end)
  try {
    await chrome.storage.local.set({
      seenListings: Array.from(state.seenListings)
    });
    
    // Trim seen listings if it gets too large (keep last 5000)
    if (state.seenListings.size > 5000) {
      const listingsArray = Array.from(state.seenListings);
      const trimmedListings = new Set(listingsArray.slice(-5000));
      state.seenListings = trimmedListings;
      
      await chrome.storage.local.set({
        seenListings: Array.from(state.seenListings)
      });
      
      console.log(`Trimmed seen listings to ${state.seenListings.size} entries`);
    }
  } catch (error) {
    console.error('Error saving final seen listings to storage:', error);
  }
  
  // Log detailed summary
  console.log(`
  ========== LISTING CHECK SUMMARY ==========
  Keyword: "${keyword}"
  Total listings found: ${listings.length}
  New listings found: ${newListingsCount}
  Processed listings: ${processedListings.length}
  Current seen listings count: ${state.seenListings.size}
  ==========================================
  `);
  
  if (processedListings.length > 0) {
    console.log('Processed listings details:');
    processedListings.forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item.id}, Title: ${item.title.substring(0, 30)}..., Price: ${item.price}`);
    });
  }
}

// Get location information from a listing
async function getListingLocation(listingUrl) {
  try {
    // Create a new tab to open the listing
    const detailTab = await chrome.tabs.create({ 
      url: `https://www.facebook.com${listingUrl}`, 
      active: false // Open in background
    });
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract location information
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: detailTab.id },
      function: extractLocationFromListing
    });
    
    // Close the tab
    await chrome.tabs.remove(detailTab.id);
    
    if (results && results.result) {
      return results.result;
    }
    
    return { address: 'Unknown Address' };
  } catch (error) {
    console.error('Error getting listing location:', error);
    return { address: 'Unknown Address' };
  }
}

// Extract location from listing detail page
function extractLocationFromListing() {
  try {
    // Find div with background-image containing static_map.php
    const divs = Array.from(document.querySelectorAll('div[style*="background-image"]'));
    
    for (const div of divs) {
      const style = div.getAttribute('style') || '';
      if (style.includes('static_map')) {
        const match = style.match(/url\("([^"]+)"\)/);
        if (match) {
          const imgUrl = match[1];
          const coordsMatch = imgUrl.match(/center=([-0-9.]+)%2C([-0-9.]+)/);
          
          if (coordsMatch) {
            const latitude = parseFloat(coordsMatch[1]);
            const longitude = parseFloat(coordsMatch[2]);
            
            // Look for address text
            const addressElement = document.querySelector('span.x1lliihq:not([style])');
            const address = addressElement ? addressElement.textContent.trim() : 'Unknown Address';
            
            return { latitude, longitude, address };
          }
        }
      }
    }
    
    // Alternative method - look for div with specific classes
    const mapDiv = document.querySelector('div.x13vifvy');
    if (mapDiv && mapDiv.hasAttribute('style')) {
      const style = mapDiv.getAttribute('style');
      const match = style.match(/background-image: url\("([^"]+)"\)/);
      
      if (match) {
        const imgUrl = match[1];
        const coordsMatch = imgUrl.match(/center=([-0-9.]+)%2C([-0-9.]+)/);
        
        if (coordsMatch) {
          const latitude = parseFloat(coordsMatch[1]);
          const longitude = parseFloat(coordsMatch[2]);
          
          // Look for address text
          const addressElement = document.querySelector('span.x1lliihq:not([style])');
          const address = addressElement ? addressElement.textContent.trim() : 'Unknown Address';
          
          return { latitude, longitude, address };
        }
      }
    }
    
    return { address: 'Unknown Address' };
  } catch (error) {
    console.error('Error extracting location:', error);
    return { address: 'Unknown Address' };
  }
}

// Check if title contains any excluded words
function containsExcludedWords(title, excludedWords) {
  if (!excludedWords || !excludedWords.length) return false;
  
  const titleLower = title.toLowerCase();
  return excludedWords.some(word => titleLower.includes(word.toLowerCase()));
}

// Check product against user preferences
function checkProduct(title, priceStr, products) {
  if (!products || !products.length) {
    return {
      productName: null,
      isGoodDeal: false,
      nearGoodDeal: false,
      preferred: false
    };
  }
  
  // Parse price
  const priceMatch = priceStr.match(/\d+/);
  const price = priceMatch ? parseInt(priceMatch[0], 10) : Number.MAX_SAFE_INTEGER;
  
  // Find matching product
  const matchingProduct = findMatchingProduct(title, products);
  
  if (!matchingProduct) {
    return {
      productName: null,
      isGoodDeal: false,
      nearGoodDeal: false,
      preferred: false
    };
  }
  
  // Check if price is below max (good deal)
  const isGoodDeal = price < matchingProduct.maxPrice;
  
  // Check near-good deal (within max_price + 100)
  const nearGoodDeal = !isGoodDeal && 
    price >= matchingProduct.maxPrice && 
    price <= (matchingProduct.maxPrice + 100);
  
  return {
    productName: matchingProduct.name,
    isGoodDeal,
    nearGoodDeal,
    preferred: matchingProduct.preferred
  };
}

// Find matching product using normalized and fuzzy matching
function findMatchingProduct(title, products) {
  // Normalize the title
  const normalizedTitle = normalizeText(title);
  
  // First try exact matches
  for (const product of products) {
    const normalizedProductName = normalizeText(product.name);
    if (normalizedTitle.includes(normalizedProductName)) {
      return product;
    }
  }
  
  // If no exact match, try fuzzy matching
  // For simplicity, we'll just check if at least 70% of characters match
  for (const product of products) {
    const normalizedProductName = normalizeText(product.name);
    if (fuzzyMatch(normalizedTitle, normalizedProductName, 0.7)) {
      return product;
    }
  }
  
  return null;
}

// Normalize text for comparison
function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Simple fuzzy matching function
function fuzzyMatch(str1, str2, threshold) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len2 > len1) return fuzzyMatch(str2, str1, threshold);
  
  // Count how many characters from str2 are in str1
  let matches = 0;
  for (let i = 0; i < len2; i++) {
    if (str1.includes(str2[i])) {
      matches++;
    }
  }
  
  return matches / len2 >= threshold;
}

// Calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return `${Math.round(distance)}km`;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Send message to Telegram
async function sendTelegramMessage(token, chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('Message sent successfully');
      return data.result.message_id;
    } else {
      console.error('Failed to send message:', data.description);
      return null;
    }
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
}

// Edit message in Telegram
async function editTelegramMessage(token, chatId, messageId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log('Message edited successfully');
      return true;
    } else {
      console.error('Failed to edit message:', data.description);
      return false;
    }
  } catch (error) {
    console.error('Error editing message:', error);
    return false;
  }
}

// Listen for messages from popup or options pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startMonitoring') {
    startContinuousMonitoring().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error starting monitoring:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicate we'll respond asynchronously
  }
  
  if (message.action === 'stopMonitoring') {
    state.isMonitoring = false;
    
    // Update badge to indicate inactive status
    chrome.action.setBadgeText({
      text: 'OFF'
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#F44336'
    });
    
    console.log('Monitoring stopped');
    sendResponse({ success: true });
  }
  
  if (message.action === 'getStatus') {
    sendResponse({
      isMonitoring: state.isMonitoring,
      currentLocation: state.currentLocation,
      monitoringStatus: state.monitoringStatus
    });
  }
  
  if (message.action === 'testTelegram') {
    const { token, chatId } = message;
    sendTelegramMessage(token, chatId, 'Test message from Facebook Marketplace Monitor extension')
      .then(messageId => {
        sendResponse({ success: !!messageId });
      })
      .catch(error => {
        console.error('Error testing Telegram:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate we'll respond asynchronously
  }
});