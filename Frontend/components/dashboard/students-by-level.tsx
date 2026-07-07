"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const data = [
  { name: "Pre-Kinder", value: 45, color: "var(--chart-1))" },
  { name: "Kinder", value: 62, color: "var(--chart-2)" },
  { name: "Primaria", value: 180, color: "var(--chart-4)" },
];

export function StudentsByLevel() {
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          Estudiantes por Nivel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value} estudiantes`, ""]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value, entry) => {
                  const item = data.find((d) => d.name === value);
                  return `${value} (${item?.value})`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-sm text-muted-foreground">Total de estudiantes</p>
        </div>
      </CardContent>
    </Card>
  );
}
