import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332]">
        Contact
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
        Questions, corrections, or ideas for Iowa Wildlife. Leave an email if
        you want a reply.
      </p>
      <ContactForm />
    </main>
  );
}
