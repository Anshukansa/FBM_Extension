// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Set up tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Hide all tab contents
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        tabButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Show selected tab content
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // Add active class to selected tab button
        button.classList.add('active');
      });
    });
    
    // Load settings from storage
    const settings = await chrome.storage.sync.get();
    
    // Populate Telegram settings
    document.getElementById('telegram-token').value = settings.telegramToken || '';
    document.getElementById('telegram-chat-id').value = settings.telegramChatId || '';
    
    // Set up Telegram test button
    document.getElementById('test-connection').addEventListener('click', testTelegramConnection);
    
    // Initialize products table
    if (settings.products && settings.products.length > 0) {
      updateProductsTable(settings.products);
    }
    
    // Set up product form
    document.getElementById('add-product').addEventListener('click', addProduct);
    
    // Initialize excluded words list
    if (settings.excludedWords && settings.excludedWords.length > 0) {
      updateExcludedWordsList(settings.excludedWords);
    }
    
    // Set up excluded words form
    document.getElementById('add-excluded').addEventListener('click', addExcludedWord);
    
    // Initialize location settings
    if (settings.location) {
      document.getElementById('location-select').value = settings.location;
    }
    
    document.getElementById('fixed-lat').value = settings.fixedLat || '';
    document.getElementById('fixed-lon').value = settings.fixedLon || '';
    
    // Set up current location button
    document.getElementById('get-current-location').addEventListener('click', getCurrentLocation);
    
    // Initialize schedule settings
    if (settings.monitoringMode) {
      document.getElementById('monitoring-mode').value = settings.monitoringMode;
      updateScheduleVisibility();
    }
    
    document.getElementById('start-time').value = settings.startTime || '06:30';
    document.getElementById('end-time').value = settings.endTime || '22:00';
    
    document.getElementById('mode-only-preferred').checked = settings.modeOnlyPreferred || false;
    document.getElementById('near-good-deals').checked = settings.nearGoodDeals || false;
    document.getElementById('good-deals').checked = settings.goodDeals || false;
    
    // Add event listener for monitoring mode changes
    document.getElementById('monitoring-mode').addEventListener('change', updateScheduleVisibility);
    
    // Set up save and reset buttons
    document.getElementById('save-settings').addEventListener('click', saveAllSettings);
    document.getElementById('reset-settings').addEventListener('click', resetSettings);
  });
  
  // Test Telegram connection
  async function testTelegramConnection() {
    const token = document.getElementById('telegram-token').value.trim();
    const chatId = document.getElementById('telegram-chat-id').value.trim();
    const connectionStatus = document.getElementById('connection-status');
    
    if (!token || !chatId) {
      connectionStatus.textContent = 'Please enter both token and chat ID.';
      connectionStatus.style.color = '#F44336';
      return;
    }
    
    connectionStatus.textContent = 'Testing connection...';
    connectionStatus.style.color = '#3b5998';
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testTelegram',
        token,
        chatId
      });
      
      if (response.success) {
        connectionStatus.textContent = 'Success! Test message sent.';
        connectionStatus.style.color = '#4CAF50';
      } else {
        connectionStatus.textContent = 'Failed to send message. Check your credentials.';
        connectionStatus.style.color = '#F44336';
      }
    } catch (error) {
      connectionStatus.textContent = `Error: ${error.message}`;
      connectionStatus.style.color = '#F44336';
    }
  }
  
  // Add product
  async function addProduct() {
    const nameInput = document.getElementById('product-name');
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');
    const preferredCheckbox = document.getElementById('preferred');
    
    const name = nameInput.value.trim();
    const minPrice = parseInt(minPriceInput.value, 10) || 0;
    const maxPrice = parseInt(maxPriceInput.value, 10) || 0;
    const preferred = preferredCheckbox.checked;
    
    if (!name) {
      alert('Please enter a product name.');
      return;
    }
    
    if (maxPrice <= 0) {
      alert('Please enter a valid max price.');
      return;
    }
    
    // Get current products
    const { products = [] } = await chrome.storage.sync.get('products');
    
    // Check if product already exists
    const existingIndex = products.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex >= 0) {
      // Update existing product
      products[existingIndex] = { name, minPrice, maxPrice, preferred };
    } else {
      // Add new product
      products.push({ name, minPrice, maxPrice, preferred });
    }
    
    // Save products
    await chrome.storage.sync.set({ products });
    
    // Update UI
    updateProductsTable(products);
    
    // Clear form
    nameInput.value = '';
    minPriceInput.value = '';
    maxPriceInput.value = '';
    preferredCheckbox.checked = false;
  }
  
  // Update products table
  function updateProductsTable(products) {
    const tableBody = document.querySelector('#products-table tbody');
    tableBody.innerHTML = '';
    
    for (const product of products) {
      const row = document.createElement('tr');
      
      // Name cell
      const nameCell = document.createElement('td');
      nameCell.textContent = product.name;
      row.appendChild(nameCell);
      
      // Min price cell
      const minPriceCell = document.createElement('td');
      minPriceCell.textContent = `$${product.minPrice}`;
      row.appendChild(minPriceCell);
      
      // Max price cell
      const maxPriceCell = document.createElement('td');
      maxPriceCell.textContent = `$${product.maxPrice}`;
      row.appendChild(maxPriceCell);
      
      // Preferred cell
      const preferredCell = document.createElement('td');
      preferredCell.textContent = product.preferred ? '✓' : '✗';
      preferredCell.style.color = product.preferred ? '#4CAF50' : '#F44336';
      row.appendChild(preferredCell);
      
      // Actions cell
      const actionsCell = document.createElement('td');
      
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.className = 'edit-button';
      editButton.addEventListener('click', () => editProduct(product));
      actionsCell.appendChild(editButton);
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete-button';
      deleteButton.addEventListener('click', () => deleteProduct(product.name));
      actionsCell.appendChild(deleteButton);
      
      row.appendChild(actionsCell);
      
      tableBody.appendChild(row);
    }
  }
  
  // Edit product
  function editProduct(product) {
    document.getElementById('product-name').value = product.name;
    document.getElementById('min-price').value = product.minPrice;
    document.getElementById('max-price').value = product.maxPrice;
    document.getElementById('preferred').checked = product.preferred;
  }
  
  // Delete product
  async function deleteProduct(productName) {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
      return;
    }
    
    // Get current products
    const { products = [] } = await chrome.storage.sync.get('products');
    
    // Remove product
    const updatedProducts = products.filter(p => p.name !== productName);
    
    // Save products
    await chrome.storage.sync.set({ products: updatedProducts });
    
    // Update UI
    updateProductsTable(updatedProducts);
  }
  
  // Add excluded word
  async function addExcludedWord() {
    const wordInput = document.getElementById('excluded-word');
    const word = wordInput.value.trim().toLowerCase();
    
    if (!word) {
      return;
    }
    
    // Get current excluded words
    const { excludedWords = [] } = await chrome.storage.sync.get('excludedWords');
    
    // Check if word already exists
    if (excludedWords.includes(word)) {
      alert('This word is already in your excluded list.');
      return;
    }
    
    // Add word
    excludedWords.push(word);
    
    // Save excluded words
    await chrome.storage.sync.set({ excludedWords });
    
    // Update UI
    updateExcludedWordsList(excludedWords);
    
    // Clear input
    wordInput.value = '';
  }
  
  // Update excluded words list
  function updateExcludedWordsList(words) {
    const list = document.getElementById('excluded-words-list');
    list.innerHTML = '';
    
    for (const word of words) {
      const li = document.createElement('li');
      
      const span = document.createElement('span');
      span.textContent = word;
      li.appendChild(span);
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Remove';
      deleteButton.className = 'delete-button';
      deleteButton.addEventListener('click', () => removeExcludedWord(word));
      li.appendChild(deleteButton);
      
      list.appendChild(li);
    }
  }
  
  // Remove excluded word
  async function removeExcludedWord(word) {
    // Get current excluded words
    const { excludedWords = [] } = await chrome.storage.sync.get('excludedWords');
    
    // Remove word
    const updatedWords = excludedWords.filter(w => w !== word);
    
    // Save excluded words
    await chrome.storage.sync.set({ excludedWords: updatedWords });
    
    // Update UI
    updateExcludedWordsList(updatedWords);
  }
  
  // Get current location
  function getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          document.getElementById('fixed-lat').value = latitude;
          document.getElementById('fixed-lon').value = longitude;
        },
        error => {
          console.error('Error getting location:', error);
          alert(`Could not get location: ${error.message}`);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }
  
  // Update schedule visibility based on monitoring mode
  function updateScheduleVisibility() {
    const monitoringMode = document.getElementById('monitoring-mode').value;
    const autoScheduleSettings = document.getElementById('auto-schedule-settings');
    
    if (monitoringMode === 'auto') {
      autoScheduleSettings.style.display = 'block';
    } else {
      autoScheduleSettings.style.display = 'none';
    }
  }
  
  // Save all settings
  async function saveAllSettings() {
    // Get values from form
    const telegramToken = document.getElementById('telegram-token').value.trim();
    const telegramChatId = document.getElementById('telegram-chat-id').value.trim();
    const location = document.getElementById('location-select').value;
    const fixedLat = parseFloat(document.getElementById('fixed-lat').value) || -37.8136;
    const fixedLon = parseFloat(document.getElementById('fixed-lon').value) || 144.9631;
    const monitoringMode = document.getElementById('monitoring-mode').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const modeOnlyPreferred = document.getElementById('mode-only-preferred').checked;
    const nearGoodDeals = document.getElementById('near-good-deals').checked;
    const goodDeals = document.getElementById('good-deals').checked;
    
    // Save settings
    await chrome.storage.sync.set({
      telegramToken,
      telegramChatId,
      location,
      fixedLat,
      fixedLon,
      monitoringMode,
      startTime,
      endTime,
      modeOnlyPreferred,
      nearGoodDeals,
      goodDeals
    });
    
    // Show success message
    alert('Settings saved successfully!');
  }
  
  // Reset settings to default
  async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to default?')) {
      return;
    }
    
    await chrome.storage.sync.set({
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
      goodDeals: false
    });
    
    // Reload page to update UI
    window.location.reload();
  }