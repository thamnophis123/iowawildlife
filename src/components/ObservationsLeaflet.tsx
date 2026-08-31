"use client";

import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import type { MapObservation } from "@/lib/observations";
import { IOWA_CENTER } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

type ObservationsLeafletProps = {
  observations: MapObservation[];
};

function pinIcon() {
  return L.divIcon({
    className: "iowa-wildlife-pin",
    html: '<span class="iowa-wildlife-pin-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

export default function ObservationsLeaflet({
  observations,
}: ObservationsLeafletProps) {
  const icon = useMemo(() => pinIcon(), []);

  return (
    <div className="h-[min(70vh,36rem)] w-full">
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
        {observations.map((observation) => (
          <Marker
            key={observation.id}
            icon={icon}
            position={[observation.lat, observation.lng]}
          >
            <Popup>
              <div className="max-w-56 space-y-2 font-sans text-sm text-stone-700">
                {observation.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={observation.photoUrl}
                    alt={observation.category ?? "Sighting"}
                    className="max-h-40 w-full rounded object-cover"
                  />
                ) : null}
                {observation.category ? (
                  <p className="font-medium capitalize text-[#1b4332]">
                    {observation.category}
                  </p>
                ) : null}
                {observation.notes ? <p>{observation.notes}</p> : null}
                {observation.createdAtLabel ? (
                  <p className="text-stone-500">{observation.createdAtLabel}</p>
                ) : null}
                <a
                  href={`/sighting/${observation.id}`}
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
