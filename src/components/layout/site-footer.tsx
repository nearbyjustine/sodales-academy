import { BrandWordmark } from "@/components/brand/brand-wordmark";

const SIBLING_PRODUCTS = ["Main", "Persona", "Cinema", "Talents", "Store"];

export function SiteFooter() {
  return (
    <footer className="bg-obsidian py-16 text-ivory">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 md:flex-row md:justify-between">
        <div className="max-w-sm space-y-4">
          <BrandWordmark tone="dark" />
          <p className="text-sm text-ivory/70">
            SODALES is a modern creative intelligence collective where strategy, design &
            technology converge.
          </p>
        </div>

        <div className="space-y-3">
          <p className="label-eyebrow text-ivory/50">Sodales products</p>
          <ul className="space-y-2">
            {SIBLING_PRODUCTS.map((product) => (
              <li key={product}>
                <span
                  title={`Sodales ${product} is not yet live`}
                  className="text-sm text-violet-accessible"
                >
                  {product}
                  <span className="sr-only"> (coming soon)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-6xl px-4 text-sm text-ivory/50">
        <p>&copy; 2026 Sodales</p>
        <p>Creative Intelligence. Collective Impact.</p>
      </div>
    </footer>
  );
}
