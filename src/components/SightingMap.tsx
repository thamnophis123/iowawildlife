"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { IOWA_CENTER, type LatLng } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

type SightingMapProps = {
  position: LatLng | null;
  focusPosition: LatLng | null;
  onUserSetPosition: (position: LatLng) => void;
};

function pinIcon() {
  return L.divIcon({
    className: "iowa-wildlife-pin",
    html: '<span class="iowa-wildlife-pin-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

function MapClick({ onUserSetPosition }: { onUserSetPosition: (position: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onUserSetPosition({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function Recenter({ focusPosition }: { focusPosition: LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (focusPosition) {
      map.flyTo([focusPosition.lat, focusPosition.lng], Math.max(map.getZoom(), 12), {
        duration: 0.6,
      });
    }
  }, [map, focusPosition]);

  return null;
}

export default function SightingMap({
  position,
  focusPosition,
  onUserSetPosition,
}: SightingMapProps) {
  const icon = useMemo(() => pinIcon(), []);

  return (
    <div className="h-72 w-full">
      <MapContainer
        center={[IOWA_CENTER.lat, IOWA_CENTER.lng]}
        zoom={7}
        scrollWheelZoom
        className="h-full w-full"
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClick onUserSetPosition={onUserSetPosition} />
      <Recenter focusPosition={focusPosition} />
      {position ? (
        <Marker
          draggable
          icon={icon}
          position={[position.lat, position.lng]}
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onUserSetPosition({ lat, lng });
            },
          }}
        />
      ) : null}
    </MapContainer>
    </div>
  );
}
