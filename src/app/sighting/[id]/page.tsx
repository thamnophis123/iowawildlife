import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentForm from "./CommentForm";
import IdentificationForm from "./IdentificationForm";
import { getSighting, type SightingSpecies } from "@/lib/observations";
import { categoryLabel } from "@/lib/categories";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSpeciesOptions } from "@/lib/species";
import { titleCaseCommonName } from "@/lib/species-names";

type SightingPageProps = {
  params: Promise<{ id: string }>;
};

function SpeciesLine({ species }: { species: SightingSpecies }) {
  const name = titleCaseCommonName(species.commonName);
  const label = (
    <>
      {name}
      {species.scientificName ? (
        <span className="italic text-stone-500"> {species.scientificName}</span>
      ) : null}
    </>
  );

  if (!species.slug) {
    return <span>{label}</span>;
  }

  return (
    <Link
      href={`/species/${species.slug}`}
      className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
    >
      {label}
    </Link>
  );
}

export async function generateMetadata({
  params,
}: SightingPageProps): Promise<Metadata> {
  const { id } = await params;
  const { sighting } = await getSighting(id);

  if (!sighting) {
    return { title: "Sighting" };
  }

  return {
    title: sighting.displayedSpecies
      ? titleCaseCommonName(sighting.displayedSpecies.commonName)
      : sighting.category
        ? `${categoryLabel(sighting.category)} sighting`
        : "Sighting",
  };
}

export default async function SightingPage({ params }: SightingPageProps) {
  const { id } = await params;
  const [{ sighting, error }, user, speciesOptions] = await Promise.all([
    getSighting(id),
    getCurrentUser(),
    getSpeciesOptions(),
  ]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
          Sighting
        </h1>
        <p className="mt-4 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!sighting) {
    notFound();
  }

  const heading = sighting.displayedSpecies
    ? titleCaseCommonName(sighting.displayedSpecies.commonName)
    : categoryLabel(sighting.category) || "Sighting";

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
        {heading}
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        {sighting.observerName}
        {sighting.createdAtLabel ? ` · ${sighting.createdAtLabel}` : ""}
      </p>

      {sighting.outOfStateOverride ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Posted with an out-of-state location override.
        </p>
      ) : null}

      {sighting.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sighting.photoUrl}
          alt={heading}
          className="mt-8 w-full rounded-xl border border-[#d8e3d4] object-cover"
        />
      ) : null}

      {sighting.notes ? (
        <p className="mt-6 text-base leading-7 text-stone-600">{sighting.notes}</p>
      ) : null}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          Displayed ID
        </h2>
        <p className="mt-4 text-base text-stone-700">
          {sighting.displayedSpecies ? (
            <SpeciesLine species={sighting.displayedSpecies} />
          ) : (
            "Not identified."
          )}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          AI guess
        </h2>
        {sighting.suggestedName ? (
          <>
            <p className="mt-4 text-base text-stone-700">
              {sighting.suggestedName}
            </p>
            <p className="mt-1 text-sm text-stone-500">Not confirmed.</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No AI guess.</p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          Identifications
        </h2>
        {sighting.identifications.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No community identifications yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {sighting.identifications.map((identification) => (
              <li
                key={identification.id}
                className="rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-4"
              >
                <p className="text-sm font-medium text-[#1b4332]">
                  {identification.authorName}
                </p>
                <p className="mt-1 text-sm text-stone-700">
                  <SpeciesLine
                    species={{
                      id: identification.speciesId,
                      commonName: identification.commonName,
                      scientificName: identification.scientificName,
                      slug: identification.slug,
                    }}
                  />
                </p>
                {identification.note ? (
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {identification.note}
                  </p>
                ) : null}
                {identification.createdAtLabel ? (
                  <p className="mt-2 text-xs text-stone-500">
                    {identification.createdAtLabel}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {user ? (
          <IdentificationForm
            observationId={sighting.id}
            speciesOptions={speciesOptions}
          />
        ) : (
          <p className="mt-6 text-sm text-stone-600">
            <Link
              href="/signin"
              className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
            >
              Sign in
            </Link>{" "}
            to add an identification.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-[#1b4332]">
          Comments
        </h2>
        {sighting.comments.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No comments yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {sighting.comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-4"
              >
                <p className="text-sm font-medium text-[#1b4332]">
                  {comment.authorName}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-700">
                  {comment.body}
                </p>
                {comment.createdAtLabel ? (
                  <p className="mt-2 text-xs text-stone-500">
                    {comment.createdAtLabel}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {user ? (
          <CommentForm observationId={sighting.id} />
        ) : (
          <p className="mt-6 text-sm text-stone-600">
            <Link
              href="/signin"
              className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
            >
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
      </section>
    </main>
  );
}
