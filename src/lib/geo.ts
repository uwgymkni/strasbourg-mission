/**
 * Geo helpers — pure functions, no state, no I/O.
 *
 * Used for displaying distance and walking-time estimates between stations
 * on the mission page. Inputs are decimal lat/lng pairs in degrees.
 */

interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Great-circle distance between two lat/lng points in metres (Haversine).
 * Earth radius approximated as 6 371 000 m — accurate to < 0.5 % for short legs.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δφ = toRad(b.latitude - a.latitude);
  const Δλ = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Walking-time estimate for a class of school students.
 * 80 m/min ≈ 4.8 km/h — comfortable group pace in an unfamiliar city.
 * Always returns at least 1 (so very short legs don't read "0 min").
 */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

/**
 * Human-friendly distance string for German UI.
 *   < 1000 m → "350 m" (rounded to nearest 10 m)
 *   ≥ 1000 m → "1,2 km" (German decimal comma, 1 fractional digit)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    const rounded = Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = (meters / 1000).toFixed(1).replace(".", ",");
  return `${km} km`;
}
