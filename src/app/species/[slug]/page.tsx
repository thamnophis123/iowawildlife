import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/categories";
import { getSpeciesBySlug } from "@/lib/species";

type SpeciesPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: SpeciesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { species } = await getSpeciesBySlug(slug);

  if (!species) {
    return { title: "Species" };
  }

  return { title: species.commonName };
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
        {species.commonName}
      </h1>
      {species.scientificName ? (
        <p className="mt-2 text-lg italic text-stone-600">
          {species.scientificName}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-stone-500">
        {categoryLabel(species.category) || species.category}
      </p>
      {species.isSensitive ? (
        <p className="mt-4 rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-4 text-sm text-[#1b4332]">
          This species is sensitive.
        </p>
      ) : null}
      {species.shortSummary ? (
        <p className="mt-6 text-base leading-7 text-stone-600">
          {species.shortSummary}
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          Recent sightings
        </h2>
        {species.sightings.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No sightings have been linked to this species yet.
          </p>
        ) : (
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
                        categoryLabel(sighting.category) || species.commonName
                      }
                      className="h-36 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center text-sm text-stone-500">
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
        )}
      </section>
    </main>
  );
}
