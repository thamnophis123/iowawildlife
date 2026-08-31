const cards = [
  {
    title: "Upload a sighting",
    body: "Share a photo of an animal you found in Iowa.",
  },
  {
    title: "Explore the map",
    body: "See where sightings have been dropped across the state.",
  },
  {
    title: "Identify together",
    body: "Comment on photos and filter by species as a community.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f6f3ec] font-sans text-stone-700">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16 sm:px-8">
        <header className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-[#1b4332] sm:text-5xl">
            Iowa Wildlife
          </h1>
          <p className="mt-3 text-lg text-[#2d6a4f] sm:text-xl">
            See what’s living in Iowa — and add what you find.
          </p>
          <p className="mt-6 max-w-xl text-base leading-7 text-stone-600">
            People can upload wildlife photos, drop them on a map, comment, and
            filter by species.
          </p>
        </header>

        <section
          aria-label="What you can do"
          className="grid gap-4 sm:grid-cols-3"
        >
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-[#d8e3d4] bg-[#fbfaf6] p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-[#1b4332]">
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {card.body}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="px-6 py-8 text-center text-sm text-stone-500">
        Iowa-focused community project. Location can be exact or fuzzy.
      </footer>
    </div>
  );
}
