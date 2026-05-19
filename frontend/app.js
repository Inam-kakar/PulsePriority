// ========================================================================
//  PulsePriority — App Controller
//  Handles map, data fetching, card rendering with staggered animations
// ========================================================================

// --- Initialize Leaflet Map centered on Debrecen ---
const map = L.map('map', {
    zoomControl: false        // We'll add it in a better position
}).setView([47.5316, 21.6247], 14);

// Position zoom control bottom-right for cleaner layout
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Add Dark Mode CartoDB tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Store markers for card → map interaction
const markers = {};


// --- Severity Helpers ---
function getSeverityClass(score) {
    if (score > 500) return 'critical';
    if (score > 200) return 'moderate';
    return 'low';
}

function getMarkerColor(severity) {
    const colors = {
        critical: 'hsl(0, 100%, 65%)',    // Matches CSS --critical
        moderate: 'hsl(30, 100%, 62%)',    // Matches CSS --moderate
        low:      'hsl(140, 70%, 52%)'     // Matches CSS --low
    };
    return colors[severity] || colors.low;
}

function getGlowColor(severity) {
    const glows = {
        critical: 'hsla(0, 100%, 65%, 0.5)',
        moderate: 'hsla(30, 100%, 62%, 0.5)',
        low:      'hsla(140, 70%, 52%, 0.5)'
    };
    return glows[severity] || glows.low;
}


// --- Data Fetching ---
async function loadData() {
    try {
        const response = await fetch('http://localhost:8000/api/hotspots');
        const json = await response.json();
        const data = json.data;

        renderDashboard(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('hotspot-list').innerHTML = `
            <div class="loading">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="hsl(0, 100%, 65%)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>Unable to connect. Is the API running?</span>
            </div>`;
    }
}


// --- Dashboard Renderer ---
function renderDashboard(data) {
    const listContainer = document.getElementById('hotspot-list');
    listContainer.innerHTML = '';  // Clear loading spinner

    data.forEach((item, index) => {
        const severity = getSeverityClass(item.pulse_score);
        const color = getMarkerColor(severity);

        // ── Map Marker ──
        const marker = L.circleMarker([item.lat, item.lng], {
            radius: severity === 'critical' ? 12 : (severity === 'moderate' ? 9 : 6),
            fillColor: color,
            color: 'rgba(255,255,255,0.6)',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.75
        }).addTo(map);

        // Add a subtle pulsing shadow ring for critical markers
        if (severity === 'critical') {
            L.circleMarker([item.lat, item.lng], {
                radius: 18,
                fillColor: color,
                color: 'transparent',
                fillOpacity: 0.15,
                className: 'pulse-ring'
            }).addTo(map);
        }

        // Map Popup content
        marker.bindPopup(`
            <h3>${item.name}</h3>
            <p><strong>Vehicle:</strong> ${item.vehicle_id}</p>
            <p><strong>Delay:</strong> ${item.delay_seconds}s</p>
            <p><strong>Passengers:</strong> ${item.passenger_count}</p>
            <hr style="border:0; border-top:1px solid hsla(225,15%,30%,0.4); margin:10px 0;">
            <p style="color:${color}"><strong>Action:</strong> ${item.recommended_action}</p>
        `);

        markers[item.intersection_id] = marker;

        // ── Sidebar Card ──
        const card = document.createElement('div');
        card.className = `hotspot-card ${severity}`;
        card.id = `hotspot-card-${item.intersection_id}`;

        // Stagger the slide-in animation: each card waits a bit longer
        card.style.setProperty('--delay', `${index * 80}ms`);

        card.innerHTML = `
            <div class="card-header">
                <span class="card-title">${item.name}</span>
                <span class="score-badge">Score: ${item.pulse_score}</span>
            </div>
            <div class="card-stats">
                Transit: ${item.vehicle_id} &nbsp;·&nbsp; Pax: ${item.passenger_count} &nbsp;·&nbsp; Delay: ${item.delay_seconds}s
            </div>
            <div class="action-label">${item.recommended_action}</div>
        `;

        // Click → fly to marker on map
        card.addEventListener('click', () => {
            map.flyTo([item.lat, item.lng], 16, {
                animate: true,
                duration: 1.2
            });
            marker.openPopup();

            // Briefly highlight the clicked card
            card.style.boxShadow = `0 0 24px ${getGlowColor(severity)}`;
            setTimeout(() => {
                card.style.boxShadow = '';
            }, 800);
        });

        listContainer.appendChild(card);
    });
}


// --- Boot ---
loadData();