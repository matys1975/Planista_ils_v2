import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { TeachersDistribution, HistogramBucket } from '../../types/analytics.types';

/* ═══════════════════════════════════════════════════════════════════ */
/*  PIE CHART — Rozkład statusów prowadzących                        */
/* ═══════════════════════════════════════════════════════════════════ */

interface PieProps {
    distribution: TeachersDistribution;
}

const PIE_COLORS = {
    ok: '#059669',
    overloaded: '#dc2626',
    underloaded: '#f59e0b',
};

const PIE_LABELS: Record<string, string> = {
    ok: 'Pensum OK',
    overloaded: 'Nadgodziny',
    underloaded: 'Niedobór',
};

export function TeacherStatusPieChart({ distribution }: PieProps) {
    const data = [
        { name: PIE_LABELS.ok, value: distribution.ok, color: PIE_COLORS.ok },
        { name: PIE_LABELS.overloaded, value: distribution.overloaded, color: PIE_COLORS.overloaded },
        { name: PIE_LABELS.underloaded, value: distribution.underloaded, color: PIE_COLORS.underloaded },
    ].filter((d) => d.value > 0);

    const total = data.reduce((s, d) => s + d.value, 0);

    if (total === 0) {
        return (
            <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-muted-foreground text-sm">
                Brak danych o prowadzących.
            </div>
        );
    }

    return (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h3 className="text-sm font-bold text-primary">🥧 Status prowadzących</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Łącznie {total} prowadzących</p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={{ strokeWidth: 1, stroke: '#9ca3af' }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0];
                                return (
                                    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
                                        <p className="font-bold" style={{ color: d.payload.color }}>{d.name}</p>
                                        <p>{d.value} prowadzących ({((d.value as number / total) * 100).toFixed(1)}%)</p>
                                    </div>
                                );
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  HISTOGRAM — Rozkład obciążeń procentowych                       */
/* ═══════════════════════════════════════════════════════════════════ */

interface HistogramProps {
    histogram: HistogramBucket[];
}

const getBarColor = (range: string): string => {
    if (range === '0%') return '#94a3b8';
    if (range === '1-50%') return '#f59e0b';
    if (range === '51-80%') return '#eab308';
    if (range === '81-99%') return '#84cc16';
    if (range === '100%') return '#059669';
    if (range === '101-120%') return '#f97316';
    return '#dc2626'; // >120%
};

export function WorkloadHistogram({ histogram }: HistogramProps) {
    const total = histogram.reduce((s, b) => s + b.count, 0);

    if (total === 0) {
        return (
            <div className="bg-card rounded-xl border shadow-sm p-8 text-center text-muted-foreground text-sm">
                Brak danych do histogramu.
            </div>
        );
    }

    const chartData = histogram.map((b) => ({
        ...b,
        fill: getBarColor(b.range),
    }));

    return (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/20">
                <h3 className="text-sm font-bold text-primary">📊 Rozkład wypełnienia pensum</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Ile prowadzących w danym przedziale procentowym
                </p>
            </div>
            <div className="p-4" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                            dataKey="range"
                            tick={{ fontSize: 11, fontWeight: 600 }}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            allowDecimals={false}
                            label={{ value: 'Prowadzący', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs">
                                        <p className="font-bold text-primary">Pensum: {d.range}</p>
                                        <p>{d.count} prowadzących ({total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%)</p>
                                    </div>
                                );
                            }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
