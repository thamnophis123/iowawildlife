"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CommentFormProps = {
  observationId: string;
};

export default function CommentForm({ observationId }: CommentFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    setError(null);

    if (!text) {
      setError("Write a comment first.");
      return;
    }

    setPending(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Sign in to comment.");
        return;
      }

      const { error: insertError } = await supabase.from("comments").insert({
        observation_id: observationId,
        user_id: user.id,
        body: text,
      });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      setBody("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save this comment.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-[#1b4332]">
        Add a comment
        <textarea
          className="mt-1 min-h-24 w-full rounded-lg border border-[#d8e3d4] bg-white px-3 py-2 text-stone-800 outline-none focus:border-[#2d6a4f]"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1b4332] px-4 py-2 text-sm font-medium text-[#fbfaf6] hover:bg-[#163828] disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
