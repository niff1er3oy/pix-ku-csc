import type { AdminMetrics } from "@/lib/queries/admin";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";

/**
 * The headline numbers.
 *
 * A row of stat tiles rather than a chart: six current values with no shared
 * scale and no time axis have nothing for a chart to say. Each is a number and
 * the word for what it counts, and nothing else — no icon, no accent stripe, no
 * sparkline standing in for a trend that is not being measured.
 *
 * The values wear ink tokens, never a series colour. Colour on this page means
 * a mark in a chart or a status; a green number would claim to belong to
 * something it is not plotted against.
 */
export function StatTiles({
  totals,
  labels,
  locale,
}: {
  totals: AdminMetrics["totals"];
  labels: Dictionary["admin"];
  locale: "th" | "en";
}) {
  const tiles = [
    { label: labels.statUsers, value: totals.users },
    { label: labels.statPhotographers, value: totals.photographers },
    { label: labels.statEvents, value: totals.events },
    { label: labels.statPhotos, value: totals.photos },
    { label: labels.statFaces, value: totals.faces },
    { label: labels.statSearches, value: totals.searches },
  ];

  return (
    <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile, index) => (
        <li
          key={tile.label}
          className="enter rounded-card bg-paper p-4 ring-1 ring-edge"
          style={{ "--d": `${index * 50}ms` } as React.CSSProperties}
        >
          {/* Proportional figures, not `tnum`. Equal-width digits are for
              columns that line up vertically — a table row, an axis tick. On a
              standalone stat value they only make it look loose. */}
          <p className="font-display text-h2 font-bold text-ink">
            {formatNumber(tile.value, locale)}
          </p>
          <p className="mt-1 text-caption text-slate">{tile.label}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * How far the face-indexing pipeline has got.
 *
 * A meter, not a pie or a stacked bar. The question an admin actually has is
 * "is it done, and is anything broken" — a single ratio against a limit, which
 * is exactly what a meter answers. A five-slice chart of index states would
 * spend a lot of colour saying "almost all of them are fine", and would bury
 * the two numbers worth acting on.
 *
 * Failures are named and counted in words with the status colour beside them,
 * never signalled by colour alone.
 */
export function IndexingMeter({
  indexing,
  labels,
  locale,
}: {
  indexing: AdminMetrics["indexing"];
  labels: Dictionary["admin"];
  locale: "th" | "en";
}) {
  const { total, indexed, working, noFace, failed } = indexing;
  const share = total === 0 ? 0 : Math.round((indexed / total) * 100);

  return (
    <figure className="rounded-card bg-paper p-5 ring-1 ring-edge sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <figcaption className="text-h3">{labels.indexingTitle}</figcaption>
        <p className="tnum text-label text-slate">
          {t(labels.indexingRatio, {
            done: formatNumber(indexed, locale),
            total: formatNumber(total, locale),
          })}
        </p>
      </div>

      {total === 0 ? (
        <div className="mt-6 rounded-field bg-cloud px-6 py-12 text-center">
          <p className="text-body font-medium text-ink">{labels.indexingEmpty}</p>
          <p className="mx-auto mt-2 max-w-sm text-label text-slate">
            {labels.indexingEmptyBody}
          </p>
        </div>
      ) : (
        <>
          <div
            className="mt-5 h-3 w-full overflow-hidden rounded-pill bg-green-100"
            role="img"
            aria-label={t(labels.indexingRatio, {
              done: formatNumber(indexed, locale),
              total: formatNumber(total, locale),
            })}
          >
            <div
              className="meter-bar h-full rounded-pill bg-green-600"
              style={{ "--fill": `${share}%` } as React.CSSProperties}
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Figure label={labels.indexIndexed} value={indexed} locale={locale} />
            <Figure label={labels.indexWorking} value={working} locale={locale} />
            <Figure label={labels.indexNoFace} value={noFace} locale={locale} />
            <Figure
              label={labels.indexFailed}
              value={failed}
              locale={locale}
              /* Only when there is something wrong. A permanently red zero
                 trains an admin to ignore the one colour that should make
                 them look. */
              alarming={failed > 0}
            />
          </dl>
        </>
      )}
    </figure>
  );
}

function Figure({
  label,
  value,
  locale,
  alarming = false,
}: {
  label: string;
  value: number;
  locale: "th" | "en";
  alarming?: boolean;
}) {
  return (
    <div>
      <dt className="text-caption text-slate">{label}</dt>
      <dd
        className={
          alarming
            ? "mt-0.5 font-display text-h3 font-bold text-danger"
            : "mt-0.5 font-display text-h3 font-bold text-ink"
        }
      >
        {formatNumber(value, locale)}
      </dd>
    </div>
  );
}
