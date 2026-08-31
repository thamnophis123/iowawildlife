import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSpeciesOptions } from "@/lib/species";
import UploadForm from "./UploadForm";

export const metadata: Metadata = {
  title: "Upload a sighting",
};

export default async function UploadPage() {
  const [user, speciesOptions] = await Promise.all([
    getCurrentUser(),
    getSpeciesOptions(),
  ]);

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
          Upload a sighting
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
          Sign in to upload.
        </p>
        <p className="mt-6">
          <Link
            href="/signin"
            className="font-medium text-[#2d6a4f] underline decoration-[#d8e3d4] underline-offset-4 hover:text-[#1b4332]"
          >
            Sign in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Upload a sighting
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Add a photo and drop a pin where you found it.
      </p>
      <UploadForm speciesOptions={speciesOptions} />
    </main>
  );
}
