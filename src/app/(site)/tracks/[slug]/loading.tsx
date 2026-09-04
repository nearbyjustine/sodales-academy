import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-4 h-12 w-96 max-w-full" />
      <Skeleton className="mt-4 h-6 w-full max-w-xl" />
      <div className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
