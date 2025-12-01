export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-24" />
        ))}
      </div>
      <div className="bg-gray-200 rounded-lg h-96" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-200 rounded-lg h-64" />
        <div className="lg:col-span-2 bg-gray-200 rounded-lg h-64" />
      </div>
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-gray-200 rounded-lg h-16" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="bg-gray-200 rounded-lg h-80 animate-pulse" />;
}

export function CardSkeleton() {
  return <div className="bg-gray-200 rounded-lg h-48 animate-pulse" />;
}
