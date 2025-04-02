/**
 * Recursively search for a 'location' key with latitude and longitude
 * in a nested object structure.
 * 
 * @param {Object} data - Object to search in
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth to prevent infinite loops
 * @returns {Object|null} - Object containing latitude and longitude, or null if not found
 */
function findLocationRecursive(data, depth = 0, maxDepth = 10) {
  // Prevent infinite recursion
  if (depth > maxDepth) {
      return null;
  }
  
  // Base case: if not an object, return null
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
  }
  
  // Check if this object has a 'location' key
  if ('location' in data && typeof data.location === 'object' && data.location !== null) {
      const location = data.location;
      if ('latitude' in location && 'longitude' in location) {
          return location;
      }
  }
  
  // Check for latitude and longitude directly in this object
  if ('latitude' in data && 'longitude' in data) {
      return data;
  }
  
  // Recursive case: check all object values
  for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const result = findLocationRecursive(value, depth + 1, maxDepth);
          if (result) {
              return result;
          }
      } 
      // Also check inside arrays
      else if (Array.isArray(value)) {
          for (const item of value) {
              if (typeof item === 'object' && item !== null) {
                  const result = findLocationRecursive(item, depth + 1, maxDepth);
                  if (result) {
                      return result;
                  }
              }
          }
      }
  }
  
  return null;
}

/**
* Extract latitude and longitude coordinates from a Facebook Marketplace listing
* 
* @param {string} listingId - The Facebook Marketplace listing ID
* @returns {Promise<[number, number]|null>} - Promise resolving to [latitude, longitude] coordinates or null if not found
*/
async function extractCoordinates(listingId) {
  // URL for the bulk route definitions API
  const url = "https://www.facebook.com/ajax/bulk-route-definitions/";
  
  // Headers to mimic a browser request
  const headers = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/x-www-form-urlencoded",
      "origin": "https://www.facebook.com",
      "referer": `https://www.facebook.com/marketplace/item/${listingId}/`,
      "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
  };
  
  // Some cookies are needed for the request to work properly
  const cookies = {
      "datr": "92jTZ8ae6PgSA87nd9Lfz_9m",  // Example value
      "sb": "92jTZ7AxrwFYLbISRttc-HSD",    // Example value
      "dpr": "1.25",
      "wd": "800x730"
  };
  
  // Convert cookies object to a cookie string
  const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  
  // Try both route formats to see which one works
  // Format 1: with referral parameters
  const routeWithRef = `/marketplace/item/${listingId}/?ref=search&referral_code=null&referral_story_type=post`;
  // Format 2: simplified without parameters
  const routeSimple = `/marketplace/item/${listingId}/`;
  
  // Form data for the request
  const formData = new URLSearchParams();
  formData.append("route_urls[0]", routeSimple);  // Try the simpler route format first
  formData.append("routing_namespace", "fb_comet");
  formData.append("__aaid", "0");
  formData.append("__user", "0");
  formData.append("__a", "1");
  formData.append("__req", "2");
  formData.append("__hs", "20178.HYP:comet_loggedout_pkg.2.1...0");
  formData.append("dpr", "1");
  formData.append("__ccg", "EXCELLENT");
  formData.append("__rev", "1021404933");  // This might need to be updated periodically
  formData.append("__s", "yzjdwr:wbn65g:c5sxht");
  formData.append("__hsi", "7487801154620878429");
  formData.append("__dyn", "7xe6E5q5U5ObwKBwno6u5U4e0C8dEc8co38w4BwUx609vCwjE1EE2Cw8G1Dw5Zx62G3i0Bo2ygao1aU2swlo6qU2exi4UaEW1GwkEbo4y5o2exu16w2oEGdw46wbS1LwTwNwLweq1Iwqo4q1-w8eEb8uwm85K0ke");
  formData.append("__csr", "hRgJRlN4GLLlqkJdi7haF5VqyVbm4dBmjSaCABRUG9Quui9G2qdy-bzooxK48cobEf89EmiwMwHHACUC3e2K9wUzE8poeFo025Owq8rwKw37E3Rw047aw0L4a0bnwq60eEw5ow5zw0yvG5Q7y05Xw9EM0cYo0vtyo0fiU4a01v9o7V015i0mcw6C");
  formData.append("__comet_req", "15");
  formData.append("lsd", "AVotB1KQbug");
  formData.append("jazoest", "2967");
  formData.append("__spin_r", "1021404933");
  formData.append("__spin_b", "trunk");
  formData.append("__spin_t", "1743389562");
  
  try {
      // Send the POST request
      const response = await fetch(url, {
          method: 'POST',
          headers: {
              ...headers,
              'Cookie': cookieString
          },
          body: formData,
      });
      
      // Check if the request was successful
      if (response.ok) {
          // The response typically starts with "for (;;);" followed by JSON
          const responseText = await response.text();
          const jsonText = responseText.replace(/^for \(;;\);/, '');
          
          // Try to parse the JSON
          let jsonData;
          try {
              jsonData = JSON.parse(jsonText);
          } catch (e) {
              console.error(`Failed to parse JSON: ${e.message}`);
              return null;
          }
          
          // Extract the coordinates from the JSON structure
          try {
              // First, check if we can find the route key - try both formats
              const routeSimple = `/marketplace/item/${listingId}/`;
              const routeWithRef = `/marketplace/item/${listingId}/?ref=search&referral_code=null&referral_story_type=post`;
              
              // Try to find a matching route key in the response
              let routeKey = null;
              if (jsonData.payload.payloads[routeSimple]) {
                  routeKey = routeSimple;
              } else if (jsonData.payload.payloads[routeWithRef]) {
                  routeKey = routeWithRef;
              } else {
                  // Look for any key that contains our listing ID
                  for (const key of Object.keys(jsonData.payload.payloads)) {
                      if (key.includes(listingId)) {
                          routeKey = key;
                          break;
                      }
                  }
              }
              
              if (!routeKey) {
                  console.error(`Error: Could not find any route key for listing ID: ${listingId}`);
                  console.error("Available keys in response:", Object.keys(jsonData.payload.payloads));
                  return null;
              }
              
              if (!jsonData.payload) {
                  console.error("Error: Response doesn't contain 'payload' field");
                  console.error("Response preview:", typeof jsonData === 'string' ? jsonData.slice(0, 200) : JSON.stringify(jsonData).slice(0, 200));
                  return null;
              }
              
              if (!jsonData.payload.payloads) {
                  console.error("Error: Response doesn't contain 'payloads' field");
                  return null;
              }
              
              if (!jsonData.payload.payloads[routeKey]) {
                  console.error(`Error: Could not find route key in response: ${routeKey}`);
                  // Look for any keys in the payloads field
                  if (jsonData.payload.payloads) {
                      console.error("Available keys in response:", Object.keys(jsonData.payload.payloads));
                  }
                  return null;
              }
              
              // Check if there's an error in the response
              if (jsonData.payload.payloads[routeKey].error === true) {
                  console.error("Facebook returned an error response");
                  if (jsonData.payload.payloads[routeKey].errorSummary) {
                      console.error("Error summary:", jsonData.payload.payloads[routeKey].errorSummary);
                  }
                  return null;
              }
              
              // Try to extract the rootView
              if (!jsonData.payload.payloads[routeKey].result) {
                  console.error("Error: No 'result' field in the response");
                  return null;
              }
              
              const result = jsonData.payload.payloads[routeKey].result;
              
              // Debug the result structure
              console.log("Available fields in result:", Object.keys(result));
              
              // Based on the provided example JSON structure, check this specific path
              if (result.exports) {
                  const exports = result.exports;
                  
                  // Check the rootView.props.location path
                  if (exports.rootView && typeof exports.rootView === 'object') {
                      const rootView = exports.rootView;
                      
                      if (rootView.props && typeof rootView.props === 'object') {
                          const props = rootView.props;
                          
                          if (props.location && typeof props.location === 'object') {
                              const location = props.location;
                              
                              if ('latitude' in location && 'longitude' in location) {
                                  console.log("Found coordinates in rootView.props.location");
                                  return [location.latitude, location.longitude];
                              }
                          }
                      }
                  }
                  
                  // Also check the hostableView.props.location path as a backup
                  if (exports.hostableView && typeof exports.hostableView === 'object') {
                      const hostableView = exports.hostableView;
                      
                      if (hostableView.props && typeof hostableView.props === 'object') {
                          const props = hostableView.props;
                          
                          if (props.location && typeof props.location === 'object') {
                              const location = props.location;
                              
                              if ('latitude' in location && 'longitude' in location) {
                                  console.log("Found coordinates in hostableView.props.location");
                                  return [location.latitude, location.longitude];
                              }
                          }
                      }
                  }
                  
                  // Try additional known fields
                  // Try to find coordinates in allResources or resource
                  if (exports.rootView && typeof exports.rootView === 'object') {
                      if (exports.rootView.allResources) {
                          console.log("Checking allResources in rootView...");
                          // allResources is typically an array
                          for (let i = 0; i < exports.rootView.allResources.length; i++) {
                              const resource = exports.rootView.allResources[i];
                              if (typeof resource === 'object' && resource !== null) {
                                  const location = findLocationRecursive(resource);
                                  if (location) {
                                      return [location.latitude, location.longitude];
                                  }
                              }
                          }
                      }
                      
                      if (exports.rootView.resource) {
                          console.log("Checking resource in rootView...");
                          if (typeof exports.rootView.resource === 'object') {
                              const location = findLocationRecursive(exports.rootView.resource);
                              if (location) {
                                  return [location.latitude, location.longitude];
                              }
                          }
                      }
                  }
                  
                  // Try checking hostableView with same approach
                  if (exports.hostableView && typeof exports.hostableView === 'object') {
                      if (exports.hostableView.allResources) {
                          console.log("Checking allResources in hostableView...");
                          for (let i = 0; i < exports.hostableView.allResources.length; i++) {
                              const resource = exports.hostableView.allResources[i];
                              if (typeof resource === 'object' && resource !== null) {
                                  const location = findLocationRecursive(resource);
                                  if (location) {
                                      return [location.latitude, location.longitude];
                                  }
                              }
                          }
                      }
                      
                      if (exports.hostableView.resource) {
                          console.log("Checking resource in hostableView...");
                          if (typeof exports.hostableView.resource === 'object') {
                              const location = findLocationRecursive(exports.hostableView.resource);
                              if (location) {
                                  return [location.latitude, location.longitude];
                              }
                          }
                      }
                  }
              }
              
              // If we haven't returned yet, try the original structure
              if (!result.rootView) {
                  console.error("Error: Could not find location information in the response");
                  return null;
              }
              
              const rootView = result.rootView;
              
              // Check if props exist
              if (!rootView.props) {
                  console.error("Error: No 'props' field in rootView");
                  console.error("Available fields in rootView:", Object.keys(rootView));
                  return null;
              }
              
              const props = rootView.props;
              
              // Check if location exists
              if (!props.location) {
                  console.error("Error: No 'location' field in props");
                  console.error("Available fields in props:", Object.keys(props));
                  return null;
              }
              
              const location = props.location;
              
              // Check if latitude and longitude exist
              if (!('latitude' in location) || !('longitude' in location)) {
                  console.error("Error: Missing latitude or longitude in location data");
                  console.error("Available fields in location:", Object.keys(location));
                  return null;
              }
              
              const latitude = location.latitude;
              const longitude = location.longitude;
              
              return [latitude, longitude];
          } catch (e) {
              console.error(`Could not find coordinates in the response data: ${e.message}`);
              return null;
          }
      } else {
          console.error(`Request failed with status code: ${response.status}`);
          return null;
      }
  } catch (e) {
      console.error(`An error occurred: ${e.message}`);
      return null;
  }
}

/**
* Main function to run the program in a browser environment
*/
function main() {
  console.log("Facebook Marketplace Coordinates Extractor");
  console.log("=========================================");
  console.log("Enter a Facebook Marketplace listing ID or URL to find its location.");
  
  // Create a simple UI for browser environments
  const container = document.createElement('div');
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.maxWidth = '600px';
  container.style.margin = '0 auto';
  container.style.padding = '20px';
  
  const heading = document.createElement('h1');
  heading.textContent = 'Facebook Marketplace Coordinates Extractor';
  container.appendChild(heading);
  
  const subheading = document.createElement('p');
  subheading.textContent = 'Enter a Facebook Marketplace listing ID or URL to find its location.';
  container.appendChild(subheading);
  
  const inputContainer = document.createElement('div');
  inputContainer.style.marginBottom = '20px';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter listing ID or URL...';
  input.style.width = '70%';
  input.style.padding = '8px';
  input.style.marginRight = '10px';
  inputContainer.appendChild(input);
  
  const button = document.createElement('button');
  button.textContent = 'Get Coordinates';
  button.style.padding = '8px 16px';
  button.style.cursor = 'pointer';
  inputContainer.appendChild(button);
  
  container.appendChild(inputContainer);
  
  const resultContainer = document.createElement('div');
  container.appendChild(resultContainer);
  
  document.body.appendChild(container);
  
  // Handle the button click
  button.addEventListener('click', async () => {
      const userInput = input.value.trim();
      
      if (!userInput) {
          showResult('Please enter a listing ID or URL.');
          return;
      }
      
      let listingId;
      
      // Check if the input is a URL
      if (userInput.includes('facebook.com') || userInput.includes('fb.com')) {
          // Try to extract the ID from the URL using a regex pattern
          const match = userInput.match(/\/item\/(\d+)/);
          if (match) {
              listingId = match[1];
              showResult(`Extracted listing ID from URL: ${listingId}`);
          } else {
              showResult('Could not extract a valid listing ID from the URL.');
              return;
          }
      } else {
          // Clean the listing ID (remove any non-numeric characters)
          listingId = userInput.replace(/\D/g, '');
          
          if (!listingId) {
              showResult('Invalid listing ID. Please enter a numeric ID.');
              return;
          }
      }
      
      showResult(`Fetching coordinates for listing ID: ${listingId}`, true);
      
      try {
          const coordinates = await extractCoordinates(listingId);
          
          if (coordinates) {
              const [latitude, longitude] = coordinates;
              let resultHTML = `
                  <h3>Found coordinates:</h3>
                  <p>Latitude: ${latitude}</p>
                  <p>Longitude: ${longitude}</p>
                  <p><a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">Open in Google Maps</a></p>
              `;
              showResult(resultHTML);
          } else {
              showResult(`
                  <p>Could not extract coordinates. Make sure the listing ID is valid.</p>
                  <h3>Troubleshooting tips:</h3>
                  <ol>
                      <li>Verify the listing ID is correct</li>
                      <li>The listing might not have location data</li>
                      <li>Try a different listing to confirm the script works</li>
                      <li>Facebook may have changed their API response format</li>
                  </ol>
              `);
          }
      } catch (e) {
          showResult(`An unexpected error occurred: ${e.message}`);
      }
  });
  
  // Helper function to show results
  function showResult(message, isLoading = false) {
      resultContainer.innerHTML = '';
      
      if (isLoading) {
          resultContainer.innerHTML = `<p>${message}</p><p>Loading...</p>`;
      } else {
          resultContainer.innerHTML = message;
      }
  }
}

// Execute main function when the DOM is fully loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
  } else {
      main();
  }
}

// For Node.js environments, export the functions
if (typeof module !== 'undefined' && module.exports) {
  // Node.js version of main would need to use command line interface
  const nodejsMain = async () => {
      console.log("Facebook Marketplace Coordinates Extractor");
      console.log("=========================================");
      
      // Import readline for CLI interaction
      const readline = require('readline');
      const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
      });
      
      const processInput = () => {
          rl.question("\nEnter the Facebook Marketplace listing ID or URL (or 'q' to quit): ", async (userInput) => {
              if (userInput.toLowerCase() === 'q') {
                  rl.close();
                  return;
              }
              
              let listingId;
              
              // Check if the input is a URL
              if (userInput.includes('facebook.com') || userInput.includes('fb.com')) {
                  // Extract the ID from the URL
                  const match = userInput.match(/\/item\/(\d+)/);
                  if (match) {
                      listingId = match[1];
                      console.log(`Extracted listing ID from URL: ${listingId}`);
                  } else {
                      console.log('Could not extract a valid listing ID from the URL.');
                      processInput();
                      return;
                  }
              } else {
                  // Clean the listing ID
                  listingId = userInput.replace(/\D/g, '');
                  
                  if (!listingId) {
                      console.log('Invalid listing ID. Please enter a numeric ID.');
                      processInput();
                      return;
                  }
              }
              
              console.log(`\nFetching coordinates for listing ID: ${listingId}`);
              
              try {
                  const coordinates = await extractCoordinates(listingId);
                  
                  if (coordinates) {
                      const [latitude, longitude] = coordinates;
                      console.log('\nFound coordinates:');
                      console.log(`Latitude: ${latitude}`);
                      console.log(`Longitude: ${longitude}`);
                      console.log(`\nGoogle Maps URL: https://www.google.com/maps?q=${latitude},${longitude}`);
                  } else {
                      console.log('\nCould not extract coordinates. Make sure the listing ID is valid.');
                      console.log('\nTroubleshooting tips:');
                      console.log('1. Verify the listing ID is correct');
                      console.log('2. The listing might not have location data');
                      console.log('3. Try a different listing to confirm the script works');
                      console.log('4. Facebook may have changed their API response format');
                  }
              } catch (e) {
                  console.log(`\nAn unexpected error occurred: ${e.message}`);
              }
              
              processInput();
          });
      };
      
      processInput();
  };
  
  module.exports = {
      findLocationRecursive,
      extractCoordinates,
      main: nodejsMain
  };
}