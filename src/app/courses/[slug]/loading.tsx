import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-3 h-10 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
      <Skeleton className="mt-6 h-16 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-9 w-40" />
      <div className="mt-16 flex flex-col gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
