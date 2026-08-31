import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommentForm from "./CommentForm";
import { getSighting } from "@/lib/observations";
import { categoryLabel } from "@/lib/categories";
import { getCurrentUser } from "@/lib/supabase/server";

type SightingPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: SightingPageProps): Promise<Metadata> {
  const { id } = await params;
  const { sighting } = await getSighting(id);

  if (!sighting) {
    return { title: "Sighting" };
  }

  return {
    title: sighting.category
      ? `${categoryLabel(sighting.category)} sighting`
      : "Sighting",
  };
}

export default async function SightingPage({ params }: SightingPageProps) {
  const { id } = await params;
  const [{ sighting, error }, user] = await Promise.all([
    getSighting(id),
    getCurrentUser(),
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
        {categoryLabel(sighting.category) || "Sighting"}
      </h1>
      <p className="mt-2 text-sm text-stone-500">
        {sighting.observerName}
        {sighting.createdAtLabel ? ` · ${sighting.createdAtLabel}` : ""}
      </p>
      {sighting.speciesSlug && sighting.speciesCommonName ? (
        <p className="mt-3 text-sm">
          <Link
            href={`/species/${sighting.speciesSlug}`}
            className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
          >
            {sighting.speciesCommonName}
          </Link>
        </p>
      ) : null}

      {sighting.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sighting.photoUrl}
          alt={categoryLabel(sighting.category) || "Sighting"}
          className="mt-8 w-full rounded-xl border border-[#d8e3d4] object-cover"
        />
      ) : null}

      {sighting.notes ? (
        <p className="mt-6 text-base leading-7 text-stone-600">{sighting.notes}</p>
      ) : null}

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
