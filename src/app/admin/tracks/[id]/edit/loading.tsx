import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="p-6 lg:p-10">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-10" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-8" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-2/3" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-20 w-full" />
          <Skeleton className="mt-1 h-3 w-3/4" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>

        <Skeleton className="h-10 w-32 self-start" />
      </div>
    </div>
  );
}
