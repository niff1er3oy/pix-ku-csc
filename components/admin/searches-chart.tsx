"use client";

import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { useEffect, useRef } from "react";

import type { DayPoint } from "@/lib/queries/admin";
import { formatNumber } from "@/lib/utils";

/**
 * Registered piece by piece rather than importing `chart.js/auto`.
 *
 * `auto` pulls in every controller — bar, pie, radar, doughnut, scatter, polar
 * area — and this page draws one line. Naming the six things it actually uses
 * is the difference between shipping a chart and shipping a chart library.
 *
 * `Chart` is a *named* export in v4. The integration guide still shows it as
 * the default export, which does not exist — checked against the installed
 * package rather than taken on trust.
 */
Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
);

/**
 * Searches per day, 30 days.
 *
 * One series, so no legend — the heading already names what is plotted, and a
 * box with a single swatch would only repeat it.
 *
 * Chart.js draws to a canvas, so unlike an inline SVG this needs JavaScript to
 * exist at all, and a canvas has no DOM for assistive technology to read. The
 * `<details>` table underneath is therefore not a nicety — it is the copy of
 * the data that survives a screen reader, a keyboard, and a bundle that never
 * arrived on venue wifi.
 *
 * Interaction is `index` with `intersect: false`, which is also what fixed a
 * real defect: the hand-rolled version this replaced had 22.8px hover bands,
 * under the 24px floor. Pointing anywhere in a day's column now selects it.
 */
export function SearchesChart({
  points,
  locale,
  labels,
}: {
  points: DayPoint[];
  locale: "th" | "en";
  labels: {
    title: string;
    empty: string;
    emptyBody: string;
    tableToggle: string;
    colDay: string;
    colCount: string;
    unit: string;
  };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const total = points.reduce((sum, p) => sum + p.count, 0);

  useEffect(() => {
    if (!canvas.current || total === 0) return;

    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();

    // A canvas cannot resolve CSS variables, so the tokens are read out of the
    // document once and passed as plain strings. Reading them beats copying the
    // hex values in here, where they would drift the first time globals.css
    // changes and nobody would notice until the chart looked off-brand.
    const series = token("--color-green-600");
    const grid = token("--color-edge");
    const ink = token("--color-ink");
    const slate = token("--color-slate");
    const paper = token("--color-paper");
    const font = token("--font-sans") || "sans-serif";

    // Chart.js animates on its own clock, so the preference the stylesheet
    // honours has to be asked for directly here.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: still ? false : { duration: 900, easing: "easeOutQuart" },
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ink,
          titleFont: { family: font, size: 12 },
          bodyFont: { family: font, size: 12 },
          padding: 10,
          displayColors: false,
          callbacks: {
            // `parsed.y` is nullable in the type because a dataset may carry
            // gaps. This series never does — `getAdminMetrics` fills every day
            // with a real zero — but the fallback keeps the tooltip honest if
            // that ever stops being true.
            label: (item) =>
              `${formatNumber(item.parsed.y ?? 0, locale)} ${labels.unit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: slate,
            font: { family: font, size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: slate,
            font: { family: font, size: 11 },
            padding: 8,
            maxTicksLimit: 4,
            // Whole numbers only — a count of searches has no half.
            precision: 0,
            callback: (value) => formatNumber(Number(value), locale),
          },
        },
      },
    };

    const chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: points.map((p) => shortDay(p.day, locale)),
        datasets: [
          {
            data: points.map((p) => p.count),
            borderColor: series,
            borderWidth: 2,
            // A wash at 10%, never a saturated block.
            backgroundColor: `color-mix(in oklab, ${series} 10%, transparent)`,
            fill: true,
            tension: 0.25,
            // No dot on every point. Only the one under the pointer, ringed in
            // the surface colour so it stays readable on top of the line.
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: series,
            pointHoverBorderColor: paper,
            pointHoverBorderWidth: 2,
            pointHitRadius: 16,
          },
        ],
      },
      options,
    });

    return () => chart.destroy();
  }, [points, locale, labels.unit, total]);

  if (total === 0) {
    // The honest state, not a placeholder. PRODUCT.md forbids invented figures,
    // and a dashboard that draws a plausible curve over no data is the exact
    // failure that rule exists to prevent.
    return (
      <figure className="rounded-card bg-paper p-5 ring-1 ring-edge sm:p-6">
        <figcaption className="text-h3">{labels.title}</figcaption>
        <div className="mt-6 rounded-field bg-cloud px-6 py-12 text-center">
          <p className="text-body font-medium text-ink">{labels.empty}</p>
          <p className="mx-auto mt-2 max-w-sm text-label text-slate">
            {labels.emptyBody}
          </p>
        </div>
      </figure>
    );
  }

  return (
    <figure className="rounded-card bg-paper p-5 ring-1 ring-edge sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <figcaption className="text-h3">{labels.title}</figcaption>
        <p className="tnum text-label text-slate">
          {formatNumber(total, locale)} {labels.unit}
        </p>
      </div>

      {/* The height lives on the wrapper, not the canvas. Chart.js sizes the
          canvas itself, and letting it also size its own box is how a
          responsive canvas grows a few pixels taller on every resize. */}
      <div className="mt-5 h-[220px]">
        <canvas ref={canvas} role="img" aria-label={labels.title} />
      </div>

      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-label font-medium text-green-700">
          {labels.tableToggle}
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-field ring-1 ring-edge">
          <table className="w-full text-left text-label">
            <thead className="sticky top-0 bg-cloud">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium text-slate">
                  {labels.colDay}
                </th>
                <th
                  scope="col"
                  className="px-4 py-2 text-right font-medium text-slate"
                >
                  {labels.colCount}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.day} className="border-t border-edge">
                  <td className="px-4 py-1.5 text-ink">
                    {shortDay(p.day, locale)}
                  </td>
                  <td className="tnum px-4 py-1.5 text-right text-ink">
                    {formatNumber(p.count, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function shortDay(iso: string, locale: "th" | "en"): string {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}
