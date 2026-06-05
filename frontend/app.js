// ========================================================================
//  PulsePriority — SPA Controller
//  Handles screen transitions, deferred Leaflet init, data fetching,
//  card rendering with staggered animations, and map interaction.
// ========================================================================

(function () {
    'use strict';

    // --- DOM References ---
    const overviewScreen  = document.getElementById('overview-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const launchBtn       = document.getElementById('launch-dashboard-btn');
    const backBtn         = document.getElementById('back-to-overview-btn');

    // --- State ---
    let leafletMap    = null;   // Leaflet instance (created once on first launch)
    let mapReady      = false;
    let dataLoaded    = false;
    const markers     = {};


    // =====================================================================
    //  OVERVIEW: Scroll-Reveal + Counter Animations
    // =====================================================================
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // Animated number counters
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

    function animateCounter(el) {
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || '';
        const duration = 1600;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.round(eased * target) + suffix;
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // Smooth scroll for internal links
    document.querySelectorAll('#overview-screen a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });


    // =====================================================================
    //  SPA: Screen Transition Logic
    // =====================================================================

    /**
     * Transition from Overview → Dashboard
     */
    function showDashboard() {
        // 1. Fade out overview
        overviewScreen.classList.add('fade-out');

        // 2. After the CSS transition completes, swap screens
        setTimeout(() => {
            // Hide overview, reset scroll
            overviewScreen.style.display = 'none';
            window.scrollTo(0, 0);

            // Show dashboard
            dashboardScreen.style.display = 'block';

            // Lock body scroll for full-viewport dashboard
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';

            // Trigger fade-in on next frame
            requestAnimationFrame(() => {
                dashboardScreen.classList.add('fade-in');
            });

            // 3. Initialize Leaflet (only once)
            if (!mapReady) {
                initMap();
                mapReady = true;
            }

            // 4. CRITICAL: Leaflet needs the container to be visible + sized
            //    before it can calculate tile positions correctly.
            setTimeout(() => {
                if (leafletMap) {
                    leafletMap.invalidateSize({ animate: false });
                }
            }, 100);

            // 5. Load data if not already loaded
            if (!dataLoaded) {
                loadData();
            }
        }, 700);  // Matches the CSS transition duration
    }

    /**
     * Transition from Dashboard → Overview
     */
    function showOverview() {
        // Fade out dashboard
        dashboardScreen.classList.remove('fade-in');
        dashboardScreen.style.opacity = '0';

        setTimeout(() => {
            dashboardScreen.style.display = 'none';

            // Restore overview
            overviewScreen.style.display = '';
            document.body.style.overflow = '';
            document.body.style.height = '';

            // Slight delay so the browser recalculates layout
            requestAnimationFrame(() => {
                overviewScreen.classList.remove('fade-out');
            });
        }, 500);
    }

    // Wire up buttons
    launchBtn.addEventListener('click', showDashboard);
    backBtn.addEventListener('click', showOverview);


    // =====================================================================
    //  LEAFLET MAP INIT (deferred — only created when dashboard is shown)
    // =====================================================================
    function initMap() {
        leafletMap = L.map('map', {
            zoomControl: false
        }).setView([47.5316, 21.6247], 14);

        L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(leafletMap);
    }


    // =====================================================================
    //  DATA FETCHING
    // =====================================================================
    async function loadData() {
        try {
            const response = await fetch('http://localhost:8000/api/hotspots');
            const json     = await response.json();
            const data     = json.data;

            dataLoaded = true;
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


    // =====================================================================
    //  SEVERITY HELPERS
    // =====================================================================
    function getSeverityClass(score) {
        if (score > 500) return 'critical';
        if (score > 200) return 'moderate';
        return 'low';
    }

    function getMarkerColor(severity) {
        const colors = {
            critical: 'hsl(0, 100%, 65%)',
            moderate: 'hsl(30, 100%, 62%)',
            low:      'hsl(140, 70%, 52%)'
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


    // =====================================================================
    //  DASHBOARD RENDERER
    // =====================================================================
    function renderDashboard(data) {
        const listContainer = document.getElementById('hotspot-list');
        listContainer.innerHTML = '';

        data.forEach((item, index) => {
            const severity = getSeverityClass(item.pulse_score);
            const color    = getMarkerColor(severity);

            // ── Map Marker ──
            const marker = L.circleMarker([item.lat, item.lng], {
                radius: severity === 'critical' ? 12 : (severity === 'moderate' ? 9 : 6),
                fillColor: color,
                color: 'rgba(255,255,255,0.6)',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.75
            }).addTo(leafletMap);

            // Pulsing ring for critical markers
            if (severity === 'critical') {
                L.circleMarker([item.lat, item.lng], {
                    radius: 18,
                    fillColor: color,
                    color: 'transparent',
                    fillOpacity: 0.15,
                    className: 'pulse-ring'
                }).addTo(leafletMap);
            }

            // Popup
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

            // Click → fly to marker
            card.addEventListener('click', () => {
                leafletMap.flyTo([item.lat, item.lng], 16, {
                    animate: true,
                    duration: 1.2
                });
                marker.openPopup();

                // Flash glow feedback
                card.style.boxShadow = `0 0 24px ${getGlowColor(severity)}`;
                setTimeout(() => { card.style.boxShadow = ''; }, 800);
            });

            listContainer.appendChild(card);
        });
    }

})();
