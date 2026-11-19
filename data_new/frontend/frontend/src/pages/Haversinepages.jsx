import { useState, useRef, useEffect, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import styles from './HaversinePage.module.css'

/* ══════════════════════════════════════════════════
   Haversine calculation logic & self-checks
   ══════════════════════════════════════════════════ */
const R = 6371
const toRad = d => d * Math.PI / 180

function validate(lat, lng) {
    if (
        typeof lat !== 'number' || typeof lng !== 'number' ||
        isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) throw new RangeError('Invalid coordinates')
}

function haversineKm(a, b, c, d) {
    validate(a, b); validate(c, d)
    const dLat = toRad(c - a), dLng = toRad(d - b)
    let h =
        Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.pow(Math.sin(dLng / 2), 2)
    h = Math.min(1, Math.max(0, h))
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const CHECKS_RESULTS = (() => {
    const tests = [
        ['Same point gives 0 km',
            () => haversineKm(15.36, 75.12, 15.36, 75.12) === 0],
        ['1° of latitude ≈ 111.19 km',
            () => Math.abs(haversineKm(0, 0, 1, 0) - 111.19) < 0.01],
        ['London to Paris ≈ 343.5 km',
            () => Math.abs(haversineKm(51.5074, -0.1278, 48.8566, 2.3522) - 343.5) < 1],
        ['Latitude 95 is rejected',
            () => { try { haversineKm(95, 0, 0, 0); return false } catch (e) { return e instanceof RangeError } }],
    ]
    return tests.map(([label, fn]) => {
        let ok
        try { ok = fn() } catch { ok = false }
        return { label, ok }
    })
})()

/* ── Preset locations for quick testing ── */
const PRESETS = [
    { label: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
    { label: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { label: 'Mumbai', lat: 19.0760, lng: 72.8777 },
]

function esc(t) {
    return String(t || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

/* ══════════════════════════════════════════════════
   Custom Leaflet HTML divIcons
   (Vector-based, immune to missing asset/bundling issues)
   ══════════════════════════════════════════════════ */
const userIcon = L.divIcon({
    className: 'custom-user-marker',
    html: `
    <div style="
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #2563eb;
      border: 3px solid #ffffff;
      box-shadow: 0 0 0 4px rgba(37,99,235,0.35), 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
    </div>
  `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
})

function createStationIcon(isFull, isSelected) {
    const bg = isFull ? '#d97706' : '#059669'
    const stroke = isSelected ? '#111827' : '#ffffff'
    const strokeWidth = isSelected ? 3 : 2
    const size = isSelected ? 34 : 28
    return L.divIcon({
        className: 'custom-station-marker',
        html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        background: ${bg};
        border: ${strokeWidth}px solid ${stroke};
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <svg style="transform: rotate(45deg); width: ${size * 0.55}px; height: ${size * 0.55}px;" viewBox="0 0 24 24" fill="white">
          <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.9 17.06 11 21 11 21z"/>
        </svg>
      </div>
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
    })
}

/* ══════════════════════════════════════════════════
   HaversinePage Component with Leaflet Map
   ══════════════════════════════════════════════════ */
export default function HaversinePage() {
    // ── Input states ──
    const [lat, setLat] = useState('')
    const [lng, setLng] = useState('')
    const [radius, setRadius] = useState('10')

    // ── Geolocation & request state ──
    const [locFeedback, setLocFeedback] = useState('Detecting your GPS location...')
    const [locStatusType, setLocStatusType] = useState('')
    const [isLocating, setIsLocating] = useState(true)
    const [isLoading, setIsLoading] = useState(false)

    // ── Search results & selection ──
    const [results, setResults] = useState(null)
    const [error, setError] = useState('')
    const [selectedStationId, setSelectedStationId] = useState(null)

    // ── Refs for latest values avoiding stale closures ──
    const latRef = useRef('')
    const lngRef = useRef('')
    const radiusRef = useRef('10')

    // ── Leaflet Map Refs ──
    const mapContainerRef = useRef(null)
    const mapInstanceRef = useRef(null)
    const userMarkerRef = useRef(null)
    const radiusCircleRef = useRef(null)
    const linesLayerRef = useRef(null)   // NEW: lines from user to stations
    const markersLayerRef = useRef(null)
    const stationMarkersMapRef = useRef(new Map())

    // ── Sync refs on input change ──
    function changeLat(v) { setLat(v); latRef.current = v }
    function changeLng(v) { setLng(v); lngRef.current = v }
    function changeRadius(v) { setRadius(v); radiusRef.current = v }

    // ── Initialize Leaflet Map ──
    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return

        const initialLat = 20.5937
        const initialLng = 78.9629
        const map = L.map(mapContainerRef.current, {
            center: [initialLat, initialLng],
            zoom: 5,
            zoomControl: true,
        })

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map)

        // Lines layer is added BEFORE the markers layer so lines sit under the markers
        const linesLayer = L.layerGroup().addTo(map)
        linesLayerRef.current = linesLayer

        const markersLayer = L.layerGroup().addTo(map)
        markersLayerRef.current = markersLayer
        mapInstanceRef.current = map

        // Invalidate map size after initial render to avoid tile blanking
        const timer = setTimeout(() => {
            map.invalidateSize()
        }, 200)

        // Handle container resize
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize()
        })
        resizeObserver.observe(mapContainerRef.current)

        return () => {
            clearTimeout(timer)
            resizeObserver.disconnect()
            map.remove()
            mapInstanceRef.current = null
            userMarkerRef.current = null
            radiusCircleRef.current = null
            linesLayerRef.current = null
            markersLayerRef.current = null
        }
    }, [])

    // ── Update Leaflet Map layers: user marker, circle, lines, station markers ──
    // fit = false keeps the current zoom (used when only the selection changes)
    const updateMapLayers = useCallback((userLat, userLng, radKm, stations, activeId, fit = true) => {
        const map = mapInstanceRef.current
        if (!map) return

        const hasUser =
            userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)

        // 1. User Location Marker
        if (hasUser) {
            if (userMarkerRef.current) {
                userMarkerRef.current.setLatLng([userLat, userLng])
            } else {
                userMarkerRef.current = L.marker([userLat, userLng], {
                    icon: userIcon,
                    zIndexOffset: 1000,
                }).addTo(map).bindPopup('<strong>Your Location</strong>')
            }

            // 2. Search Radius Circle
            if (radiusCircleRef.current) {
                map.removeLayer(radiusCircleRef.current)
                radiusCircleRef.current = null
            }
            if (radKm > 0) {
                radiusCircleRef.current = L.circle([userLat, userLng], {
                    radius: radKm * 1000, // convert km to meters
                    color: '#0b6b57',
                    fillColor: '#0b6b57',
                    fillOpacity: 0.08,
                    weight: 2,
                    dashArray: '6, 6',
                    interactive: false,
                }).addTo(map)

                if (fit) {
                    try {
                        map.fitBounds(radiusCircleRef.current.getBounds(), { padding: [24, 24], maxZoom: 15 })
                    } catch {
                        map.setView([userLat, userLng], 13)
                    }
                }
            }
        }

        // 3. Lines from the user to every station (selected one is highlighted)
        if (linesLayerRef.current) {
            linesLayerRef.current.clearLayers()

            if (hasUser && Array.isArray(stations)) {
                // Draw unselected first so the selected line ends up on top
                const ordered = [...stations].sort(
                    (a, b) => (a.stationId === activeId) - (b.stationId === activeId)
                )

                ordered.forEach(s => {
                    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return
                    const isSel = activeId === s.stationId

                    const line = L.polyline(
                        [[userLat, userLng], [s.lat, s.lng]],
                        {
                            color: isSel ? '#111827' : '#0b6b57',
                            weight: isSel ? 4 : 2,
                            opacity: isSel ? 0.95 : 0.6,
                            dashArray: isSel ? null : '6, 6',
                            interactive: false,
                        }
                    )

                    // Distance label in the middle of every line
                    if (Number.isFinite(s.distanceKm)) {
                        line.bindTooltip(`${s.distanceKm.toFixed(2)} km`, {
                            permanent: true,
                            direction: 'center',
                            className: isSel ? 'line-distance-label selected' : 'line-distance-label',
                            opacity: isSel ? 1 : 0.85,
                        })
                    }

                    line.addTo(linesLayerRef.current)
                })
            }
        }

        // 4. Station Markers
        if (markersLayerRef.current) {
            markersLayerRef.current.clearLayers()
            stationMarkersMapRef.current.clear()

            if (Array.isArray(stations)) {
                stations.forEach(s => {
                    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return

                    const isSelected = activeId === s.stationId
                    const marker = L.marker([s.lat, s.lng], {
                        icon: createStationIcon(s.isFull, isSelected),
                        zIndexOffset: isSelected ? 500 : 100,
                    })

                    const popupContent = `
            <div style="font-family: 'IBM Plex Sans', system-ui, sans-serif; min-width: 190px; padding: 2px;">
              <strong style="font-size: 14px; color: #14231f; display: block; margin-bottom: 4px;">${esc(s.name)}</strong>
              ${s.address ? `<div style="font-size: 12px; color: #5b6b66; margin-bottom: 4px;">📍 ${esc(s.address)}</div>` : ''}
              <div style="font-size: 12.5px; color: #14231f; margin-bottom: 3px;">
                <strong>Distance:</strong> ${Number.isFinite(s.distanceKm) ? s.distanceKm.toFixed(2) : '--'} km
              </div>
              <div style="font-size: 12.5px; color: #14231f; margin-bottom: 6px;">
                <strong>Chargers:</strong> ${s.freeChargers} of ${s.totalChargers} free
              </div>
              <span style="
                display: inline-block;
                padding: 2px 8px;
                border-radius: 99px;
                font-size: 11px;
                font-weight: 600;
                background: ${s.isFull ? '#fdecd2' : '#d9f0e8'};
                color: ${s.isFull ? '#a85a00' : '#0b6b57'};
              ">
                ${s.isFull ? 'Full' : 'Available'}
              </span>
            </div>
          `

                    marker.bindPopup(popupContent)
                    marker.on('click', () => {
                        setSelectedStationId(s.stationId)
                    })

                    marker.addTo(markersLayerRef.current)
                    stationMarkersMapRef.current.set(s.stationId, marker)

                    if (isSelected) {
                        marker.openPopup()
                    }
                })
            }
        }
    }, [])

    // ── Core search function (queries real backend API) ──
    const executeSearch = useCallback(async (latN, lngN, radN) => {
        setError('')
        setResults(null)
        setIsLoading(true)

        try {
            validate(latN, lngN)
            if (isNaN(radN) || radN <= 0) throw new RangeError('Radius must be greater than 0 km.')
        } catch (e) {
            setIsLoading(false)
            setError(
                e.message === 'Invalid coordinates'
                    ? 'Latitude must be between −90 and 90, and longitude between −180 and 180.'
                    : e.message
            )
            return
        }

        try {
            const response = await fetch(`/api/stations/nearby?lat=${encodeURIComponent(latN)}&lng=${encodeURIComponent(lngN)}&radius=${encodeURIComponent(radN)}`)
            if (response.ok) {
                const data = await response.json()
                console.log('API raw response:', data)

                // Accept { stations: [...] }, { data: [...] }, or a plain array
                const list = Array.isArray(data) ? data : (data.stations ?? data.data ?? [])

                const stations = list
                    .map(s => {
                        const sLat = Number(s.lat ?? s.latitude)
                        const sLng = Number(s.lng ?? s.lon ?? s.longitude)

                        // Use the server's distance if present, otherwise compute it here
                        let dist = Number(s.distanceKm ?? s.distance_km ?? s.distance)
                        if (!Number.isFinite(dist) && Number.isFinite(sLat) && Number.isFinite(sLng)) {
                            try { dist = haversineKm(latN, lngN, sLat, sLng) } catch { dist = NaN }
                        }

                        const free = Number(s.freeChargers ?? s.free_chargers ?? 0)
                        const total = Number(s.totalChargers ?? s.total_chargers ?? 0)

                        return {
                            stationId: s.stationId ?? s.id ?? s._id,
                            name: s.name,
                            distanceKm: dist,
                            lat: sLat,
                            lng: sLng,
                            address: s.address || '',
                            town: s.town || '',
                            freeChargers: free,
                            totalChargers: total,
                            isFull: s.isFull !== undefined ? Boolean(s.isFull) : free === 0,
                        }
                    })
                    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))

                console.log('mapped stations:', stations)

                setResults(stations)
                updateMapLayers(latN, lngN, radN, stations, selectedStationId)
            } else if (response.status === 400) {
                const errData = await response.json()
                setError(errData.error || 'Invalid search parameters')
            } else {
                setError(`Server returned error ${response.status}. Please ensure backend is running.`)
            }
        } catch (err) {
            console.error('Search failed:', err)
            setError('Unable to reach the backend station API. Please ensure the backend server is running on http://localhost:3000.')
            updateMapLayers(latN, lngN, radN, [], selectedStationId)
        } finally {
            setIsLoading(false)
        }
    }, [updateMapLayers, selectedStationId])

    function run() {
        const latN = parseFloat(latRef.current)
        const lngN = parseFloat(lngRef.current)
        const radN = parseFloat(radiusRef.current)
        executeSearch(latN, lngN, radN)
    }

    // ── Redraw lines/markers when the selection changes (keeps current zoom) ──
    useEffect(() => {
        if (!results) return
        updateMapLayers(
            parseFloat(latRef.current),
            parseFloat(lngRef.current),
            parseFloat(radiusRef.current),
            results,
            selectedStationId,
            false
        )
    }, [selectedStationId]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── "Use My Current Location" button handler ──
    const detectUserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setIsLocating(false)
            setLocStatusType('err')
            setLocFeedback('Geolocation is not supported by your browser. Please enter coordinates manually.')
            return
        }

        setIsLocating(true)
        setLocStatusType('')
        setLocFeedback('Detecting your GPS location...')

        navigator.geolocation.getCurrentPosition(
            pos => {
                setIsLocating(false)
                const nLat = pos.coords.latitude.toFixed(6)
                const nLng = pos.coords.longitude.toFixed(6)
                setLat(nLat); latRef.current = nLat
                setLng(nLng); lngRef.current = nLng
                setLocStatusType('ok')
                setLocFeedback(`Location detected: ${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°.`)
                executeSearch(parseFloat(nLat), parseFloat(nLng), parseFloat(radiusRef.current))
            },
            err => {
                setIsLocating(false)
                setLocStatusType('err')
                let msg = ''
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        msg = 'Location permission denied. Please allow location access in your browser or enter coordinates manually.'
                        break
                    case err.POSITION_UNAVAILABLE:
                        msg = 'Location information is unavailable. Please enter coordinates manually.'
                        break
                    case err.TIMEOUT:
                        msg = 'Location request timed out. Please try again or enter coordinates manually.'
                        break
                    default:
                        msg = `Unable to retrieve location (${err.message || 'error'}). Please enter coordinates manually.`
                        break
                }
                setLocFeedback(msg)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }, [executeSearch])

    // ── Always detect live user location on initial load ──
    useEffect(() => {
        const timer = setTimeout(() => detectUserLocation(), 0)
        return () => clearTimeout(timer)
    }, [detectUserLocation])

    // ── Preset selection ──
    function applyPreset(p) {
        const latStr = String(p.lat)
        const lngStr = String(p.lng)
        const radStr = '10'
        setLat(latStr); latRef.current = latStr
        setLng(lngStr); lngRef.current = lngStr
        setRadius(radStr); radiusRef.current = radStr
        setLocFeedback(`Selected preset: ${p.label}`)
        setLocStatusType('ok')
        executeSearch(p.lat, p.lng, 10)
    }

    // ── Widen radius ──
    function widenRadius() {
        const r = String(parseFloat(radiusRef.current) * 2)
        setRadius(r)
        radiusRef.current = r
        run()
    }

    // ── Station row click: highlights marker & line, centers map ──
    function handleSelectStation(s) {
        setSelectedStationId(s.stationId)
        const map = mapInstanceRef.current
        if (map && Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
            map.setView([s.lat, s.lng], Math.max(map.getZoom(), 14), { animate: true })
            // The marker is re-created by the selection effect, so open its popup after that runs
            setTimeout(() => {
                const marker = stationMarkersMapRef.current.get(s.stationId)
                if (marker) marker.openPopup()
            }, 0)
        }
    }

    // ── Enter key ──
    function handleKeyDown(e) {
        if (e.key === 'Enter') run()
    }

    return (
        <div className={styles.page}>
            {/* Style for the distance labels shown on the lines */}
            <style>{`
        .line-distance-label {
          background: #ffffff;
          border: 1px solid #0b6b57;
          border-radius: 99px;
          color: #0b6b57;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 7px;
          box-shadow: none;
        }
        .line-distance-label.selected {
          background: #111827;
          border-color: #111827;
          color: #ffffff;
          font-size: 12px;
        }
        .line-distance-label::before { display: none; }
      `}</style>

            <main className={styles.main}>
                <h1 className={styles.h1}>Nearby stations (E2, Routing &amp; Discovery)</h1>
                <p className={styles.sub}>
                    Interactive Leaflet map showing charging stations within the search radius from your live database.
                    Available and full stations are clearly distinguished; clicking a station highlights it on the map and in the results table.
                </p>

                <div className={styles.grid}>
                    {/* ── Left column: Search panel & checks ── */}
                    <div className={styles.stack}>

                        {/* Search panel */}
                        <div className={styles.panel}>
                            <h2 className={styles.h2}>Search</h2>

                            {/* Use My Current Location Button */}
                            <button
                                type="button"
                                id="btn-location"
                                className={styles.locationBtn}
                                onClick={detectUserLocation}
                                disabled={isLocating}
                            >
                                {isLocating ? 'Detecting Location...' : 'Use My Current Location'}
                            </button>

                            {locFeedback && (
                                <div
                                    className={`${styles.locFeedback} ${locStatusType === 'ok' ? styles.locFeedbackOk : ''} ${locStatusType === 'err' ? styles.locFeedbackErr : ''}`}
                                    role="status"
                                    aria-live="polite"
                                >
                                    {locFeedback}
                                </div>
                            )}

                            <label htmlFor="lat" className={styles.label}>Latitude</label>
                            <input
                                id="lat"
                                inputMode="decimal"
                                className={styles.input}
                                value={lat}
                                placeholder="Detecting..."
                                onChange={e => changeLat(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />

                            <label htmlFor="lng" className={styles.label}>Longitude</label>
                            <input
                                id="lng"
                                inputMode="decimal"
                                className={styles.input}
                                value={lng}
                                placeholder="Detecting..."
                                onChange={e => changeLng(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />

                            <label htmlFor="rad" className={styles.label}>Radius (km)</label>
                            <input
                                id="rad"
                                inputMode="decimal"
                                className={styles.input}
                                value={radius}
                                onChange={e => changeRadius(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />

                            <div className={styles.presets} aria-label="Preset locations">
                                {PRESETS.map(p => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        className={styles.presetBtn}
                                        onClick={() => applyPreset(p)}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                className={`primary ${styles.findBtn}`}
                                id="btn-find-stations"
                                type="button"
                                onClick={run}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Searching...' : 'Find stations'}
                            </button>

                            {isLoading && (
                                <div className={styles.loadingSpinner}>
                                    ⚡ Searching nearby stations in database...
                                </div>
                            )}

                            {/* Status / error */}
                            <div role="status" aria-live="polite">
                                {error && (
                                    <div className={`${styles.msg} ${styles.msgErr}`}>{error}</div>
                                )}
                                {!error && !isLoading && results !== null && results.length === 0 && (
                                    <div className={`${styles.msg} ${styles.msgEmpty}`}>
                                        No stations found within {radius} km.
                                        <button
                                            type="button"
                                            id="btn-widen-radius"
                                            className={styles.widenBtn}
                                            onClick={widenRadius}
                                        >
                                            Widen radius to {parseFloat(radius) * 2} km
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Self-checks panel */}
                        <div className={styles.panel}>
                            <h2 className={styles.h2}>Self-checks</h2>
                            <ul className={styles.checks}>
                                {CHECKS_RESULTS.map(({ label, ok }) => (
                                    <li key={label}>
                                        <span className={ok ? styles.pass : styles.fail}>
                                            {ok ? 'Pass' : 'Fail'}
                                        </span>{' '}
                                        {label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* ── Right column: Leaflet Map & Results table ── */}
                    <div className={styles.stack}>

                        {/* Leaflet Map panel */}
                        <div className={styles.panel}>
                            <h2 className={styles.h2}>Interactive Map (OpenStreetMap)</h2>
                            <div className={styles.mapWrapper}>
                                <div ref={mapContainerRef} className={styles.mapContainer} id="leaflet-map" />
                                <div className={styles.mapLegend}>
                                    <span className={styles.legendItem}>
                                        <span className={`${styles.legendDot} ${styles.legendDotUser}`} /> Your Location
                                    </span>
                                    <span className={styles.legendItem}>
                                        <span className={`${styles.legendDot} ${styles.legendDotAvailable}`} /> Available Station
                                    </span>
                                    <span className={styles.legendItem}>
                                        <span className={`${styles.legendDot} ${styles.legendDotFull}`} /> Full Station
                                    </span>
                                </div>
                            </div>
                            <p className={styles.note}>
                                Click any station marker or table row to inspect details and center the map.
                                Lines show the straight-line distance from your location to each station.
                            </p>
                        </div>

                        {/* Results table panel */}
                        <div className={styles.panel}>
                            <h2 className={styles.h2}>Results, nearest first</h2>
                            <div className={styles.tablewrap}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th className={styles.th}>#</th>
                                            <th className={styles.th}>Station</th>
                                            <th className={styles.th}>Distance</th>
                                            <th className={styles.th}>Free chargers</th>
                                            <th className={styles.th}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results && results.map((s, i) => {
                                            const isSelected = selectedStationId === s.stationId
                                            return (
                                                <tr
                                                    key={s.stationId ?? s.name ?? i}
                                                    className={`${styles.clickableRow} ${isSelected ? styles.rowSelected : ''}`}
                                                    onClick={() => handleSelectStation(s)}
                                                    title="Click to highlight this station on the map"
                                                >
                                                    <td className={`${styles.td} ${styles.mono}`}>{i + 1}</td>
                                                    <td className={styles.td}>
                                                        <strong>{s.name}</strong>
                                                        {s.address && (
                                                            <div style={{ fontSize: '12px', color: 'var(--mute)' }}>{s.address}</div>
                                                        )}
                                                    </td>
                                                    <td className={`${styles.td} ${styles.mono}`}>
                                                        {Number.isFinite(s.distanceKm) ? s.distanceKm.toFixed(2) : '--'} km
                                                    </td>
                                                    <td className={`${styles.td} ${styles.mono}`}>
                                                        {s.freeChargers} of {s.totalChargers}
                                                    </td>
                                                    <td className={styles.td}>
                                                        <span className={`${styles.badge} ${s.isFull ? styles.badgeFull : styles.badgeOk}`}>
                                                            {s.isFull ? 'Full' : 'Available'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}