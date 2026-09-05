import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

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
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-24 w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-1.5 h-9 w-full" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>

      <Skeleton className="h-10 w-32 self-start" />
    </div>
  );
}
