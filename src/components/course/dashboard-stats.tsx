type DashboardStatsProps = {
  coursesEnrolled: number;
  lessonsCompleted: number;
  coursesFinished: number;
};

export function DashboardStats({
  coursesEnrolled,
  lessonsCompleted,
  coursesFinished,
}: DashboardStatsProps) {
  const stats = [
    { label: "Courses enrolled", value: coursesEnrolled },
    { label: "Lessons completed", value: lessonsCompleted },
    { label: "Courses finished", value: coursesFinished },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-border border-y border-border">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 px-4 py-6 text-center">
          <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
          <span className="label-eyebrow text-graphite">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
