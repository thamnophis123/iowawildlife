"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { IOWA_CENTER } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

export type SpeciesMapPin = {
  id: string;
  lat: number;
  lng: number;
  createdAtLabel: string | null;
};

type SpeciesLeafletProps = {
  pins: SpeciesMapPin[];
};

function pinIcon() {
  return L.divIcon({
    className: "iowa-wildlife-pin",
    html: '<span class="iowa-wildlife-pin-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

export default function SpeciesLeaflet({ pins }: SpeciesLeafletProps) {
  const icon = useMemo(() => pinIcon(), []);

  return (
    <div className="h-64 w-full">
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
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            icon={icon}
            position={[pin.lat, pin.lng]}
          >
            <Popup>
              <div className="max-w-48 space-y-2 font-sans text-sm text-stone-700">
                {pin.createdAtLabel ? (
                  <p className="text-stone-500">{pin.createdAtLabel}</p>
                ) : null}
                <a
                  href={`/sighting/${pin.id}`}
                  className="inline-block font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4"
                >
                  View sighting
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
