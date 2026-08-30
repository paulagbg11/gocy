/**
 * Mapa atenuado para que la línea del recorrido sea la protagonista, al estilo
 * de los mapas de Strava: se rebajan los puntos de interés y el color de las
 * carreteras, y se mantienen parques y agua como referencia suave.
 */
export const MUTED_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7d8a90" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "poi", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e2ece1" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f4f5f3" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f0eee9" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe0ea" }] },
];
