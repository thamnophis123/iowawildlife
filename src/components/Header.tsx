import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
  { href: "/species", label: "Species" },
  { href: "/upload", label: "Upload" },
  { href: "/contact", label: "Contact" },
] as const;

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-[#d8e3d4] bg-[#fbfaf6]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[#1b4332]"
        >
          Iowa Wildlife
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[#2d6a4f] hover:text-[#1b4332]"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[#2d6a4f] hover:text-[#1b4332]"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/signin" className="text-[#2d6a4f] hover:text-[#1b4332]">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
