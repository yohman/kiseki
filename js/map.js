// Define the URL of the REST API endpoint
const sheetId = '1SkLkL2Hfw5wD3-ZfASaT5H4lCwMKRvkSGL1HZpVWMGs';
const apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/map?key=AIzaSyAUi4KazffmDZV_dQUnMUKA1jJt4i0mqlU';

// const githubDataUrl = 'https://raw.githubusercontent.com/yohman/kiseki/main/sheets_data.json'; // New GitHub Raw URL
const githubDataUrl = 'https://raw.githubusercontent.com/yohman/kiseki/refs/heads/main/sheets_data.json'; // New GitHub Raw URL
const useLocalData = true; // SET TO true TO USE LOCAL JSON as a secondary option if GitHub fails, false FOR API as secondary
const localDataPath = 'sheets_data.json'; // Path to your local data file (relative to index.html)

let sheet = null;
let sheet2 = []; // Initialize sheet2
let pillTimeout = null;
let pillFadeTimeout = null;

let map; // Declare map globally
let markers = []; // To keep track of marker instances
let basemapLayers = [];
let currentFilteredData = []; // For search results
let globalSearchTermFromUrl = null; // To store search term from URL
let globalHashtagFromUrl = null; // To store hashtag from URL

let currentBasemapId = 'esri-world-imagery'; // Default active basemap changed to Google Satellite ("Today")
// Global state for initial map view
let mapInitState = {
	lat: null, // Will no longer be set by URL
	lon: null, // Will no longer be set by URL
	zoom: null, // Will no longer be set by URL
	basemapIdFromUrl: null, // Will no longer be set by URL
	urlStateApplied: false // Will remain false
};

// create a global variable array of objects for the master data
let masterData = []; // This will hold the processed data for the map

// Global variable to track modal state
let isModalOpen = true;


// begin...
fetchDataAndInitialize();


// Main data fetching and initialization logic
function fetchDataAndInitialize() {
	// Try Google Sheets API first
	console.log(`Attempting to fetch data from Google Sheets API (${apiUrl})`);
	fetch(apiUrl)
		.then(response => {
			if (!response.ok) {
				// Only fallback for rate limit or server errors
				if ([403, 429, 503].includes(response.status)) {
					console.log(`Google Sheets API rate limit or server error encountered (status: ${response.status})`);
					throw new Error(`API rate/server error (${response.status})`);
				}
				throw new Error(`Network response was not ok from API: ${response.statusText}`);
			}
			return response.json();
		})
		.then(data => {
			if (data && data.values && Array.isArray(data.values)) {
				sheet = data.values;
				console.log("Successfully loaded data from Google Sheets API");
				// first row headers into a variable
				const headers = sheet[0] || [];
				console.log("Headers from Google Sheets API:", headers);
				// all other rows into a variable
				rows = sheet.slice(1) || [];
				console.log("Data rows from Google Sheets API:", rows);
				// Update masterData with processed rows, adding the headers as keys
				masterData = rows.map((row, index) => {
					const dataObject = {};
					headers.forEach((header, headerIndex) => {
						dataObject[header] = row[headerIndex] || ''; // Use empty string if no data
					});
					dataObject.id = index + 1; // Add an ID starting from 1	
					return dataObject;
				});
				
				console.log("Processed masterData from Google Sheets API:", masterData);
				processAndSetupMap();
			} else {
				console.error("API response did not contain 'values' array.", data);
				throw new Error("API response format error");
			}
		})
		.catch(apiError => {
			console.error('Error fetching or processing Google Sheets API data:', apiError);
			// Fallback to GitHub Raw JSON
			console.log(`Falling back to GitHub Raw URL (${githubDataUrl})`);
			fetch(githubDataUrl)
				.then(response => {
					if (!response.ok) {
						throw new Error(`Network response was not ok for ${githubDataUrl}: ${response.statusText}`);
					}
					return response.json();
				})
				.then(githubJsonData => {
					if (githubJsonData && githubJsonData.map && Array.isArray(githubJsonData.map)) {
						sheet = githubJsonData.map;
						console.log("Successfully loaded data from GitHub Raw URL");
						console.log("Data source: GitHub Raw JSON");
						// first row headers into a variable
						const headers = sheet[0] || [];
						console.log("Headers from GitHub Raw JSON:", headers);
						// all other rows into a variable
						rows = sheet.slice(1) || [];
						console.log("Data rows from GitHub Raw JSON:", rows);
						// Update masterData with processed rows, adding the headers as keys
						masterData = rows.map((row, index) => {
							const dataObject = {};
							headers.forEach((header, headerIndex) => {
								dataObject[header] = row[headerIndex] || ''; // Use empty string if no data
							});
							dataObject.id = index + 1; // Add an ID starting from 1
							return dataObject;
						});
						console.log("Processed masterData from GitHub Raw JSON:", masterData);
						// Proceed to process and setup the map
						processAndSetupMap();
					} else {
						console.error('GitHub Raw JSON data is not in the expected format (missing "map" array or not an array).');
						throw new Error('GitHub data format error. Proceeding to fallback.');
					}
				})
				.catch(githubError => {
					console.error('Error fetching or processing GitHub Raw JSON data:', githubError);
					// Final fallback: Local data or API based on useLocalData
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
									console.log("Data source: Local JSON");
									processAndSetupMap();
								} else {
									console.error('Local JSON data is not in the expected format (missing "map" array or not an array).');
									alert("Failed to load map data from all sources. The map may not function correctly.");
								}
							})
							.catch(localError => {
								console.error('Error fetching or processing local JSON data:', localError);
								alert("Failed to load map data. Please check your internet connection or try again later.");
							});
					} else {
						alert("Failed to load map data. Please check your internet connection or try again later.");
					}
				});
		});
}



// NEW function to parse URL query parameters
function parseUrlQueryParameters() {
	const queryParams = new URLSearchParams(window.location.search);
	if (queryParams.has('s')) {
		globalSearchTermFromUrl = queryParams.get('s');
		console.log("Search term from URL:", globalSearchTermFromUrl);
	}
	if (queryParams.has('hashtag')) {
		globalHashtagFromUrl = queryParams.get('hashtag');
		console.log("Hashtag from URL:", globalHashtagFromUrl);
	}
}


// Process and setup the map with the masterData
function processAndSetupMap() {

	// Define the mapping of old keys to new keys
	const keyMap = {
		'タイムスタンプ': 'Timestamp',
		'あなたのあだ名': 'Author',
		'思い出の場所の名前': 'Title',
		'どういう思い出？': 'Description',
		'緯度経度をゲット！': 'Coordinates',
		'あなたはおいくつ？': 'Age',
		'アバターを選ぶ': 'Avatar',
		'#ハッシュタグ（複数OK）': 'Hashtag',
		'ジャンル': 'Genre',
		'西暦で何年の思い出？': 'Year'
	};

	// Function to rename keys in an object
	function renameKeys(obj, keyMap) {
		const renamedObj = {};
		for (const oldKey in obj) {
			if (obj.hasOwnProperty(oldKey)) {
				const newKey = keyMap[oldKey] || oldKey; // Use the new key if it exists, otherwise keep the old key
				renamedObj[newKey] = obj[oldKey];
			}
		}
		return renamedObj;
	}

	// After loading and processing data, rename the keys in masterData
	masterData = masterData.map(item => renameKeys(item, keyMap));

	// if Coordinates have brackets, remove them
	masterData.forEach(item => {
		if (item['Coordinates']) {
			item['Coordinates'] = item['Coordinates'].replace(/[\[\]()]|^\s+|\s+$/g, '').trim(); // Remove brackets and trim spaces
		}
	});
	console.log("Master data with renamed keys:", masterData);

	// use the masterData instead of sheet2 to set currentFilteredData
	currentFilteredData = masterData

	// Update the modal with the count of memories
	const memoriesCountElement = document.getElementById('mapping-memories-count');
	if (memoriesCountElement) {
		// This sets the total count initially. It might be updated in setupMapAndUI if a URL search term is present.
		memoriesCountElement.textContent = `Mapping ${masterData.length} memories...`;
	} else {
		console.warn("Element with ID 'mapping-memories-count' not found in the modal.");
	}

	setupMapAndUI(); // Call the main UI setup function
}


// Main function to set up the map and UI components
function setupMapAndUI() {
	console.log("Setting up map and UI...");
	parseUrlQueryParameters(); // Parse URL for ?s=searchTerm and ?hashtag=...

	// Initialize basemap layers
	initializeBasemapData();

	// if (mapInitState.basemapIdFromUrl && basemapLayers.find(b => b.id === mapInitState.basemapIdFromUrl)) {
	// 	currentBasemapId = mapInitState.basemapIdFromUrl;
	// }

	const memoriesCountElement = document.getElementById('mapping-memories-count');

	if (globalHashtagFromUrl) {
		// Normalize hashtag (remove leading # for search, but display with #)
		let searchHashtag = globalHashtagFromUrl.trim();
		if (searchHashtag.startsWith('#')) {
			searchHashtag = searchHashtag.substring(1);
		}
		const filtered = masterData.filter(item => {
			const hashtags = (item['Hashtag'] || '').toLowerCase().split(/\s+/);
			return hashtags.some(h => h.replace(/^#/, '') === searchHashtag.toLowerCase());
		});
		currentFilteredData = filtered;

		if (memoriesCountElement) {
			const displayHashtag = globalHashtagFromUrl.startsWith('#') ? globalHashtagFromUrl : `#${globalHashtagFromUrl}`;
			memoriesCountElement.innerHTML = `Mapping ${filtered.length} memories for hashtag <strong>${displayHashtag}</strong>...`;
		}

		const searchInput = document.getElementById('search-input');
		const searchContainer = document.getElementById('search-container');
		if (searchInput) {
			searchInput.value = `#${searchHashtag}`;
		}
		if (searchContainer) {
			searchContainer.classList.add('search-active');
		}

		refreshMapContent(currentFilteredData);
		populateSidebar(currentFilteredData);
		populateHorizontalScroller(currentFilteredData);

		// Zoom to extent of filtered markers
		setTimeout(() => {
			zoomToFilteredMarkers(currentFilteredData);
		}, 0);

	} else if (globalSearchTermFromUrl) {
		// If a search term is present in the URL, apply it to the search input and filter data
		const searchInput = document.getElementById('search-input');
		const searchContainer = document.getElementById('search-container');
		if (searchInput) {
			searchInput.value = globalSearchTermFromUrl;
		}
		if (searchContainer) {
			searchContainer.classList.add('search-active');
		}
		filterAndRefreshUI(globalSearchTermFromUrl.toLowerCase());

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

	initMapInstance();
	createTimelineControls();
	setupHamburgerMenu();
	setupHeaderLogoLink();
	setupModal(); 
	setupSearchFeature();

	// Start the random memory pill after everything is ready
	console.log("Calling startRandomMemoryPill...");
	startRandomMemoryPill(); // Call the memory pill logic after everything is set up
}

// --- Random Memory Pill Logic ---
function startRandomMemoryPill() {
	console.log("Starting random memory pill...");
	const pill = document.getElementById('random-memory-pill');
	const modalOverlay = document.getElementById('welcome-modal-overlay');

	// Debugging: Check if pill element exists
	if (!pill) {
		console.error("Memory pill element not found in the DOM.");
		return;
	}

	// Debugging: Check if masterData is populated
	if (!masterData || !Array.isArray(masterData) || masterData.length === 0) {
		console.warn("Master data is not ready. Retrying...");
		setTimeout(startRandomMemoryPill, 400);
		return;
	}

	let memories = masterData.filter(m => m['Title'] && m['Description'] && m['id']);
	if (memories.length === 0) {
		console.warn("No valid memories found for the pill.");
		return;
	}

	let lastIndex = -1;

	function showRandomMemory() {
		console.log("Showing random memory pill...");
		if (!memories.length) {
			console.warn("No memories available to show.");
			return;
		}
		let idx;
		do {
			idx = Math.floor(Math.random() * memories.length);
		} while (memories.length > 1 && idx === lastIndex);
		lastIndex = idx;
		const m = memories[idx];
		const pillText = `<span class="pill-title">${m['Title']}</span> <span class="pill-desc">${m['Description']}</span>`;
		pill.innerHTML = pillText;
		pill.setAttribute('data-id', m['id']);
		pill.classList.remove('fade-out');
		pill.classList.add('fade-in');
		pill.style.visibility = 'visible';

		clearTimeout(pillFadeTimeout);
		pillFadeTimeout = setTimeout(() => {
			pill.classList.remove('fade-in');
			pill.classList.add('fade-out');
			setTimeout(() => {
				pill.style.visibility = 'hidden';
			}, 700);
		}, 3400);
	}

	function cycle() {
		console.log("Cycling random memory pill...");
		showRandomMemory();
		clearTimeout(pillTimeout);
		pillTimeout = setTimeout(cycle, 5800);
	}

	// Ensure the first memory is shown immediately
	showRandomMemory();
	pillTimeout = setTimeout(cycle, 4800);

	pill.onclick = function() {
		const id = parseInt(pill.getAttribute('data-id'), 10);
		if (!isNaN(id)) {
			if (modalOverlay) modalOverlay.classList.add('modal-hidden');
			if (window.goto) setTimeout(() => window.goto(id), 350);
		}
	};
}

// Function to fit bounds to currently filtered markers
function fitBoundsToFilteredMarkers() {
	console.log("Fitting bounds to filtered markers...");
	if (!map || currentFilteredData.length === 0) return;

	const bounds = new maplibregl.LngLatBounds();
	let hasValidMarkers = false;

	currentFilteredData.forEach(item => {
		if (item['Coordinates'] && typeof item['Coordinates'] === 'string' && item['Coordinates'].includes(',')) {
			const latlonArray = item['Coordinates'].split(',').map(Number);
			if (latlonArray.length === 2 && !isNaN(latlonArray[0]) && !isNaN(latlonArray[1])) {
				bounds.extend([latlonArray[1], latlonArray[0]]);
				hasValidMarkers = true;
			}
		}
	});

	if (hasValidMarkers && !bounds.isEmpty()) {
		map.fitBounds(bounds, {
			padding: { top: 100, bottom: 100, left: 100, right: 100 },
			maxZoom: 17,
			pitch: 50
		});
	}
}

function setupModal() {
	const modalOverlay = document.getElementById('welcome-modal-overlay');
	const modalCloseButton = document.getElementById('modal-close-button');
	const exploreButton = document.getElementById('modal-explore-btn');

	if (modalOverlay && exploreButton) {
		exploreButton.addEventListener('click', () => {
			modalOverlay.classList.add('modal-hidden');
			isModalOpen = false; // Update modal state
			stopRandomMemoryPill(); // Stop the random pill
			// Wait for the modal transition to complete before fitting bounds
			modalOverlay.addEventListener('transitionend', () => {
				if (!isModalOpen) {
					fitBoundsToFilteredMarkers();
				}
			}, { once: true });
		});
	}

	if (modalOverlay && modalCloseButton) {
		modalCloseButton.addEventListener('click', () => {
			modalOverlay.classList.add('modal-hidden');
			isModalOpen = false; // Update modal state
			stopRandomMemoryPill(); // Stop the random pill
		});
	}
}

function stopRandomMemoryPill() {
	const pill = document.getElementById('random-memory-pill');
	if (pill) {
		pill.style.visibility = 'hidden'; // Hide the pill
		clearTimeout(pillTimeout); // Clear the pill timeout
		clearTimeout(pillFadeTimeout); // Clear the fade timeout
	}
}

function filterAndRefreshUI(searchTerm) {
	console.log("Filtering data with search term:", searchTerm);
	if (!searchTerm || searchTerm.trim() === '') {
		currentFilteredData = [...masterData];
	} else {
		currentFilteredData = masterData.filter(item => {
			const author = (item['Author'] || '').toLowerCase();
			const title = (item['Title'] || '').toLowerCase();
			const description = (item['Description'] || '').toLowerCase();
			const hashtag = (item['Hashtag'] || '').toLowerCase();
			const genre = (item['Genre'] || '').toLowerCase();

			return author.includes(searchTerm) ||
				title.includes(searchTerm) ||
				description.includes(searchTerm) ||
				hashtag.includes(searchTerm) ||
				genre.includes(searchTerm);
		});
	}

	refreshMapContent(currentFilteredData);
	populateSidebar(currentFilteredData);
	populateHorizontalScroller(currentFilteredData);

	// Fit bounds only if the modal is closed
	if (!isModalOpen) {
		fitBoundsToFilteredMarkers();
	}
}

// Helper function to zoom to extent of filtered markers
function zoomToFilteredMarkers(data) {
	if (!map || !data || data.length === 0) return;
	const bounds = new maplibregl.LngLatBounds();
	let hasValid = false;
	data.forEach(item => {
		if (item['Coordinates'] && typeof item['Coordinates'] === 'string' && item['Coordinates'].includes(',')) {
			const latlonArray = item['Coordinates'].split(',').map(Number);
			if (latlonArray.length === 2 && !isNaN(latlonArray[0]) && !isNaN(latlonArray[1])) {
				bounds.extend([latlonArray[1], latlonArray[0]]);
				hasValid = true;
			}
		}
	});
	if (hasValid && !bounds.isEmpty()) {
		// map.fitBounds(bounds, {
		// 	padding: { top: 100, bottom: 100, left: 100, right: 100 },
		// 	maxZoom: 17
		// });
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


let isFlying = false; // Flag to track if the map is flying
let isRotating = false; // Global flag to track if the map is rotating

// Initialize MapLibre map instance
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

	let initialCenter = [138.2529, 36.2048]; // Center of Japan
	let initialZoom = 0; // Zoom level to show all of Japan

	map = new maplibregl.Map({
		container: 'map',
		style: initialBasemap.style,
		center: initialCenter,
		zoom: initialZoom,
		pitch: 0, // Tilt the map
		bearing: 0, // Optional: slight bearing for better 3D view,
		maxZoom: 18 // Set a maximum zoom level

	});

	map.on('style.load', () => {
		console.log("Map style loaded.");
		refreshMapContent(currentFilteredData); // Pass current (possibly filtered) data

	});

	// Handle user interactions
	map.on('movestart', () => {
		if (isFlying) {
			console.log("User interrupted the map flight. Stopping ongoing animations.");
			map.stop(); // Stop the flight if the user starts panning
			isFlying = false; // Reset the flag
		}
	});

    map.on('style.load', () => {
        map.setProjection({
            type: 'globe', // Set projection to globe
        });
    });


}

// this adds markers to the map based on the current data
function refreshMapContent(dataToDisplay) { // Modified to accept data
	console.log("Refreshing map content with data:", dataToDisplay);
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
		// New masterData item structure:
		// item['id']=id (generated)
		// item['Timestamp']
		// item['Author']
		// item['Title']
		// item['Description']
		// item['Coordinates'] ("lat,lon" string)
		// item['Age']
		// item['Avatar'] (raw, e.g., "sport-boy")
		// item['Hashtag']
		// item['Genre']
		// console the coordinates


		if (!item['Coordinates'] || typeof item['Coordinates'] !== 'string' || !item['Coordinates'].includes(',')) {
			console.warn("Skipping item in refreshMapContent due to missing or invalid coordinates string:", item['Title'] || `Item ID ${item['id']}`, "Coords string:", item['Coordinates']);
			return;
		}
		if (!item['Avatar']) {
			console.warn("Skipping item in refreshMapContent due to missing avatar:", item['Title'] || `Item ID ${item['id']}`);
			return;
		}

		const imageUrl = `images/avatars/${item['Avatar']}.png`;
		let latlonArray;
		try {
			latlonArray = item['Coordinates'].split(',').map(Number);
			if (latlonArray.length !== 2 || isNaN(latlonArray[0]) || isNaN(latlonArray[1])) {
				throw new Error("Invalid coordinate format");
			}
		} catch (e) {
			console.warn("Error parsing coordinates for item:", item['Title'] || `Item ID ${item['id']}`, item['Coordinates'], e);
			return;
		}

		let lngLat = [latlonArray[1], latlonArray[0]];
		const author = item['Author'] || 'N/A';
		const title = item['Title'] || 'N/A';
		const description = item['Description'] || 'No description.';
		const genre = item['Genre'] || ''; // Genre
		const hashtag = item['Hashtag'] || ''; // Hashtag

		const markerContainer = document.createElement('div');
		markerContainer.style.display = 'flex';
		markerContainer.style.flexDirection = 'column';
		markerContainer.style.alignItems = 'center';
		markerContainer.style.cursor = 'pointer'; // Add pointer cursor to indicate clickable
		markerContainer.setAttribute('data-id', item['id']); // Set marker ID as a data attribute
		

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

		// Fix: Use the itemId variable defined above
		markerContainer.addEventListener('click', function(event) {
			event.stopPropagation();
			console.log("Marker clicked for item ID:", item['id']);
			console.log("Marker coordinates:", lngLat);
			console.log("Marker title:", title);
			console.log("Marker author:", author);
			console.log("Marker description:", description);
			goto(item['id']);
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
	// if (validMarkersExist && !bounds.isEmpty() && document.getElementById('search-input').value === '') {
	// 	map.fitBounds(bounds, {
	// 		padding: {
	// 			top: 100,
	// 			bottom: 100,
	// 			left: 100,
	// 			right: 100
	// 		},
	// 		maxZoom: 17
	// 	});
	// } else if (dataToDisplay.length > 0 && (!validMarkersExist || bounds.isEmpty())) {
	// 	console.warn("No valid markers to bound for current filter, map initialized with default/current center/zoom.");
	// } else if (dataToDisplay.length === 0) {
	// 	console.log("No data for current filter, map initialized with default/current center/zoom.");
	// }
}

function populateSidebar(dataToDisplay) { // Modified to accept data
	const sidebar = $('.sidebar');
	sidebar.empty();
	if (!dataToDisplay || dataToDisplay.length === 0) return; // Check dataToDisplay

	dataToDisplay.forEach(function(item) { // Use dataToDisplay
		// item['id']=id (generated)
		// item['Timestamp']
		// item['Author']
		// item['Title']
		// item['Description']
		// item['Coordinates'] ("lat,lon" string)
		// item['Age']
		// item['Avatar'] (raw, e.g., "sport-boy")
		// item['Hashtag']
		// item['Genre']
		if (item['id'] === undefined || item['Author'] === undefined || item['Avatar'] === undefined) {
			return;
		}
		const itemId = item['id'];
		const author = item['Author'];
		const avatarUrl = `images/avatars/${item['Avatar']}.png`;

		const sidebarItemHTML = `
		<div class="sidebar-item" onclick="goto(${itemId})">
			<img src="${avatarUrl}" class="sidebar-item-icon-img">
			<p class="sidebar-item-author-name">${author}</p>
		</div>`;
		sidebar.append(sidebarItemHTML);
	});
}

function populateHorizontalScroller(dataToDisplay) { // Modified to accept data
	console.log("Populating horizontal scroller with data:", dataToDisplay);
	const scroller = $('#horizontal-card-scroller');
	scroller.empty();
	if (!dataToDisplay || dataToDisplay.length === 0) return; // Check dataToDisplay

	// Shuffle the dataToDisplay array for random order (Fisher-Yates shuffle)
	const shuffled = [...dataToDisplay];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	shuffled.forEach(function(item) {
		// item['id']=id (generated)
		// item['Timestamp']
		// item['Author']
		// item['Title']
		// item['Description']
		// item['Coordinates'] ("lat,lon" string)
		// item['Age']
		// item['Avatar'] (raw, e.g., "sport-boy")
		// item['Hashtag']
		// item['Genre']
		if (item['id'] === undefined || item['Author'] === undefined || item['Avatar'] === undefined) {
			return;
		}
		const itemId = item['id'];
		const author = item['Author'];
		const avatarUrl = `images/avatars/${item['Avatar']}.png`;

		const cardHTML = `
		<div class="horizontal-card" data-id="${itemId}" onclick="goto(${itemId})">
			<img src="${avatarUrl}" class="horizontal-card-icon-img">
			<p class="horizontal-card-author-name">${author}</p>
		</div>`;
		scroller.append(cardHTML);
	});
}

function createTimelineControls() {
	console.log("Creating timeline controls...");
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
	console.log("Triggering search from element:", element, "with term:", searchTerm);
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

	// Prevent actions if the map is already flying
	if (isFlying) {
		console.log("Map is flying. Action blocked.");
		return;
	}

	isFlying = true; // Set the flag to indicate the map is flying

	// Disable user interactions during the flight
	map.dragPan.disable();
	map.scrollZoom.disable();
	map.boxZoom.disable();
	map.keyboard.disable();
	map.doubleClickZoom.disable();
	map.touchZoomRotate.disable();

	// Disable clicks on horizontal cards during the fly action
	const scroller = document.getElementById('horizontal-card-scroller');
	if (scroller) {
		const allCards = scroller.querySelectorAll('.horizontal-card');
		allCards.forEach(card => card.style.pointerEvents = 'none'); // Disable clicks
	}

	// Highlight the card in the horizontal scroller
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

	const item = masterData.find(item => item.id === id);
	if (item && item['Coordinates']) {
		let latlonArray = item['Coordinates'].split(',').map(Number);
		let lngLat = [latlonArray[1], latlonArray[0]];

		// Calculate offset for small screens to keep popup visible
		let offset = [0, 0];
			// Move marker towards bottom by offsetting center upward (in pixels)
			// Negative y moves the map center up (marker down)
			offset = [0, window.innerHeight * 0.22]; // ~22% of screen height

		console.log("Flying to:", lngLat, "with offset:", offset);

		map.flyTo({
			center: lngLat,
			speed: 0.8,
			zoom: 16,
			offset: offset,
			bearing: 0, // Start with no rotation
			duration: 5000 // Duration of the flyTo animation in milliseconds
		});

		// Add rotation after flyTo animation completes
		map.once('moveend', () => {
			console.log("Flight completed.");
			isFlying = false; // Reset the flag after the flight ends

			// Re-enable user interactions
			map.dragPan.enable();
			map.scrollZoom.enable();
			map.boxZoom.enable();
			map.keyboard.enable();
			map.doubleClickZoom.enable();
			map.touchZoomRotate.enable();

			// Re-enable clicks on horizontal cards
			if (scroller) {
				const allCards = scroller.querySelectorAll('.horizontal-card');
				allCards.forEach(card => card.style.pointerEvents = 'auto'); // Enable clicks
			}

			// Rotate the map 360 degrees over 30 seconds
			map.rotateTo(360, {
				duration: 30000,
				easing: (x) => x // Linear easing for constant speed
			});

			// Ensure the popup is opened after the flight completes
			if (targetMarker && !targetMarker.getPopup().isOpen()) {
				targetMarker.togglePopup(); // Open the popup
			}
		});

		const targetMarker = markers.find(m => {
			const markerId = parseInt(m.getElement().getAttribute('data-id'), 10); // Retrieve marker ID from its element
			return markerId === id; // Match by ID
		});

		if (targetMarker) {
			console.log("Opening popup for marker with ID:", id);
			// Ensure the popup is opened by default
			if (!targetMarker.getPopup().isOpen()) {
				targetMarker.togglePopup(); // Open the popup if it's not already open
			}
		} else {
			console.warn("Marker not found for ID:", id, "or popup is already open.");
		}

	} else {
		console.error("Could not find item or coordinates for id:", id);
		isFlying = false; // Reset the flag if no valid action is performed

		// Re-enable user interactions
		map.dragPan.enable();
		map.scrollZoom.enable();
		map.boxZoom.enable();
		map.keyboard.enable();
		map.doubleClickZoom.enable();
		map.touchZoomRotate.enable();

		// Re-enable clicks on horizontal cards
		if (scroller) {
			const allCards = scroller.querySelectorAll('.horizontal-card');
			allCards.forEach(card => card.style.pointerEvents = 'auto'); // Enable clicks
		}
	}
}


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
					maxzoom: 19
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
					maxzoom: 19
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
					maxzoom: 19
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
					maxzoom: 19
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
					maxzoom: 19
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
// let isRotating = false;
let rotationFrame;

function tiltAndRotateMap() {
	if (isRotating) {
		console.log("Map is already rotating.");
		return;
	}

	isRotating = true;

	// First, tilt and reset bearing to 0
	map.easeTo({
		pitch: 60,
		bearing: 0,
		duration: 2000,
		easing: (t) => t
	});

	// When the tilt finishes, start manual rotation
	map.once('moveend', () => {
		if (isRotating) {
			startManualRotation();
		}
	});

	map.on('click', stopMapRotation);
}

function startManualRotation() {
	let lastTime = performance.now();

	function rotateStep(now) {
		if (!isRotating) return;

		const deltaTime = now - lastTime;
		lastTime = now;

		const bearing = map.getBearing();
		map.setBearing(bearing + (360 / 60000) * deltaTime); // Full rotation in 60 sec

		rotationFrame = requestAnimationFrame(rotateStep);
	}

	rotationFrame = requestAnimationFrame(rotateStep);
}

function stopMapRotation() {
	if (isRotating) {
		console.log("Stopping map rotation.");
		isRotating = false;
		cancelAnimationFrame(rotationFrame);
		map.off('click', stopMapRotation);
	}
}