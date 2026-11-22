import React, { useMemo, useState } from 'react';
import { HoleResults } from '../lib/golfData';

export interface PieSliceSpec {
  key: keyof Omit<HoleResults, 'forats'>;
  label: string;
  value: number;
  color: string;
  sideColor: string;
}

export const HOLE_SLICE_CONFIG: Omit<PieSliceSpec, 'value'>[] = [
  { key: 'eagles', label: 'Eagles', color: '#154c6b', sideColor: '#0c2e42' },
  { key: 'birdies', label: 'Birdies', color: '#e66c2c', sideColor: '#a84715' },
  { key: 'pars', label: 'Pars', color: '#1c6d2c', sideColor: '#0f4419' },
  { key: 'bogeys', label: 'Bogeys', color: '#0093d5', sideColor: '#00618f' },
  { key: 'dbogeys', label: 'DBogeys', color: '#98238a', sideColor: '#611258' },
  { key: 'tbogeysPlus', label: 'TBogeys+', color: '#54a425', sideColor: '#346b13' },
  { key: 'ratlles', label: 'Ratlles', color: '#123548', sideColor: '#081b26' },
];

interface PieChart3DProps {
  results: HoleResults;
}

interface ComputedSlice extends PieSliceSpec {
  startAngle: number;
  endAngle: number;
  midAngle: number;
  pct: number;
}

export const PieChart3D: React.FC<PieChart3DProps> = ({ results }) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const slices = useMemo<PieSliceSpec[]>(
    () =>
      HOLE_SLICE_CONFIG.map((cfg) => ({
        ...cfg,
        value: results[cfg.key] || 0,
      })),
    [results]
  );

  const total = useMemo(() => slices.reduce((sum, s) => sum + s.value, 0), [slices]);

  // SVG geometry matching tilted 3D pie look from Sample
  const cx = 240;
  const cy = 128;
  const rx = 165;
  const ry = 88;
  const depth = 24;

  const computedSlices = useMemo<ComputedSlice[]>(() => {
    if (total === 0) return [];
    let current = -Math.PI / 2; // Start at 12 o'clock
    return slices.map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const startAngle = current;
      const endAngle = current + sweep;
      current = endAngle;
      return {
        ...s,
        startAngle,
        endAngle,
        midAngle: (startAngle + endAngle) / 2,
        pct: (s.value / total) * 100,
      };
    });
  }, [slices, total]);

  const pt = (angle: number, radiusX = rx, radiusY = ry, centerY = cy) => ({
    x: cx + radiusX * Math.cos(angle),
    y: centerY + radiusY * Math.sin(angle),
  });

  const buildTopSlicePath = (start: number, end: number) => {
    const sweep = end - start;
    if (sweep <= 0.0001) return '';
    if (sweep >= Math.PI * 2 - 0.001) {
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    const p1 = pt(start);
    const p2 = pt(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${rx} ${ry} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
  };

  // Front-facing side wall segments (where sin(angle) > 0, i.e., angle in [0, PI] mod 2*PI)
  const sideSegments = useMemo(() => {
    const segs: { key: string; path: string; color: string }[] = [];
    for (const s of computedSlices) {
      if (s.value <= 0) continue;
      // Split slice into small sub-intervals or intersect with front half [0, PI]
      // Normalize start/end into [-PI/2, 3*PI/2]
      const intervals: [number, number][] = [];
      // Front half ranges across wraps: [0, PI] and [2*PI, 3*PI]
      const frontRanges: [number, number][] = [
        [0, Math.PI],
        [Math.PI * 2, Math.PI * 3],
      ];
      for (const [fStart, fEnd] of frontRanges) {
        const a = Math.max(s.startAngle, fStart);
        const b = Math.min(s.endAngle, fEnd);
        if (b - a > 0.001) {
          intervals.push([a, b]);
        }
      }
      for (const [a, b] of intervals) {
        const topA = pt(a, rx, ry, cy);
        const topB = pt(b, rx, ry, cy);
        const botB = pt(b, rx, ry, cy + depth);
        const botA = pt(a, rx, ry, cy + depth);
        const largeArc = b - a > Math.PI ? 1 : 0;
        const d = [
          `M ${topA.x.toFixed(2)} ${topA.y.toFixed(2)}`,
          `A ${rx} ${ry} 0 ${largeArc} 1 ${topB.x.toFixed(2)} ${topB.y.toFixed(2)}`,
          `L ${botB.x.toFixed(2)} ${botB.y.toFixed(2)}`,
          `A ${rx} ${ry} 0 ${largeArc} 0 ${botA.x.toFixed(2)} ${botA.y.toFixed(2)}`,
          'Z',
        ].join(' ');
        segs.push({ key: `${s.key}-${a.toFixed(2)}`, path: d, color: s.sideColor });
      }
    }
    return segs;
  }, [computedSlices]);

  const activeSlice = computedSlices.find((s) => s.key === activeKey) || null;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center mb-3">
          <span className="text-xl font-bold text-slate-300 tabular-nums">0</span>
        </div>
        <p className="text-sm font-medium text-slate-600">Sense forats registrats aquesta temporada</p>
        <p className="text-xs text-slate-400 mt-1">
          El gràfic de resultats s’omplirà automàticament quan es jugui el primer torneig.
        </p>
      </div>
    );
  }

  // Position labels: inside for substantial slices, nicely above/outside for tiny or 0 slices near 12 o'clock
  const eaglesSlice = slices.find((s) => s.key === 'eagles');
  const birdiesSlice = computedSlices.find((s) => s.key === 'birdies');

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[490px] relative">
        <svg
          viewBox="0 0 480 262"
          className="w-full h-auto select-none overflow-visible"
          role="img"
          aria-label="Distribució de resultats per forat"
        >
          {/* Subtle drop shadow under the 3D disc */}
          <ellipse cx={cx} cy={cy + depth + 6} rx={rx + 4} ry={ry + 2} fill="rgba(15, 23, 42, 0.08)" />

          {/* 3D Side walls */}
          {sideSegments.map((seg) => (
            <path
              key={seg.key}
              d={seg.path}
              fill={seg.color}
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}

          {/* Top Pie Slices */}
          {computedSlices.map((s) => {
            if (s.value <= 0) return null;
            const isHovered = activeKey === s.key;
            const dx = isHovered ? Math.cos(s.midAngle) * 5 : 0;
            const dy = isHovered ? Math.sin(s.midAngle) * 3 : 0;
            return (
              <g
                key={s.key}
                transform={`translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`}
                className="cursor-pointer transition-transform duration-150"
                onMouseEnter={() => setActiveKey(s.key)}
                onMouseLeave={() => setActiveKey(null)}
                onClick={() => setActiveKey(activeKey === s.key ? null : s.key)}
              >
                <path
                  d={buildTopSlicePath(s.startAngle, s.endAngle)}
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Value Labels */}
          {computedSlices.map((s) => {
            if (s.value === 0) return null;
            const isSmall = s.pct < 5.5;
            const rFactor = isSmall ? 1.15 : 0.65;
            const pos = pt(s.midAngle, rx * rFactor, ry * rFactor, cy);
            // Adjust dark vs light text based on slice color or outside placement
            const isDarkSlice = s.key === 'ratlles' || s.key === 'eagles' || s.key === 'dbogeys';
            const textColor = isSmall ? '#0f172a' : isDarkSlice ? '#ffffff' : '#0f172a';
            // If birdies is tiny and near 12 o'clock, nudge slightly right from Eagles 0
            const extraX = s.key === 'birdies' && isSmall ? 8 : 0;
            const extraY = isSmall ? -4 : 5;

            return (
              <text
                key={`lbl-${s.key}`}
                x={pos.x + extraX}
                y={pos.y + extraY}
                textAnchor="middle"
                fill={textColor}
                className="font-bold pointer-events-none tabular-nums"
                style={{ fontSize: isSmall ? '15px' : '16px' }}
              >
                {s.value}
              </text>
            );
          })}

          {/* Show 0 for Eagles at 12 o'clock just like Sample.png when Eagles = 0 */}
          {eaglesSlice && eaglesSlice.value === 0 && (
            <text
              x={birdiesSlice && birdiesSlice.pct < 5.5 ? cx - 10 : cx}
              y={cy - ry - 10}
              textAnchor="middle"
              fill="#0f172a"
              className="font-bold pointer-events-none tabular-nums"
              style={{ fontSize: '15px' }}
            >
              0
            </text>
          )}
        </svg>
      </div>

      {/* Interactive detail readout */}
      <div className="min-h-[24px] mb-2 text-xs text-slate-600 text-center tabular-nums">
        {activeSlice ? (
          <span>
            <strong className="text-slate-900">{activeSlice.label}:</strong> {activeSlice.value} forats (
            {activeSlice.pct.toFixed(1).replace('.', ',')}%) · Total: {results.forats || total} forats
          </span>
        ) : (
          <span className="text-slate-500">
            Total forats computats: <strong className="text-slate-800">{results.forats || total}</strong>
          </span>
        )}
      </div>

      {/* Legend matching Sample.png */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-2">
        {slices.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveKey(activeKey === s.key ? null : s.key)}
            onMouseEnter={() => setActiveKey(s.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={`inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium transition-opacity cursor-pointer whitespace-nowrap ${
              activeKey && activeKey !== s.key ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <span
              className="w-2.5 h-2.5 inline-block shrink-0"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            <span className="text-slate-800">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
