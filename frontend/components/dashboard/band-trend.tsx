"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BandPoint {
  t: number;
  band: number;
  module: string;
  title: string;
}

const BRAND = "var(--brand)";
const SOFT = "var(--soft)";
const GRID = "var(--border)";

const shortDate = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * Band per marked attempt over time against the target line. One series in the brand colour, straight
 * segments, every mark labelled with its band; the latest mark is the larger dot.
 */
export function BandTrend({ points, target }: { points: BandPoint[]; target: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const bands = points.map((p) => p.band);
  const lo = Math.max(0, Math.floor(Math.min(...bands, target) - 1));
  const hi = 9;
  const yTicks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((v) => (hi - lo > 5 ? v % 2 === hi % 2 : true));

  const first = points[0].t;
  const last = points[points.length - 1].t;
  const span = Math.max(last - first, 1);
  const pad = span * 0.04;
  // Weekly ticks when the history is long enough, otherwise one per attempt day.
  const DAY = 86_400_000;
  const step = span > 21 * DAY ? 7 * DAY : span > 7 * DAY ? 3 * DAY : DAY;
  const xTicks: number[] = [];
  for (let t = first; t <= last; t += step) xTicks.push(t);
  const lastIndex = points.length - 1;
  // Label every mark only when they have room (about 56px each); otherwise the latest alone.
  const labelAll = width / points.length >= 56;

  return (
    <div ref={boxRef} className="h-[248px] w-full" role="img" aria-label={`Band per attempt, ${points.length} marked attempts, target Band ${target.toFixed(1)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 24, right: 72, bottom: 4, left: -12 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[first - pad, last + pad]}
            ticks={xTicks}
            tickFormatter={shortDate}
            tick={{ fontSize: 13, fill: SOFT }}
            tickLine={false}
            axisLine={{ stroke: "var(--input)" }}
            tickMargin={8}
          />
          <YAxis
            domain={[lo, hi]}
            ticks={yTicks}
            tick={{ fontSize: 13, fill: SOFT }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ReferenceLine
            y={target}
            stroke={SOFT}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: `Target ${target.toFixed(1)}`, position: "right", fill: SOFT, fontSize: 13 }}
          />
          <Tooltip
            cursor={{ stroke: GRID }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as BandPoint | undefined;
              if (!p) return null;
              return (
                <div className="rounded-[10px] border border-border bg-sheet px-3 py-2 text-sm text-ink">
                  <span className="tabular">Band {p.band.toFixed(1)}</span>
                  <span className="text-soft"> · {p.module}, {shortDate(p.t)}</span>
                </div>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="band"
            stroke={BRAND}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, index } = props as { cx: number; cy: number; index: number };
              const latest = index === lastIndex;
              return <circle key={index} cx={cx} cy={cy} r={latest ? 5 : 3} fill={latest ? BRAND : "#fff"} stroke={BRAND} strokeWidth={2} />;
            }}
            activeDot={{ r: 5, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
          >
            <LabelList
              dataKey="band"
              content={(props) => {
                const { x, y, value, index } = props as { x: number; y: number; value: number; index: number };
                if (!labelAll && index !== lastIndex) return null;
                // Attempts marked minutes apart share an x; label only the last of a cluster.
                const plotW = Math.max(width - 44 - 72 - 32, 1);
                const next = points[index + 1];
                if (next && ((next.t - points[index].t) / (last - first + 2 * pad)) * plotW < 28) return null;
                const latest = index === lastIndex;
                return (
                  <text
                    x={x}
                    y={index > 0 && Number(value) < points[index - 1].band && Number(value) - lo >= 1.5 ? y + 22 : y - 12}
                    dx={latest && index > 0 && Number(value) < points[index - 1].band ? 16 : 0}
                    textAnchor="middle"
                    fontSize={13}
                    fill={latest ? BRAND : SOFT}
                    fontWeight={latest ? 600 : 400}
                    stroke="#fff"
                    strokeWidth={4}
                    paintOrder="stroke"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {Number(value).toFixed(1)}
                  </text>
                );
              }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
