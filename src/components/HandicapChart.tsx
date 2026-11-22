import React, { useMemo, useState } from 'react';
import { formatCatalanNumber, HandicapPoint } from '../lib/golfData';

interface HandicapChartProps {
  series: HandicapPoint[];
}

export const HandicapChart: React.FC<HandicapChartProps> = ({ series }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const chartMath = useMemo(() => {
    if (series.length === 0) return null;

    const values = series.map((d) => d.handicap);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    // Build clean 0.5-step Y axis bounds
    let yMin = Math.floor((rawMin - 0.4) * 2) / 2;
    let yMax = Math.ceil((rawMax + 0.4) * 2) / 2;
    if (yMax - yMin < 1.5) {
      const mid = Math.round(((rawMin + rawMax) / 2) * 2) / 2;
      yMin = mid - 1;
      yMax = mid + 1;
    }

    const ticks: number[] = [];
    const span = yMax - yMin;
    const step = span <= 3 ? 0.5 : span <= 7 ? 1 : span <= 15 ? 2 : 5;
    const firstTick = Math.ceil(yMin / step) * step;
    for (let v = firstTick; v <= yMax + 0.001; v += step) {
      ticks.push(Math.round(v * 10) / 10);
    }

    // Linear regression trendline for >= 2 points
    let trendStart = values[0];
    let trendEnd = values[values.length - 1];
    if (series.length >= 2) {
      const n = series.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumXX += i * i;
      }
      const denom = n * sumXX - sumX * sumX;
      const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      const intercept = (sumY - slope * sumX) / n;
      trendStart = intercept;
      trendEnd = intercept + slope * (n - 1);
    }

    return { yMin, yMax, ticks, trendStart, trendEnd };
  }, [series]);

  if (!chartMath || series.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Encara no hi ha dades de hàndicap registrades aquesta temporada.
      </div>
    );
  }

  const W = 600;
  const H = 195;
  const padL = 44;
  const padR = 20;
  const padT = 16;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const getX = (i: number) => {
    if (series.length === 1) return padL + plotW / 2;
    return padL + (i / (series.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - chartMath.yMin) / (chartMath.yMax - chartMath.yMin || 1);
    return padT + plotH - ratio * plotH;
  };

  const linePath = series
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(pt.handicap).toFixed(1)}`)
    .join(' ');

  const activePoint = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between min-h-[22px] mb-1 px-1">
        <span className="text-xs text-slate-500">
          {series.length === 1 ? '1 torneig disputat' : `${series.length} voltes registrades`}
        </span>
        <span className="text-xs font-medium text-slate-800 tabular-nums">
          {activePoint ? (
            <>
              {activePoint.tournament}: <strong>{formatCatalanNumber(activePoint.handicap)}</strong>
            </>
          ) : (
            <>
              Inicial {formatCatalanNumber(series[0].handicap)} → Actual{' '}
              <strong>{formatCatalanNumber(series[series.length - 1].handicap)}</strong>
            </>
          )}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none overflow-visible"
        role="img"
        aria-label="Evolució del hàndicap al llarg de la temporada"
      >
        {/* Horizontal Gridlines & Y Labels */}
        {chartMath.ticks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#d4d4d8" strokeWidth="1" />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                fill="#52525b"
                className="tabular-nums"
                style={{ fontSize: '11px' }}
              >
                {formatCatalanNumber(tick)}
              </text>
            </g>
          );
        })}

        {/* Dotted Linear Trendline (when >= 2 rounds) */}
        {series.length >= 2 && (
          <line
            x1={getX(0)}
            y1={getY(chartMath.trendStart)}
            x2={getX(series.length - 1)}
            y2={getY(chartMath.trendEnd)}
            stroke="#16537e"
            strokeWidth="1.5"
            strokeDasharray="2 4"
            opacity="0.65"
          />
        )}

        {/* Single-point horizontal reference line when only 1 tournament played */}
        {series.length === 1 && (
          <line
            x1={padL}
            y1={getY(series[0].handicap)}
            x2={W - padR}
            y2={getY(series[0].handicap)}
            stroke="#16537e"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.4"
          />
        )}

        {/* Main Handicap Polyline */}
        {series.length >= 2 && (
          <path
            d={linePath}
            fill="none"
            stroke="#16537e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Interactive Data Points & X-axis labels */}
        {series.map((pt, i) => {
          const x = getX(i);
          const y = getY(pt.handicap);
          const isHovered = hoveredIdx === i;
          // Show every label if <= 20 points, else skip every 2nd to avoid crowding
          const showXLabel = series.length <= 22 || i % 2 === 0 || i === series.length - 1;

          return (
            <g key={`${pt.tournament}-${i}`}>
              {/* Hover hitbox */}
              <circle
                cx={x}
                cy={y}
                r={12}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === i ? null : i)}
              />

              {/* Visible dot */}
              <circle
                cx={x}
                cy={y}
                r={isHovered || series.length === 1 ? 5 : 2.5}
                fill={isHovered || series.length === 1 ? '#16537e' : '#ffffff'}
                stroke="#16537e"
                strokeWidth={2}
                className="pointer-events-none"
              />

              {/* Label for 1-point view */}
              {series.length === 1 && (
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  fill="#0f172a"
                  className="font-bold tabular-nums"
                  style={{ fontSize: '12px' }}
                >
                  {pt.tournament} · {formatCatalanNumber(pt.handicap)}
                </text>
              )}

              {/* X-axis tick label */}
              {showXLabel && (
                <text
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  fill="#52525b"
                  className="tabular-nums"
                  style={{ fontSize: '10.5px' }}
                >
                  {series.length === 1 ? pt.tournament : pt.index}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
