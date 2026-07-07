import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PieChartCardProps {
  title: string;
  data: {
    name: string;
    value: number;
  }[];
}

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#64748b",
];

function PieChartCard({ title, data }: PieChartCardProps) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-bold text-slate-900">{title}</h3>

      <div className="mt-5 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={3}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => {
                const numericValue = Number(value || 0);
                const percent = total
                  ? Math.round((numericValue / total) * 100)
                  : 0;

                return [
                  `${numericValue} stores (${percent}%)`,
                  "Contribution",
                ];
              }}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default PieChartCard;