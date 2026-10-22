export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Loose Tehran bounding box; anything outside is treated as invalid coords.
export function validTehranCoord(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return typeof lat === "number" && typeof lon === "number" && lat > 35.4 && lat < 36.0 && lon > 50.9 && lon < 51.9;
}

export function mapLinks(lat: number, lon: number) {
  return {
    neshan: `https://neshan.org/maps/@${lat},${lon},17z,0p`,
    balad: `https://balad.ir/location?latitude=${lat}&longitude=${lon}&zoom=17`,
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  };
}
