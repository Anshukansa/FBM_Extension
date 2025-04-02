/**
 * Content script for Facebook Marketplace Monitor extension.
 * 
 * This script runs on Facebook Marketplace pages and helps extract listing data.
 * It can be injected by the background script or run automatically when 
 * a Facebook Marketplace page is loaded.
 */

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractListings') {
      const listings = extractListings();
      sendResponse({ listings });
      return true;
    }
    
    if (message.action === 'extractListingDetails') {
      const details = extractListingDetails();
      sendResponse({ details });
      return true;
    }
  });
  
  /**
   * Extract listings from a Facebook Marketplace search results page
   * This function identifies and extracts listing data by targeting specific CSS selectors
   * Version 1.0.1 - Updated to handle Facebook's latest UI structure
   */
  function extractListings() {
    try {
      console.log('Extracting listings from Facebook Marketplace page...');
      
      // Facebook Marketplace listings are typically contained in divs with class xjp7ctv
      // This selector may need updates if Facebook changes their HTML structure
      const listings = [];
      const elements = document.querySelectorAll('div.xjp7ctv');
      
      console.log(`Found ${elements.length} potential listing elements on the page`);
      
      // Analyze the page structure
      console.log('Page URL:', window.location.href);
      console.log('Page title:', document.title);
      
      // Process each listing element
      for (const element of elements) {
        // Link element contains the URL to the listing detail page
        const linkElement = element.querySelector('a.x1i10hfl');
        
        // Price element contains the listing price
        const priceElement = element.querySelector('div.x1gslohp');
        
        // Title element contains the listing title/description
        const titleElement = element.querySelector('span.x1lliihq');
        
        // Only process complete listings (with all required elements)
        if (linkElement && priceElement && titleElement) {
          const link = linkElement.getAttribute('href');
          const price = priceElement.textContent.trim();
          const title = titleElement.textContent.trim();
          
          if (link) {
            console.log(`Found valid listing: "${title}" for ${price} - ${link.substring(0, 30)}...`);
            
            // Store the listing data for processing
            listings.push({ 
              link, 
              price, 
              title,
              timestamp: new Date().toISOString() // Add extraction timestamp
            });
          }
        } else {
          // Log missing elements for debugging
          console.log('Found incomplete listing element:');
          console.log('- Has link:', !!linkElement);
          console.log('- Has price:', !!priceElement);
          console.log('- Has title:', !!titleElement);
        }
      }
      
      console.log(`Successfully extracted ${listings.length} complete listings out of ${elements.length} elements`);
      return listings;
    } catch (error) {
      console.error('Error extracting listings:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      return [];
    }
  }
  
  /**
   * Extract details from a single listing page
   */
  function extractListingDetails() {
    try {
      console.log('Extracting details from listing page...');
      
      // Extract location information from the map
      let latitude = null;
      let longitude = null;
      let address = 'Unknown Address';
      
      // Method 1: Look for div with background-image containing static_map.php
      const divs = Array.from(document.querySelectorAll('div[style*="background-image"]'));
      
      for (const div of divs) {
        const style = div.getAttribute('style') || '';
        console.log('Checking div style:', style);
        
        if (style.includes('static_map')) {
          const match = style.match(/url\("([^"]+)"\)/);
          if (match) {
            const imgUrl = match[1];
            console.log('Found map URL:', imgUrl);
            
            const coordsMatch = imgUrl.match(/center=([-0-9.]+)%2C([-0-9.]+)/);
            if (coordsMatch) {
              latitude = parseFloat(coordsMatch[1]);
              longitude = parseFloat(coordsMatch[2]);
              console.log('Extracted coordinates:', latitude, longitude);
              
              // Look for address text
              const addressElement = document.querySelector('span.x1lliihq:not([style])');
              if (addressElement) {
                address = addressElement.textContent.trim();
                console.log('Found address:', address);
              }
              
              break;
            }
          }
        }
      }
      
      // Method 2: Alternative approach if Method 1 fails
      if (!latitude || !longitude) {
        console.log('Using alternative method to find location...');
        
        const mapDiv = document.querySelector('div.x13vifvy');
        if (mapDiv && mapDiv.hasAttribute('style')) {
          const style = mapDiv.getAttribute('style');
          console.log('Map div style:', style);
          
          const match = style.match(/background-image: url\("([^"]+)"\)/);
          if (match) {
            const imgUrl = match[1];
            console.log('Found map URL (alt method):', imgUrl);
            
            const coordsMatch = imgUrl.match(/center=([-0-9.]+)%2C([-0-9.]+)/);
            if (coordsMatch) {
              latitude = parseFloat(coordsMatch[1]);
              longitude = parseFloat(coordsMatch[2]);
              console.log('Extracted coordinates (alt method):', latitude, longitude);
              
              // Look for address text again
              const addressElement = document.querySelector('span.x1lliihq:not([style])');
              if (addressElement) {
                address = addressElement.textContent.trim();
                console.log('Found address (alt method):', address);
              }
            }
          }
        }
      }
      
      // Extract additional details if needed
      // For example: seller info, item condition, etc.
      
      return {
        latitude,
        longitude,
        address
      };
    } catch (error) {
      console.error('Error extracting listing details:', error);
      return { address: 'Unknown Address' };
    }
  }