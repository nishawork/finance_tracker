interface ProgressRingProps {
  percentage: number;
  radius?: number;
  strokeWidth?: number;
  label?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue';
  animated?: boolean;
}

const colorClasses = {
  green: 'stroke-green-500',
  yellow: 'stroke-yellow-500',
  red: 'stroke-red-500',
  blue: 'stroke-blue-500',
};

export function ProgressRing({
  percentage,
  radius = 45,
  strokeWidth = 4,
  label,
  color = 'blue',
  animated = true,
}: ProgressRingProps) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'yellow';
    return 'green';
  };

  const displayColor = color === 'blue' ? getColor() : color;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="transform -rotate-90" width={radius * 2 + strokeWidth} height={radius * 2 + strokeWidth}>
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={radius + strokeWidth / 2}
            cy={radius + strokeWidth / 2}
            r={radius}
            fill="none"
            className={`${colorClasses[displayColor]} transition-all ${animated ? 'duration-500' : ''}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{Math.min(Math.round(percentage), 100)}%</span>
          {label && <span className="text-xs text-gray-600 mt-1">{label}</span>}
        </div>
      </div>
    </div>
  );
}
