// Define the URL of the REST API endpoint
const sheetId = '1SkLkL2Hfw5wD3-ZfASaT5H4lCwMKRvkSGL1HZpVWMGs';
const apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/map?key=AIzaSyAUi4KazffmDZV_dQUnMUKA1jJt4i0mqlU';

// const githubDataUrl = 'https://raw.githubusercontent.com/yohman/kiseki/main/sheets_data.json'; // New GitHub Raw URL
const githubDataUrl = 'https://raw.githubusercontent.com/yohman/kiseki/refs/heads/main/sheets_data.json'; // New GitHub Raw URL
const useLocalData = true; // SET TO true TO USE LOCAL JSON as a secondary option if GitHub fails, false FOR API as secondary
const localDataPath = 'sheets_data.json'; // Path to your local data file (relative to index.html)

let sheet = null;
let sheet2 = []; // Initialize sheet2

let map; // Declare map globally
let markers = []; // To keep track of marker instances
let basemapLayers = [];
let currentFilteredData = []; // For search results
let globalSearchTermFromUrl = null; // To store search term from URL

let currentBasemapId = 'esri-world-imagery'; // Default active basemap changed to Google Satellite ("Today")
// Global state for initial map view
let mapInitState = {
	lat: null, // Will no longer be set by URL
	lon: null, // Will no longer be set by URL
	zoom: null, // Will no longer be set by URL
	basemapIdFromUrl: null, // Will no longer be set by URL
	urlStateApplied: false // Will remain false
};

function initializeBasemapData() {
	basemapLayers = [{
			id: 'gsi-ort-old10',
			name: '1961',
			group: 'GSI',
			note: 'Coverage may be limited.',
			style: {
				version: 8,
				sources: {
					'gsi-ort-old10': {
						type: 'raster',
						tiles: ['https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png'],
						tileSize: 256,
						attribution: '地理院タイル &copy; <a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
					}
				},
				layers: [{
					id: 'gsi-ort-old10-layer',
					type: 'raster',
					source: 'gsi-ort-old10',
					minzoom: 0,
					maxzoom: 17
				}]
			}
		},
		{
			id: 'gsi-gazo1',
			name: '1974',
			group: 'GSI',
			note: 'Coverage may be limited. JPG format.',
			style: {
				version: 8,
				sources: {
					'gsi-gazo1': {
						type: 'raster',
						tiles: ['https://cyberjapandata.gsi.go.jp/xyz/gazo1/{z}/{x}/{y}.jpg'],
						tileSize: 256,
						attribution: '地理院タイル &copy; <a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
					}
				},
				layers: [{
					id: 'gsi-gazo1-layer',
					type: 'raster',
					source: 'gsi-gazo1',
					minzoom: 0,
					maxzoom: 17
				}]
			}
		},
		{
			id: 'gsi-gazo2',
			name: '1979',
			group: 'GSI',
			note: 'Coverage may be limited. JPG format.',
			style: {
				version: 8,
				sources: {
					'gsi-gazo2': {
						type: 'raster',
						tiles: ['https://cyberjapandata.gsi.go.jp/xyz/gazo2/{z}/{x}/{y}.jpg'],
						tileSize: 256,
						attribution: '地理院タイル &copy; <a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
					}
				},
				layers: [{
					id: 'gsi-gazo2-layer',
					type: 'raster',
					source: 'gsi-gazo2',
					minzoom: 0,
					maxzoom: 17
				}]
			}
		},
		{
			id: 'gsi-gazo3',
			name: '1984',
			group: 'GSI',
			note: 'Coverage may be limited. JPG format.',
			style: {
				version: 8,
				sources: {
					'gsi-gazo3': {
						type: 'raster',
						tiles: ['https://cyberjapandata.gsi.go.jp/xyz/gazo3/{z}/{x}/{y}.jpg'],
						tileSize: 256,
						attribution: '地理院タイル &copy; <a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
					}
				},
				layers: [{
					id: 'gsi-gazo3-layer',
					type: 'raster',
					source: 'gsi-gazo3',
					minzoom: 0,
					maxzoom: 17
				}]
			}
		},
		{
			id: 'gsi-gazo4',
			name: '1987',
			group: 'GSI',
			note: 'Coverage may be limited. JPG format.',
			style: {
				version: 8,
				sources: {
					'gsi-gazo4': {
						type: 'raster',
						tiles: ['https://cyberjapandata.gsi.go.jp/xyz/gazo4/{z}/{x}/{y}.jpg'],
						tileSize: 256,
						attribution: '地理院タイル &copy; <a href="https://www.gsi.go.jp/" target="_blank">国土地理院</a>'
					}
				},
				layers: [{
					id: 'gsi-gazo4-layer',
					type: 'raster',
					source: 'gsi-gazo4',
					minzoom: 0,
					maxzoom: 17
				}]
			}
		},
		// {
		// 	id: 'google-satellite',
		// 	name: 'Today',
		// 	group: 'Google',
		// 	note: 'Usage may be subject to Google Maps Platform Terms of Service.',
		// 	style: {
		// 		version: 8,
		// 		sources: {
		// 			'google-satellite': {
		// 				type: 'raster',
		// 				tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
		// 				tileSize: 256,
		// 				attribution: 'Map data &copy; <a href="https://www.google.com/intl/en_us/help/terms_maps/" target="_blank">Google</a>',
		// 				maxzoom: 21
		// 			}
		// 		},
		// 		layers: [{
		// 			id: 'google-satellite-layer',
		// 			type: 'raster',
		// 			source: 'google-satellite'
		// 		}]
		// 	}
		// },
		{
			id: 'esri-world-imagery',
			name: 'Today',
			group: 'Esri',
			note: 'Tiles &copy; Esri — Source: Esri, Earthstar Geographics. Free to use for non-commercial applications with attribution.',
			style: {
				version: 8,
				sources: {
					'esri-world-imagery': {
						type: 'raster',
						tiles: [
							'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
						],
						tileSize: 256,
						attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Earthstar Geographics',
						maxzoom: 19
					}
				},
				layers: [{
					id: 'esri-world-imagery-layer',
					type: 'raster',
					source: 'esri-world-imagery'
				}]
			}
		}



	];
}

// Main data fetching and initialization logic
function fetchDataAndInitialize() {
    console.log(`Attempting to fetch data from primary source: GitHub Raw URL (${githubDataUrl})`);
    fetch(githubDataUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok for ${githubDataUrl}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(githubJsonData => {
            // Assuming sheets_data.json has a key 'map'
            // and its value is the array of rows (including headers)
            if (githubJsonData && githubJsonData.map && Array.isArray(githubJsonData.map)) {
                sheet = githubJsonData.map; // Assign the array of rows to 'sheet'
                console.log("Successfully loaded data from GitHub Raw URL");
                processAndSetupMap();
            } else {
                console.error('GitHub Raw JSON data is not in the expected format (missing "map" array or not an array).');
                // Throw an error to trigger the catch block and proceed to fallbacks
                throw new Error('GitHub data format error. Proceeding to fallback.');
            }
        })
        .catch(error => {
            console.error('Error fetching or processing GitHub Raw JSON data:', error);
            console.log("Falling back to secondary data source options.");

            // Secondary: Local data or API based on useLocalData
            if (useLocalData) {
                console.log(`Attempting to fetch local data from: ${localDataPath}`);
                fetch(localDataPath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Network response was not ok for ${localDataPath}: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(localJsonData => {
                        if (localJsonData && localJsonData.map && Array.isArray(localJsonData.map)) {
                            sheet = localJsonData.map;
                            console.log("Successfully loaded data from local sheets_data.json");
                            processAndSetupMap();
                        } else {
                            console.error('Local JSON data is not in the expected format (missing "map" array or not an array). Attempting API fallback.');
                            fetchFromApi(); // Fallback to API
                        }
                    })
                    .catch(localError => {
                        console.error('Error fetching or processing local JSON data:', localError);
                        console.log("Falling back to API fetch due to local data error.");
                        fetchFromApi(); // Fallback to API
                    });
            } else {
                fetchFromApi(); // Fetch from API if not using local data as secondary
            }
        });
}

// NEW function to parse URL query parameters
function parseUrlQueryParameters() {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.has('s')) {
        globalSearchTermFromUrl = queryParams.get('s');
        console.log("Search term from URL:", globalSearchTermFromUrl);
    }
}

function fetchFromApi() {
    console.log("Attempting to fetch data from Google Sheets API...");
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok from API');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.values && Array.isArray(data.values)) {
                sheet = data.values;
                console.log("Successfully loaded data from Google Sheets API");
                processAndSetupMap();
            } else {
                console.error("API response did not contain 'values' array.", data);
                alert("Failed to load map data from the API. The map may not function correctly.");
            }
        })
        .catch(error => {
            console.error('Fetch error (API):', error);
            alert("Failed to load map data. Please check your internet connection or try again later.");
        });
}

// This function contains the data processing (your lines 183-220) and UI setup calls
function processAndSetupMap() {
    if (!sheet || sheet.length === 0) {
        console.error("Sheet data is null, empty, or not available for processing.");
        alert("Map data is unavailable. The map cannot be initialized.");
        return;
    }

    console.log("Original sheet data received for processing. First row (headers expected):", sheet[0]);
    sheet2 = []; // Reset/Initialize sheet2

    let id = 0; // Counter for rows, also used as unique ID for data items (starts at 1 for actual data)
    sheet.forEach(function(element) {
        // Original sheet structure:
        // Col 0: Timestamp, Col 1: Author, Col 2: Title, Col 3: Description, Col 4: Coords
        // Col 5: Age, Col 6: Avatar Name (e.g., "sport-boy"), Col 7: Hashtag, Col 8: Genre
        // The 'id > 0' check correctly skips the header row (where id is 0).
        if (id > 0 && element && element.length > 6 && element[4] !== undefined && element[6] !== undefined) {
            let processedElement = [...element];
            let coordSource = processedElement[4];
            let processedCoordString = null;

            if (typeof coordSource === 'string') {
                processedCoordString = coordSource.trim();
                if (processedCoordString.startsWith('[') && processedCoordString.endsWith(']')) {
                    processedCoordString = processedCoordString.slice(1, -1).trim();
                } else if (processedCoordString.startsWith('(') && processedCoordString.endsWith(')')) {
                    processedCoordString = processedCoordString.slice(1, -1).trim();
                }
            }

            if (processedCoordString && processedCoordString.includes(',')) {
                processedElement[4] = processedCoordString;
                // Always use index 6 from the original data for avatar name
                const avatarName = element[6];
                const avatarUrl = `images/avatars/${avatarName}.png`;
                // Place avatarUrl at the end of the processedElement array
                processedElement.push(avatarUrl);
                processedElement.unshift(id);
                sheet2.push(processedElement);
            } else {
                console.warn(`Skipping data row (id ${id}) due to invalid coordinates (no comma after processing):`, element, "Raw coord data:", coordSource);
            }
        } else if (id > 0) {
            console.warn(`Skipping data row (id ${id}) due to incomplete data structure or missing essential fields:`, element);
        }
        id++;
    });

    console.log("Processed sheet2 data (with added ID and avatar URL):", sheet2);
    currentFilteredData = [...sheet2]; // Initialize with all processed data

    // Update the modal with the count of memories
    const memoriesCountElement = document.getElementById('mapping-memories-count');
    if (memoriesCountElement) {
        // This sets the total count initially. It might be updated in setupMapAndUI if a URL search term is present.
        memoriesCountElement.textContent = `Mapping ${sheet2.length} memories...`;
    } else {
        console.warn("Element with ID 'mapping-memories-count' not found in the modal.");
    }

    setupMapAndUI(); // Call the main UI setup function
}

// Remove or comment out the original fetch block:
// fetch(apiUrl)
//  .then(response => {
//      // ...
//  })
//  .then(data => {
//      sheet = data.values
//      console.log(sheet)
//      let id = 0
//      sheet.forEach(function(element) {
//          // ... THIS IS THE BLOCK FROM LINES 183-220 that is now inside processAndSetupMap
//      })
//      console.log(sheet2)
//      currentFilteredData = [...sheet2];
//      setupMapAndUI(); 
//  })
//  .catch(error => {
//      console.error('Fetch error:', error);
//  });

// INSTEAD, call the new top-level function to start the data loading process:
fetchDataAndInitialize();


function setupMapAndUI() {
    console.log("Setting up map and UI...");
    parseUrlQueryParameters(); // Parse URL for ?s=searchTerm
    initializeBasemapData();
    // The following condition will no longer be met as basemapIdFromUrl will be null
    if (mapInitState.basemapIdFromUrl && basemapLayers.find(b => b.id === mapInitState.basemapIdFromUrl)) {
        currentBasemapId = mapInitState.basemapIdFromUrl;
    }

    if (globalSearchTermFromUrl) {
        const searchInput = document.getElementById('search-input');
        const searchContainer = document.getElementById('search-container');
        if (searchInput) {
            searchInput.value = globalSearchTermFromUrl;
        }
        if (searchContainer) {
            searchContainer.classList.add('search-active');
        }
        // Apply the filter. This updates currentFilteredData and refreshes UI components.
        filterAndRefreshUI(globalSearchTermFromUrl.toLowerCase());

        // Update the main memories count message in the modal to reflect the filter
        const memoriesCountElement = document.getElementById('mapping-memories-count');
        if (memoriesCountElement) {
            const sanitizedSearchTerm = globalSearchTermFromUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            memoriesCountElement.innerHTML = `Mapping ${currentFilteredData.length} memories based on "<strong>${sanitizedSearchTerm}</strong>"...`;
        }
    } else {
        // No URL search term, ensure UI is populated with the initial full dataset.
        // currentFilteredData is already [...sheet2] from processAndSetupMap.
        // refreshMapContent will be called by initMapInstance on style.load.
        // Sidebar and scroller need initial population if not filtered by URL.
        populateSidebar(currentFilteredData);
        populateHorizontalScroller(currentFilteredData);
    }

    initMapInstance(); // This will call refreshMapContent internally on style.load using currentFilteredData
    createTimelineControls();
    setupHamburgerMenu();
    setupHeaderLogoLink();
    setupModal(); 
    setupSearchFeature(); 
}

function setupModal() {
    const modalOverlay = document.getElementById('welcome-modal-overlay');
    const modalCloseButton = document.getElementById('modal-close-button');

    if (modalOverlay && modalCloseButton) {
        // The text content for 'mapping-memories-count' is set in processAndSetupMap
        // and potentially updated in setupMapAndUI if a URL search term is present.

        modalCloseButton.addEventListener('click', () => {
            modalOverlay.classList.add('modal-hidden');
        });
    }
}

function setupHeaderLogoLink() {
	const logoLink = document.getElementById('logo-link');
	if (logoLink) {
		logoLink.addEventListener('click', (event) => {
			event.preventDefault(); // Prevent default anchor behavior
			// window.location.hash = ''; // Clear the hash - No longer managing hash
			window.location.reload(); // Reload the page to reset to defaults
		});
	}
}

function setupHamburgerMenu() {
	const hamburger = document.getElementById('hamburger-menu');
	const sidebar = document.querySelector('.sidebar');
	// const mainArea = document.querySelector('.main-area'); // No longer toggling class on main-area

	if (hamburger && sidebar) {
		hamburger.addEventListener('click', () => {
			sidebar.classList.toggle('sidebar-closed');
			// mainArea.classList.toggle('sidebar-closed'); // Removed
			// It's important to resize the map after the transition/animation of sidebar is complete
			// or at least after the class change has taken effect.
			// A small timeout can help if there are CSS transitions.
			setTimeout(() => {
				if (map) {
					map.resize();
				}
			}, 250); // Adjust timeout based on CSS transition duration
		});
	}
}

// Removed parseUrlHash function
/*
function parseUrlHash() {
	if (window.location.hash) {
		const hash = window.location.hash.substring(1); // Remove #
		// Expected format: !map=zoom/lat/lon/basemapId
		if (hash.startsWith('!map=')) {
			const parts = hash.substring(5).split('/');
			if (parts.length >= 3) { // zoom, lat, lon are minimum
				const zoom = parseFloat(parts[0]);
				const lat = parseFloat(parts[1]);
				const lon = parseFloat(parts[2]);

				if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lon)) {
					mapInitState.zoom = zoom;
					mapInitState.lat = lat;
					mapInitState.lon = lon;
					mapInitState.urlStateApplied = true;
					console.log("Map state from URL:", mapInitState);
				}
				if (parts.length >= 4 && parts[3]) {
					mapInitState.basemapIdFromUrl = parts[3];
					// currentBasemapId will be updated in setupMapAndUI if valid
				}
			}
		}
	}
}
*/

// Removed updateUrlHash function
/*
function updateUrlHash() {
	if (!map) return;
	const center = map.getCenter();
	const zoom = map.getZoom();
	const lat = parseFloat(center.lat.toFixed(6)); // Limit precision
	const lon = parseFloat(center.lng.toFixed(6)); // Limit precision

	// Update global state for consistency if needed, though map is source of truth here
	// mapInitState.lat = lat; 
	// mapInitState.lon = lon;
	// mapInitState.zoom = zoom;

	const newHash = `!map=${zoom}/${lat}/${lon}/${currentBasemapId}`;
	// Use replaceState to avoid flooding browser history for every map move
	if (history.replaceState) {
		history.replaceState(null, null, '#' + newHash);
	} else {
		window.location.hash = newHash;
	}
}
*/


function initMapInstance() {
	console.log("Initializing MapLibre map instance...");
	const initialBasemap = basemapLayers.find(b => b.id === currentBasemapId);
	if (!initialBasemap) {
		console.error("Initial basemap style not found:", currentBasemapId);
		// Fallback to a very basic style if default is missing, or handle error appropriately
		// Attempt to use the first defined basemap as a fallback if currentBasemapId is somehow invalid
		const fallbackBasemap = basemapLayers.length > 0 ? basemapLayers[0] : null;
		if (fallbackBasemap) {
			console.warn("Falling back to first defined basemap:", fallbackBasemap.id);
			currentBasemapId = fallbackBasemap.id;
			map = new maplibregl.Map({
				container: 'map',
				style: fallbackBasemap.style,
				center: [140.123, 35.605],
				zoom: 10,
				pitch: 60, // Tilt the map
				bearing: -17.6 // Optional: slight bearing for better 3D view

			});
		} else {
			// Absolute fallback if no basemaps are defined
			map = new maplibregl.Map({
				container: 'map',
				center: [140.123, 35.605],
				zoom: 10,
				pitch: 60, // Tilt the map
				bearing: -17.6 // Optional: slight bearing for better 3D view
			});
		}
		map.on('style.load', refreshMapContent);
		return;
	}

	let initialCenter = [140.123, 35.605]; // New default center
	let initialZoom = 10; // New default zoom

    // These conditions will no longer be met as urlStateApplied will be false
	if (mapInitState.urlStateApplied && mapInitState.lon !== null && mapInitState.lat !== null) {
		initialCenter = [mapInitState.lon, mapInitState.lat];
	}
	if (mapInitState.urlStateApplied && mapInitState.zoom !== null) {
		initialZoom = mapInitState.zoom;
	}

	map = new maplibregl.Map({
		container: 'map',
		style: initialBasemap.style,
		center: initialCenter,
		zoom: initialZoom,
		pitch: 60, // Tilt the map
		bearing: -17.6 // Optional: slight bearing for better 3D view

	});

	// map.addControl(new maplibregl.NavigationControl());

	map.on('style.load', () => {
		console.log("Map style loaded.");
		refreshMapContent(currentFilteredData); // Pass current (possibly filtered) data

	});

	// map.on('moveend', updateUrlHash); // Removed
	// map.on('zoomend', updateUrlHash); // Removed
}

function refreshMapContent(dataToDisplay) { // Modified to accept data
	if (!map || !dataToDisplay) { // Check dataToDisplay
		console.log("Map not ready or no data for markers.");
		return;
	}

	// Clear existing markers
	markers.forEach(marker => marker.remove());
	markers = []; // Reset markers array

	const bounds = new maplibregl.LngLatBounds();
	let validMarkersExist = false;

	dataToDisplay.forEach(function(item, index) { // Use dataToDisplay
		// New sheet2 item structure after processing:
		// item[0]=id (generated)
		// item[1]=Timestamp (original col 0)
		// item[2]=Author (original col 1)
		// item[3]=Title (original col 2)
		// item[4]=Description (original col 3)
		// item[5]=Coordinates (original col 4, "lat,lon" string)
		// item[6]=Age (original col 5)
		// item[7]=Avatar Name (raw, original col 6, e.g., "sport-boy")
		// item[8]=Hashtag (original col 7, might be undefined if not present in sheet)
		// item[9]=Genre (original col 8, might be undefined if not present in sheet)
		// item[10]=avatarUrl (constructed: images/avatars/${original_col_6}.png)

		if (!item[5] || typeof item[5] !== 'string' || !item[5].includes(',')) {
			console.warn("Skipping item in refreshMapContent due to missing or invalid coordinates string at item[5]:", item[3] || `Item ID ${item[0]}`, "Coords string:", item[5]);
			return;
		}
		// item[...]=..., item[6]=Avatar Name, ..., item[item.length-1]=avatarUrl
		const imageUrl = item[item.length - 1]; // Always use the last element for avatarUrl
		if (!imageUrl) {
			console.warn("Skipping item in refreshMapContent due to missing avatarUrl:", item[3] || `Item ID ${item[0]}`);
			return;
		}

		let latlonArray;
		try {
			latlonArray = item[5].split(',').map(Number);
			if (latlonArray.length !== 2 || isNaN(latlonArray[0]) || isNaN(latlonArray[1])) {
				throw new Error("Invalid coordinate format");
			}
		} catch (e) {
			console.warn("Error parsing coordinates for item:", item[3] || `Item ID ${item[0]}`, item[5], e);
			return;
		}

		let lngLat = [latlonArray[1], latlonArray[0]];
		const author = item[2] || 'N/A';
		const title = item[3] || 'N/A';
		const description = item[4] || 'No description.';
		const genre = item[9] || ''; // Genre from item[9]
		const hashtag = item[8] || ''; // Hashtag from item[8]

		const markerContainer = document.createElement('div');
		markerContainer.style.display = 'flex';
		markerContainer.style.flexDirection = 'column';
		markerContainer.style.alignItems = 'center';
		markerContainer.style.cursor = 'pointer'; // Add pointer cursor to indicate clickable

		const iconEl = document.createElement('div');
		iconEl.style.backgroundImage = `url(${imageUrl})`;
		iconEl.style.width = '48px';
		iconEl.style.height = '48px';
		iconEl.style.borderRadius = '50%';
		iconEl.style.backgroundSize = 'cover';
		iconEl.style.backgroundRepeat = 'no-repeat';
		iconEl.style.backgroundPosition = 'center';

		const lineEl = document.createElement('div');
		lineEl.style.width = '2px';
		lineEl.style.height = '30px';
		lineEl.style.backgroundColor = 'white';

		markerContainer.appendChild(iconEl);
		markerContainer.appendChild(lineEl);

		markerContainer.addEventListener('click', (event) => {
			event.stopPropagation();
			goto(itemId);
		});

		// Updated Popup HTML with Genre and Hashtag
		let genrePillHTML = '';
		if (genre) {
			const genreParts = genre.split(' ');
			const firstWordOfGenre = genreParts[0];
			// Add onclick to trigger search with the first word of the genre
			genrePillHTML = `<span class="popup-genre-pill" title="${genre}" onclick="triggerSearchFromElement(this, '${firstWordOfGenre.replace(/'/g, "\\'")}')">${firstWordOfGenre}</span>`;
		}

		let hashtagHTML = '';
		if (hashtag) {
			// Add onclick to trigger search with the hashtag text
			// hashtagHTML = `<p class="popup-hashtag" onclick="triggerSearchFromElement(this, '${hashtag.replace(/'/g, "\\'")}')">${hashtag}</p>`; // Old single hashtag logic

			const individualHashtags = hashtag.split(/\s+/).filter(Boolean); // Split by space, remove empty strings
			if (individualHashtags.length > 0) {
				let hashtagLinksHTML = '';
				individualHashtags.forEach(h => {
					const sanitizedHashtag = h.replace(/'/g, "\\'"); // For use in JS string
					const displayHashtag = h; // Original part for display
					hashtagLinksHTML += `<span class="popup-hashtag-item" onclick="triggerSearchFromElement(this, '${sanitizedHashtag}')">${displayHashtag}</span> `;
				});
				// Wrap all hashtag items in a container for styling the background block
				hashtagHTML = `<div class="popup-hashtag-container">${hashtagLinksHTML.trim()}</div>`;
			}
		}


		const popupHTML = `
		<img src="${imageUrl}" class="popup-protruding-icon">
		<div class="popup-text-content">
			<h3>${title}</h3>
			${genrePillHTML}
			<p class="popup-author-detail">${author}</p>
			<div class="popup-description-scrollable"> <!-- Wrapper for scrollable description -->
				<p>${description}</p>
			</div>
			${hashtagHTML} <!-- This will now insert the div.popup-hashtag-container -->
		</div>`;

		const popup = new maplibregl.Popup({
				offset: 25
			})
			.setHTML(popupHTML);

		const marker = new maplibregl.Marker({
				element: markerContainer,
				anchor: 'bottom',
			})
			.setLngLat(lngLat)
			.setPopup(popup) // MapLibre will still handle its default popup toggle
			.addTo(map);

		markers.push(marker);

		bounds.extend(lngLat);
		validMarkersExist = true;
	});

	// Only fitBounds if it's the initial load (no search term)
	// and view wasn't set by URL (which is now always true as urlStateApplied is false)
	if (validMarkersExist && !bounds.isEmpty() && document.getElementById('search-input').value === '') {
		map.fitBounds(bounds, {
			padding: {
				top: 100,
				bottom: 100,
				left: 100,
				right: 100
			},
			maxZoom: 17
		});
	} else if (dataToDisplay.length > 0 && (!validMarkersExist || bounds.isEmpty())) {
		console.warn("No valid markers to bound for current filter, map initialized with default/current center/zoom.");
	} else if (dataToDisplay.length === 0) {
		console.log("No data for current filter, map initialized with default/current center/zoom.");
	}
}

function populateSidebar(dataToDisplay) { // Modified to accept data
	const sidebar = $('.sidebar');
	sidebar.empty();
	if (!dataToDisplay || dataToDisplay.length === 0) return; // Check dataToDisplay

	dataToDisplay.forEach(function(item) { // Use dataToDisplay
		// item[0]=id, item[2]=Author, item[10]=avatarUrl
		if (item[0] === undefined || item[2] === undefined || item[item.length - 1] === undefined) {
			return;
		}
		const itemId = item[0];
		const author = item[2];
		const avatarUrl = item[item.length - 1]; // Avatar URL is at index 10

		const sidebarItemHTML = `
		<div class="sidebar-item" onclick="goto(${itemId})">
			<img src="${avatarUrl}" class="sidebar-item-icon-img">
			<p class="sidebar-item-author-name">${author}</p>
		</div>`;
		sidebar.append(sidebarItemHTML);
	});
}

function populateHorizontalScroller(dataToDisplay) { // Modified to accept data
	const scroller = $('#horizontal-card-scroller');
	scroller.empty();
	if (!dataToDisplay || dataToDisplay.length === 0) return; // Check dataToDisplay

	dataToDisplay.forEach(function(item) { // Use dataToDisplay
		// item[0]=id, item[2]=Author, item[10]=avatarUrl
		if (item[0] === undefined || item[2] === undefined || item[item.length - 1] === undefined) {
			return;
		}
		const itemId = item[0];
		const author = item[2];
		const avatarUrl = item[item.length - 1]; // Avatar URL is at index 10

		const cardHTML = `
		<div class="horizontal-card" data-id="${itemId}" onclick="goto(${itemId})">
			<img src="${avatarUrl}" class="horizontal-card-icon-img">
			<p class="horizontal-card-author-name">${author}</p>
		</div>`;
		scroller.append(cardHTML);
	});
}

function createTimelineControls() {
	const controlsContainer = document.querySelector('.timeline-controls');
	if (!controlsContainer) {
		console.error("Timeline controls container not found.");
		return;
	}
	controlsContainer.innerHTML = ''; // Clear existing controls

	basemapLayers.forEach(layer => {
		const itemContainer = document.createElement('div');
		itemContainer.className = 'timeline-item';
		itemContainer.title = layer.note || layer.name;
		itemContainer.dataset.basemapId = layer.id;

		const circle = document.createElement('div');
		circle.className = 'timeline-circle';
		if (layer.id === currentBasemapId) {
			circle.classList.add('active');
		}

		const label = document.createElement('span');
		label.className = 'timeline-label';
		label.textContent = layer.name;

		itemContainer.appendChild(circle);
		itemContainer.appendChild(label);

		itemContainer.addEventListener('click', () => {
			switchBasemap(layer.id);
		});
		controlsContainer.appendChild(itemContainer);
	});
}

function triggerSearchFromElement(element, searchTerm) {
	const searchContainer = document.getElementById('search-container');
	const searchInput = document.getElementById('search-input');

	if (!searchContainer.classList.contains('search-active')) {
		searchContainer.classList.add('search-active');
	}
	searchInput.value = searchTerm;
	searchInput.focus();
	filterAndRefreshUI(searchTerm.toLowerCase());
}

function setupSearchFeature() {
	const searchContainer = document.getElementById('search-container');
	const searchIcon = document.getElementById('search-icon');
	const searchInput = document.getElementById('search-input');

	searchIcon.addEventListener('click', () => {
		searchContainer.classList.toggle('search-active');
		if (searchContainer.classList.contains('search-active')) {
			searchInput.focus();
		} else {
			searchInput.value = ''; // Clear search on close
			filterAndRefreshUI(''); // Reset filter
		}
	});

	searchInput.addEventListener('input', (event) => {
		const searchTerm = event.target.value.toLowerCase();
		filterAndRefreshUI(searchTerm);
	});
}

function filterAndRefreshUI(searchTerm) {
	if (!searchTerm || searchTerm.trim() === '') {
		currentFilteredData = [...sheet2];
	} else {
		currentFilteredData = sheet2.filter(item => {
			const author = (item[2] || '').toLowerCase();
			const title = (item[3] || '').toLowerCase();
			const description = (item[4] || '').toLowerCase();
			const hashtag = (item[8] || '').toLowerCase();
			const genre = (item[9] || '').toLowerCase(); // Full genre string for searching

			return author.includes(searchTerm) ||
				title.includes(searchTerm) ||
				description.includes(searchTerm) ||
				hashtag.includes(searchTerm) ||
				genre.includes(searchTerm);
		});
	}
	// When map style reloads (e.g. basemap change), it calls refreshMapContent.
	// We need to ensure it uses the latest filtered data.
	// So, directly call refreshMapContent here.
	refreshMapContent(currentFilteredData);
	populateSidebar(currentFilteredData);
	populateHorizontalScroller(currentFilteredData);
	// Active card highlighting in goto() will still work based on IDs.
}

function switchBasemap(basemapId) {
	const newBasemap = basemapLayers.find(b => b.id === basemapId);

	if (newBasemap && newBasemap.id !== currentBasemapId) {
		currentBasemapId = newBasemap.id;
		map.setStyle(newBasemap.style); // This will trigger 'style.load' which calls refreshMapContent
		// Update URL hash after basemap change
		// updateUrlHash(); // Removed

		document.querySelectorAll('.timeline-controls .timeline-item').forEach(itemEl => {
			const circleEl = itemEl.querySelector('.timeline-circle');
			if (circleEl) {
				if (itemEl.dataset.basemapId === currentBasemapId) {
					circleEl.classList.add('active');
				} else {
					circleEl.classList.remove('active');
				}
			}
		});
	} else if (newBasemap && newBasemap.id === currentBasemapId) {
		console.log("Basemap already active:", basemapId);
	}
}

function goto(id) {
	console.log("Going to ID:", id);

	// Highlight the card in the horizontal scroller
	const scroller = document.getElementById('horizontal-card-scroller');
	if (scroller) {
		// Remove highlight from all cards
		const allCards = scroller.querySelectorAll('.horizontal-card');
		allCards.forEach(card => card.classList.remove('horizontal-card-selected'));

		// Add highlight to the selected card
		const selectedCard = scroller.querySelector(`.horizontal-card[data-id="${id}"]`);
		if (selectedCard) {
			selectedCard.classList.add('horizontal-card-selected');
			// Scroll the selected card into view
			selectedCard.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center'
			});
		}
	}

	const item = sheet2.find(sublist => sublist[0] === id);
	// Coordinates are now at item[5]
	if (item && item[5]) {
		// Assuming item[5] is "latitude,longitude"
		let latlonArray = item[5].split(',').map(Number); // Parses "lat,lon" string into [lat, lon]
		// MapLibre needs [longitude, latitude]
		let lngLat = [latlonArray[1], latlonArray[0]]; // Swap to [lon, lat]
		console.log("Flying to:", lngLat);
		map.flyTo({
			center: lngLat,
			// adjust speed
			speed: 0.5, // Slower flyTo speed
			zoom: 16 // Consider making this zoom level also part of URL or a setting
		});
		// updateUrlHash will be called by 'moveend' event - No longer applicable
		// Optionally, open the popup for the marker
		const targetMarker = markers.find(m => {
			const markerLngLat = m.getLngLat();
			return markerLngLat.lng === lngLat[0] && markerLngLat.lat === lngLat[1];
		});
		if (targetMarker && !targetMarker.getPopup().isOpen()) {
			targetMarker.togglePopup();
		}

	} else {
		console.error("Could not find item or coordinates for id:", id);
	}
}
