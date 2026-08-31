import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SpeciesSightingsMap from "@/components/SpeciesSightingsMap";
import { categoryLabel } from "@/lib/categories";
import { getSpeciesBySlug } from "@/lib/species";
import { titleCaseCommonName } from "@/lib/species-names";

type SpeciesPageProps = {
  params: Promise<{ slug: string }>;
};

function SpeciesField({
  heading,
  text,
}: {
  heading: string;
  text: string | null;
}) {
  if (!text) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight text-[#1b4332]">
        {heading}
      </h2>
      <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-stone-600">
        {text}
      </p>
    </section>
  );
}

function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.replace(/^www\./, "") === "inaturalist.org") {
      return "iNaturalist";
    }
    return parsed.hostname.replace(/^www\./, "") || url;
  } catch {
    return url;
  }
}

function speciesSourceLinks(
  sourceUrls: string[],
  inatTaxonId: number | null,
) {
  const links = [...sourceUrls];
  if (inatTaxonId != null) {
    const inatUrl = `https://www.inaturalist.org/taxa/${inatTaxonId}`;
    const alreadyListed = links.some((url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.hostname.replace(/^www\./, "") === "inaturalist.org" &&
          parsed.pathname.replace(/\/$/, "") === `/taxa/${inatTaxonId}`
        );
      } catch {
        return url === inatUrl;
      }
    });
    if (!alreadyListed) {
      links.push(inatUrl);
    }
  }
  return links;
}

export async function generateMetadata({
  params,
}: SpeciesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { species } = await getSpeciesBySlug(slug);

  if (!species) {
    return { title: "Species" };
  }

  return { title: titleCaseCommonName(species.commonName) };
}

export default async function SpeciesPage({ params }: SpeciesPageProps) {
  const { slug } = await params;
  const { species, error } = await getSpeciesBySlug(slug);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
          Species
        </h1>
        <p className="mt-4 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!species) {
    notFound();
  }

  const commonName = titleCaseCommonName(species.commonName);
  const category = categoryLabel(species.category) || species.category;
  const sourceLinks = speciesSourceLinks(
    species.sourceUrls,
    species.inatTaxonId,
  );
  const mapPins = species.sightings.flatMap((sighting) => {
    if (sighting.lat == null || sighting.lng == null) {
      return [];
    }

    return [
      {
        id: sighting.id,
        lat: sighting.lat,
        lng: sighting.lng,
        createdAtLabel: sighting.createdAtLabel,
      },
    ];
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <p className="text-sm">
        <Link
          href="/map"
          className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
        >
          Back to map
        </Link>
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1b4332]">
        {commonName}
      </h1>
      {species.scientificName ? (
        <p className="mt-2 text-lg italic text-stone-600">
          {species.scientificName}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-stone-500">
        {category}
        {species.status ? ` · ${species.status}` : ""}
      </p>
      {species.isSensitive ? (
        <p className="mt-4 rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-4 text-sm text-[#1b4332]">
          This species is sensitive.
        </p>
      ) : null}

      <SpeciesField heading="Summary" text={species.shortSummary} />
      <SpeciesField heading="Identification tips" text={species.idTips} />
      <SpeciesField heading="Habitat" text={species.habitat} />
      <SpeciesField heading="Similar species" text={species.similarSpecies} />

      {sourceLinks.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight text-[#1b4332]">
            Sources
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {sourceLinks.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
                  rel="noreferrer"
                  target="_blank"
                >
                  {sourceLabel(url)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          Sightings on Iowa Wildlife
        </h2>
        {species.sightings.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No sightings have been linked to this species yet.
          </p>
        ) : (
          <>
            {mapPins.length > 0 ? (
              <div className="mt-6">
                <SpeciesSightingsMap pins={mapPins} />
              </div>
            ) : null}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {species.sightings.map((sighting) => (
                <li key={sighting.id}>
                  <Link
                    href={`/sighting/${sighting.id}`}
                    className="block overflow-hidden rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] hover:border-[#2d6a4f]"
                  >
                    {sighting.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sighting.photoUrl}
                        alt={
                          categoryLabel(sighting.category) || commonName
                        }
                        className="h-52 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center text-sm text-stone-500">
                        No photo
                      </div>
                    )}
                    <p className="px-4 py-3 text-sm text-stone-600">
                      {sighting.createdAtLabel ?? "Sighting"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="mt-12 text-sm text-stone-500">
        Species text is a short compilation for this site, not an official DNR
        page.
      </p>
    </main>
  );
}
