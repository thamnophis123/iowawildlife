import type { Metadata } from "next";
import SignInForm from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Sign in
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Sign in or create an account to upload a sighting.
      </p>
      <SignInForm />
    </main>
  );
}
