import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import type { InstituteComparison } from '../../types/analytics.types';

interface Props {
    institutes: InstituteComparison[];
}

export function InstituteComparisonChart({ institutes }: Props) {
    const chartData = useMemo(() =>
        institutes.map((inst) => ({
            name: inst.shortCode,
            fullName: inst.name,
            prowadzacy: inst.teachersCount,
            nadgodziny: inst.overloadedCount,
            niedobor: inst.underloadedCount,
            ok: inst.okCount,
            'Wypełnienie %': inst.avgPensumUtilization,
            nieprzypisane: inst.unassignedCoursesCount,
        })),
        [institutes]
    );

    if (institutes.length === 0) {
        return (
            <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-muted-foreground">
                Brak danych do wyświetlenia wykresu.
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h3 className="text-sm font-bold text-primary">
                    📊 Porównanie jednostek — Obsada zajęć i wypełnienie pensum
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Słupki: prowadzący wg statusu · Linia: średnie wypełnienie pensum (%)
                </p>
            </div>
            <div className="p-4" style={{ height: Math.max(350, institutes.length * 20 + 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11, fontWeight: 700 }}
                            interval={0}
                            angle={institutes.length > 8 ? -35 : 0}
                            textAnchor={institutes.length > 8 ? 'end' : 'middle'}
                            height={institutes.length > 8 ? 60 : 30}
                        />
                        <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Prowadzący', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 11 }}
                            domain={[0, 'auto']}
                            label={{ value: 'Pensum %', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const item = chartData.find((d) => d.name === label);
                                return (
                                    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs max-w-xs">
                                        <p className="font-bold text-primary mb-2">{item?.fullName || label}</p>
                                        {payload.map((p: any) => (
                                            <div key={p.dataKey} className="flex justify-between gap-4">
                                                <span style={{ color: p.color }}>{p.name || p.dataKey}:</span>
                                                <span className="font-bold">
                                                    {p.dataKey === 'Wypełnienie %' ? `${p.value}%` : p.value}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                            iconType="roundRect"
                        />
                        <ReferenceLine
                            yAxisId="right"
                            y={100}
                            stroke="#059669"
                            strokeDasharray="6 3"
                            strokeWidth={2}
                            label={{ value: '100%', position: 'right', style: { fontSize: 10, fill: '#059669' } }}
                        />

                        <Bar yAxisId="left" dataKey="ok" stackId="status" name="OK" fill="#059669" radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="left" dataKey="nadgodziny" stackId="status" name="Nadgodziny" fill="#dc2626" radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="left" dataKey="niedobor" stackId="status" name="Niedobór" fill="#f59e0b" radius={[4, 4, 0, 0]} />

                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="Wypełnienie %"
                            stroke="#2563eb"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
