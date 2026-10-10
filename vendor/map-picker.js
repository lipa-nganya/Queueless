const LEAFLET_VERSION = "1.9.4";
const NAIROBI = [-1.286389, 36.817223];

let leafletPromise = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      document.head.appendChild(css);

      const script = document.createElement("script");
      script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
      script.async = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error("Could not load the map."));
      };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

function validCoords(latitude, longitude) {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  );
}

/**
 * OpenStreetMap picker with one draggable pin. Dropping the pin (drag or tap)
 * reports the exact pin coordinates plus a reverse-geocoded label.
 */
export async function mountMapPicker(container, { fetchJson, onPick, initial = null }) {
  const L = await loadLeaflet();
  const hasInitial = validCoords(initial?.latitude, initial?.longitude);
  const start = hasInitial ? [Number(initial.latitude), Number(initial.longitude)] : NAIROBI;

  const map = L.map(container, { scrollWheelZoom: false }).setView(start, hasInitial ? 16 : 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const icon = L.divIcon({
    className: "map-pin",
    html: `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z" fill="#a6e600" stroke="#0a0f1a" stroke-width="1.6"/><circle cx="12" cy="10" r="2.6" fill="#0a0f1a"/></svg>`,
    iconSize: [36, 36],
    iconAnchor: [18, 34],
  });
  const marker = L.marker(start, {
    draggable: true,
    icon,
    title: "Branch pin. Drag it to the exact entrance.",
    alt: "Branch pin",
  }).addTo(map);

  let reverseId = 0;
  async function pick(latlng) {
    marker.setLatLng(latlng);
    const latitude = Number(latlng.lat.toFixed(6));
    const longitude = Number(latlng.lng.toFixed(6));
    const id = ++reverseId;
    let label = "";
    try {
      const place = await fetchJson(
        `/places/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
      );
      label = place?.label || "";
    } catch {
      // The pin is still valid without a readable address.
    }
    if (id !== reverseId) return;
    onPick?.({ latitude, longitude, label });
  }

  marker.on("dragend", () => pick(marker.getLatLng()));
  map.on("click", (event) => pick(event.latlng));

  return {
    setPosition(latitude, longitude, { zoom = 16 } = {}) {
      if (!validCoords(latitude, longitude)) return;
      const point = [Number(latitude), Number(longitude)];
      marker.setLatLng(point);
      map.setView(point, Math.max(map.getZoom(), zoom));
    },
    refresh() {
      map.invalidateSize();
    },
    destroy() {
      map.remove();
    },
  };
}
