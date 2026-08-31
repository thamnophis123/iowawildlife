import Link from "next/link";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
  { href: "/upload", label: "Upload" },
] as const;

export default function Header() {
  return (
    <header className="border-b border-[#d8e3d4] bg-[#fbfaf6]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[#1b4332]"
        >
          Iowa Wildlife
        </Link>
        <nav aria-label="Main" className="flex items-center gap-5 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[#2d6a4f] hover:text-[#1b4332]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
