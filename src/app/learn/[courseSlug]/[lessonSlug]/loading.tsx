import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[280px_1fr]">
      <span className="sr-only">Loading</span>
      <div className="hidden lg:block">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
      <div className="max-w-3xl">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    </div>
  );
}
