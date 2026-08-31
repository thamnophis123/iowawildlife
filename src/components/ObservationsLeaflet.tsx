"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapObservation } from "@/lib/observations";
import { categoryLabel } from "@/lib/categories";
import { titleCaseCommonName } from "@/lib/species-names";
import { IOWA_CENTER } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

type SelectionSource = "list" | "map";

type ObservationsLeafletProps = {
  observations: MapObservation[];
  selectedId: string | null;
  selectionSource: SelectionSource | null;
  onSelectFromMap: (id: string) => void;
};

function pinIcon(selected: boolean) {
  return L.divIcon({
    className: "iowa-wildlife-pin",
    html: selected
      ? '<span class="iowa-wildlife-pin-dot iowa-wildlife-pin-dot-selected"></span>'
      : '<span class="iowa-wildlife-pin-dot"></span>',
    iconSize: selected ? [26, 26] : [22, 22],
    iconAnchor: selected ? [13, 26] : [11, 22],
  });
}

function FocusSelection({
  observations,
  selectedId,
  selectionSource,
  markers,
}: {
  observations: MapObservation[];
  selectedId: string | null;
  selectionSource: SelectionSource | null;
  markers: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId || selectionSource !== "list") {
      return;
    }

    const observation = observations.find((item) => item.id === selectedId);
    if (!observation) {
      return;
    }

    map.flyTo(
      [observation.lat, observation.lng],
      Math.max(map.getZoom(), 12),
      { duration: 0.55 },
    );

    const frame = window.requestAnimationFrame(() => {
      markers.current.get(selectedId)?.openPopup();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [map, markers, observations, selectedId, selectionSource]);

  return null;
}

export default function ObservationsLeaflet({
  observations,
  selectedId,
  selectionSource,
  onSelectFromMap,
}: ObservationsLeafletProps) {
  const markers = useRef(new Map<string, L.Marker>());
  const defaultIcon = useMemo(() => pinIcon(false), []);
  const selectedIcon = useMemo(() => pinIcon(true), []);

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
        <FocusSelection
          observations={observations}
          selectedId={selectedId}
          selectionSource={selectionSource}
          markers={markers}
        />
        {observations.map((observation) => {
          const selected = observation.id === selectedId;
          return (
            <Marker
              key={observation.id}
              icon={selected ? selectedIcon : defaultIcon}
              position={[observation.lat, observation.lng]}
              zIndexOffset={selected ? 1000 : 0}
              ref={(instance) => {
                if (instance) {
                  markers.current.set(observation.id, instance);
                } else {
                  markers.current.delete(observation.id);
                }
              }}
              eventHandlers={{
                click: () => onSelectFromMap(observation.id),
              }}
            >
              <Popup>
                <div className="max-w-56 space-y-2 font-sans text-sm text-stone-700">
                  {observation.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={observation.photoUrl}
                      alt={
                        observation.speciesCommonName ||
                        categoryLabel(observation.category) ||
                        "Sighting"
                      }
                      className="max-h-40 w-full rounded object-cover"
                    />
                  ) : null}
                  {observation.speciesCommonName ? (
                    <p className="font-medium text-[#1b4332]">
                      {titleCaseCommonName(observation.speciesCommonName)}
                    </p>
                  ) : observation.category ? (
                    <p className="font-medium text-[#1b4332]">
                      {categoryLabel(observation.category)}
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
          );
        })}
      </MapContainer>
    </div>
  );
}
