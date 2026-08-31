"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const fieldClassName =
  "mt-1 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]";

export default function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function authenticate(form: HTMLFormElement, mode: "signin" | "signup") {
    setError(null);
    setMessage(null);
    setPending(true);

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setPending(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/upload");
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/upload`,
      },
    });

    setPending(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setMessage("Check your email to confirm your account.");
      return;
    }

    router.push("/upload");
    router.refresh();
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void authenticate(event.currentTarget, "signin");
      }}
    >
      <label className="block text-sm font-medium text-[#1b4332]">
        Email
        <input
          className={fieldClassName}
          type="email"
          name="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block text-sm font-medium text-[#1b4332]">
        Password
        <input
          className={fieldClassName}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          minLength={6}
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-[#2d6a4f]">{message}</p> : null}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-medium text-[#fbfaf6] hover:bg-[#163828] disabled:opacity-60"
        >
          Sign in
        </button>
        <button
          type="submit"
          formNoValidate
          disabled={pending}
          className="rounded-lg border border-[#d8e3d4] bg-[#fbfaf6] px-4 py-2 text-sm font-medium text-[#1b4332] hover:border-[#2d6a4f] disabled:opacity-60"
          onClick={(event) => {
            event.preventDefault();
            const form = event.currentTarget.form;
            if (form?.reportValidity()) {
              void authenticate(form, "signup");
            }
          }}
        >
          Create account
        </button>
      </div>
    </form>
  );
}
