import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Upload a sighting",
};

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Upload a sighting
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Photos and location will go here.
      </p>
    </main>
  );
}
