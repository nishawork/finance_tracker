import { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  purple: 'bg-purple-50 text-purple-600',
};

const borderClasses = {
  blue: 'border-blue-200',
  green: 'border-green-200',
  red: 'border-red-200',
  yellow: 'border-yellow-200',
  purple: 'border-purple-200',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'blue',
  onClick,
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border ${borderClasses[color]} p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-600 text-sm font-medium mb-2">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-2 text-xs">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
              )}
              <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
        </div>
        <div className={`${colorClasses[color]} rounded-lg p-3`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
