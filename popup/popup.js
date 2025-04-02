// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Get references to DOM elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const toggleButton = document.getElementById('toggle-monitoring');
    const locationSelect = document.getElementById('location');
    const keywordInput = document.getElementById('keyword');
    const addKeywordButton = document.getElementById('add-keyword');
    const keywordsList = document.getElementById('keywords-list');
    const openOptionsButton = document.getElementById('open-options');
    const testTelegramButton = document.getElementById('test-telegram');
    const scheduleText = document.getElementById('schedule-text');
    const nextChangeText = document.getElementById('next-change-text');
    
    // Add a reset first run button
    const resetFirstRunButton = document.createElement('button');
    resetFirstRunButton.textContent = 'Reset First Run';
    resetFirstRunButton.id = 'reset-first-run';
    resetFirstRunButton.style.marginTop = '10px';
    document.querySelector('.button-row').appendChild(resetFirstRunButton);
    
    // Add a load default settings button
    const loadDefaultsButton = document.createElement('button');
    loadDefaultsButton.textContent = 'Load iPhone Settings';
    loadDefaultsButton.id = 'load-defaults';
    loadDefaultsButton.style.marginTop = '10px';
    loadDefaultsButton.style.backgroundColor = '#FF9800';
    document.querySelector('.button-row').appendChild(loadDefaultsButton);
    
    resetFirstRunButton.addEventListener('click', async () => {
      if (confirm('This will reset first run status for all keywords. You will NOT receive notifications for existing listings. Continue?')) {
        await chrome.storage.local.set({ 
          firstRun: true,
          firstRunKeywords: []
        });
        alert('First run has been reset. Next check will only store listings without sending notifications.');
      }
    });
    
    // Add event listener for load default settings button
    loadDefaultsButton.addEventListener('click', async () => {
      if (confirm('This will load the iPhone product settings. Continue?')) {
        // Prefill settings - based on user data
        const PREFILLED_SETTINGS = {
          telegramToken: '7811938134:AAH4sVBBh9zbt8oecdtdRgAhC5El9ONJfSc',
          telegramChatId: '7932502148',
          location: 'melbourne',
          keywords: ['iPhone'],
          excludedWords: ['Warranty', 'Controller', 'For', 'Stand', 'Car', 'Names', 'Stereo', 'LCD', 'C@$h', 'Ca$h', 'Shop'],
          products: [
            { name: 'iPhone 11', minPrice: 100, maxPrice: 200, preferred: false },
            { name: 'iPhone 11 Pro', minPrice: 100, maxPrice: 250, preferred: false },
            { name: 'iPhone 11 Pro Max', minPrice: 100, maxPrice: 300, preferred: false },
            { name: 'iPhone 12', minPrice: 100, maxPrice: 320, preferred: true },
            { name: 'iPhone 12 Pro', minPrice: 100, maxPrice: 450, preferred: true },
            { name: 'iPhone 12 Pro Max', minPrice: 100, maxPrice: 600, preferred: false },
            { name: 'iPhone 12 Mini', minPrice: 100, maxPrice: 250, preferred: false },
            { name: 'iPhone 13', minPrice: 100, maxPrice: 450, preferred: false },
            { name: 'iPhone 13 Pro', minPrice: 100, maxPrice: 550, preferred: false },
            { name: 'iPhone 13 Pro Max', minPrice: 100, maxPrice: 600, preferred: false },
            { name: 'iPhone 13 Mini', minPrice: 100, maxPrice: 350, preferred: false },
            { name: 'iPhone 14', minPrice: 100, maxPrice: 600, preferred: false },
            { name: 'iPhone 14 Plus', minPrice: 100, maxPrice: 600, preferred: false },
            { name: 'iPhone 14 Pro', minPrice: 100, maxPrice: 600, preferred: false },
            { name: 'iPhone 14 Pro Max', minPrice: 100, maxPrice: 600, preferred: false },
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
        
        await chrome.storage.sync.set(PREFILLED_SETTINGS);
        alert('iPhone settings loaded successfully! Restart monitoring to apply changes.');
        
        // Reset first run to avoid notifications for existing listings
        await chrome.storage.local.set({
          firstRun: true,
          firstRunKeywords: []
        });
        
        // Reload popup to reflect changes
        window.location.reload();
      }
    });
    
    // Load settings from storage
    const settings = await chrome.storage.sync.get();
    
    // Initialize location select
    if (settings.location) {
      locationSelect.value = settings.location;
    }
    
    // Initialize keywords list
    if (settings.keywords && settings.keywords.length > 0) {
      updateKeywordsList(settings.keywords, keywordsList);
    }
    
    // Get monitoring status from background script
    const status = await getMonitoringStatus();
    updateStatusDisplay(status);
    
    // Update schedule display
    if (settings.monitoringMode === 'auto') {
      scheduleText.textContent = `${settings.startTime} - ${settings.endTime}`;
    } else if (settings.monitoringMode === 'always') {
      scheduleText.textContent = 'Always active';
    } else {
      scheduleText.textContent = 'Manual control';
    }
    
    // Update next change text if available
    if (status.currentLocation && 
        status.monitoringStatus && 
        status.monitoringStatus[status.currentLocation] && 
        status.monitoringStatus[status.currentLocation].nextChangeTime) {
      const nextChange = new Date(status.monitoringStatus[status.currentLocation].nextChangeTime);
      nextChangeText.textContent = nextChange.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Add event listeners
    toggleButton.addEventListener('click', toggleMonitoring);
    locationSelect.addEventListener('change', updateLocation);
    addKeywordButton.addEventListener('click', addKeyword);
    openOptionsButton.addEventListener('click', openOptions);
    testTelegramButton.addEventListener('click', testTelegram);
    
    // Toggle monitoring status
    async function toggleMonitoring() {
      const currentStatus = await getMonitoringStatus();
      
      if (currentStatus.isMonitoring) {
        // Stop monitoring
        const response = await chrome.runtime.sendMessage({ action: 'stopMonitoring' });
        if (response.success) {
          updateStatusDisplay({ isMonitoring: false });
        }
      } else {
        // Start monitoring
        const response = await chrome.runtime.sendMessage({ action: 'startMonitoring' });
        if (response.success) {
          updateStatusDisplay({ isMonitoring: true });
        }
      }
    }
    
    // Update location
    async function updateLocation() {
      const location = locationSelect.value;
      await chrome.storage.sync.set({ location });
      
      // Refresh status
      const status = await getMonitoringStatus();
      updateStatusDisplay(status);
    }
    
    // Add keyword
    async function addKeyword() {
      const keyword = keywordInput.value.trim();
      if (!keyword) return;
      
      // Get current keywords
      const { keywords = [] } = await chrome.storage.sync.get('keywords');
      
      // Check if keyword already exists
      if (keywords.includes(keyword)) {
        alert('This keyword is already in your list.');
        return;
      }
      
      // Add keyword
      keywords.push(keyword);
      await chrome.storage.sync.set({ keywords });
      
      // Reset first run for the new keyword
      chrome.storage.local.get(['firstRunKeywords'], function(result) {
        let firstRunKeywords = result.firstRunKeywords || [];
        // Don't need to add the new keyword to firstRunKeywords - it will get added during first check
        chrome.storage.local.set({ firstRunKeywords });
      });
      
      // Update UI
      updateKeywordsList(keywords, keywordsList);
      keywordInput.value = '';
    }
    
    // Remove keyword
    async function removeKeyword(keyword) {
      // Get current keywords
      const { keywords = [] } = await chrome.storage.sync.get('keywords');
      
      // Remove keyword
      const updatedKeywords = keywords.filter(k => k !== keyword);
      await chrome.storage.sync.set({ keywords: updatedKeywords });
      
      // Update UI
      updateKeywordsList(updatedKeywords, keywordsList);
    }
    
    // Open options page
    function openOptions() {
      chrome.runtime.openOptionsPage();
    }
    
    // Test Telegram connection
    async function testTelegram() {
      testTelegramButton.textContent = 'Testing...';
      testTelegramButton.disabled = true;
      
      const { telegramToken, telegramChatId } = await chrome.storage.sync.get(['telegramToken', 'telegramChatId']);
      
      if (!telegramToken || !telegramChatId) {
        alert('Please configure Telegram settings in the options page first.');
        testTelegramButton.textContent = 'Test Telegram';
        testTelegramButton.disabled = false;
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'testTelegram',
        token: telegramToken,
        chatId: telegramChatId
      });
      
      if (response.success) {
        alert('Telegram test message sent successfully!');
      } else {
        alert('Failed to send Telegram test message. Please check your settings.');
      }
      
      testTelegramButton.textContent = 'Test Telegram';
      testTelegramButton.disabled = false;
    }
  });
  
  // Get monitoring status from background script
  async function getMonitoringStatus() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'getStatus' }, response => {
        resolve(response || { isMonitoring: false });
      });
    });
  }
  
  // Update status display
  function updateStatusDisplay(status) {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const toggleButton = document.getElementById('toggle-monitoring');
    
    if (status.isMonitoring) {
      statusIndicator.classList.remove('inactive');
      statusIndicator.classList.add('active');
      statusText.textContent = 'Active';
      toggleButton.textContent = 'Stop Monitoring';
    } else {
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('inactive');
      statusText.textContent = 'Inactive';
      toggleButton.textContent = 'Start Monitoring';
    }
  }
  
  // Update keywords list
  function updateKeywordsList(keywords, listElement) {
    // Clear list
    listElement.innerHTML = '';
    
    // Add keywords
    for (const keyword of keywords) {
      const li = document.createElement('li');
      
      const span = document.createElement('span');
      span.textContent = keyword;
      li.appendChild(span);
      
      const removeButton = document.createElement('button');
      removeButton.textContent = '✖';
      removeButton.className = 'remove-keyword';
      removeButton.addEventListener('click', () => removeKeyword(keyword));
      li.appendChild(removeButton);
      
      listElement.appendChild(li);
    }
  }
  
  // Remove keyword
  async function removeKeyword(keyword) {
    // Get current keywords
    const { keywords = [] } = await chrome.storage.sync.get('keywords');
    
    // Remove keyword
    const updatedKeywords = keywords.filter(k => k !== keyword);
    await chrome.storage.sync.set({ keywords: updatedKeywords });
    
    // Update first run keywords list
    chrome.storage.local.get(['firstRunKeywords'], function(result) {
      let firstRunKeywords = result.firstRunKeywords || [];
      firstRunKeywords = firstRunKeywords.filter(k => k !== keyword);
      chrome.storage.local.set({ firstRunKeywords });
    });
    
    // Update UI
    updateKeywordsList(updatedKeywords, document.getElementById('keywords-list'));
  }