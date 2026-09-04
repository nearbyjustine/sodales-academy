import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-10 w-40" />
      <Skeleton className="mt-4 h-16 w-full max-w-xl" />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
