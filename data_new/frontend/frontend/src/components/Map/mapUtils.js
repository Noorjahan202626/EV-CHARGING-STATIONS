// src/components/Map/mapUtils.js
export function haversineKm(from, to) {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const [lat1, lon1] = from.map(toRad);
    const [lat2, lon2] = to.map(toRad);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const R = 6371; // Earth radius in kilometres
    return R * c;
}

/**
 * Simple formatter for UI display.
 * @param {number} km
 * @returns {string}
 */
export function fmtDistance(km) {
    if (km < 1) return `${(km * 1000).toFixed(0)} m`;
    return `${km.toFixed(2)} km`;
}