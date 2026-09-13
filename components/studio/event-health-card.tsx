import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  FaceScanIcon,
  PhotoIcon,
  SearchIcon,
} from "@/components/ui/icon";
import { CountUp } from "@/components/ui/count-up";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn, formatNumber } from "@/lib/utils";

/**
 * "How is this event doing" at a glance — indexing health (photos, faces,
 * processed, failed) plus the two numbers that say whether anyone is
 * actually using it (downloads, searches), in one place instead of two.
 *
 * Hidden entirely until there is a first photo — nothing here has anything
 * to say before that, and six zeroed figures would just repeat what
 * `PhotoUploader`'s own empty state already says.
 */
export function EventHealthCard({
  photoCount,
  faceCount,
  processedCount,
  failedCount,
  downloadCount,
  searchCount,
  locale,
  labels,
}: {
  photoCount: number;
  faceCount: number;
  processedCount: number;
  failedCount: number;
  downloadCount: number;
  searchCount: number;
  locale: "th" | "en";
  labels: Dictionary["studio"];
}) {
  if (photoCount === 0) return null;

  const stillWorking = processedCount < photoCount;

  return (
    <div
      className="enter mt-6 rounded-card bg-paper p-5 ring-1 ring-edge sm:p-6"
      style={{ "--d": "80ms" } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-label font-medium text-ink">{labels.healthTitle}</p>
        {stillWorking && (
          <span className="flex items-center gap-1.5 text-caption text-slate">
            <span
              aria-hidden
              className="animate-pulse-dot size-2 rounded-pill bg-green-600"
            />
            {labels.photoStatusIndexing}
          </span>
        )}
      </div>

      {/* Rows, not a tile grid — this card now lives beside the cover image
          in a half-width column (see the studio event page), and a
          breakpoint-driven grid picks its column count from the *viewport*,
          not this card's own width. At half-width on a wide screen that
          still resolved to four columns and broke Thai labels like
          "ประมวลผลแล้ว" mid-word. A stacked row always gets the card's full
          width for its label, so there is nothing left to break.

          Two labeled sub-groups instead of one flat six-row list — indexing
          health (photos/faces/processed/failed) is its own ≤4-item cluster,
          and usage (downloads/searches) is the separate question of whether
          anyone is actually using the gallery. Still one card, no nested
          `rounded-card`/`shadow-card` box: the grouping comes from the
          sub-heading plus tighter spacing inside each `dl` than between
          them, the same way the card already sets its title apart from its
          body. The sub-headings go one step quieter than `healthTitle`
          (`text-slate` instead of `text-ink`) so they read as a label for
          what follows, not a second card title. */}
      <p className="mt-5 text-label font-medium text-slate">
        {labels.healthIndexingGroup}
      </p>
      <dl className="mt-2 divide-y divide-edge">
        <Figure
          label={labels.healthPhotos}
          value={photoCount}
          locale={locale}
          Icon={PhotoIcon}
        />
        <Figure
          label={labels.healthFaces}
          value={faceCount}
          locale={locale}
          Icon={FaceScanIcon}
        />
        <Figure
          label={labels.healthProcessed}
          value={processedCount}
          locale={locale}
          Icon={CheckIcon}
        />
        {failedCount > 0 && (
          <Figure
            label={labels.healthFailed}
            value={failedCount}
            locale={locale}
            Icon={AlertIcon}
            alarming
          />
        )}
      </dl>

      <p className="mt-6 text-label font-medium text-slate">
        {labels.healthUsageGroup}
      </p>
      <dl className="mt-2 divide-y divide-edge">
        <Figure
          label={labels.healthDownloads}
          value={downloadCount}
          locale={locale}
          Icon={DownloadIcon}
        />
        <Figure
          label={labels.healthSearches}
          value={searchCount}
          locale={locale}
          Icon={SearchIcon}
        />
      </dl>
    </div>
  );
}

function Figure({
  label,
  value,
  locale,
  Icon,
  alarming = false,
}: {
  label: string;
  value: number;
  locale: "th" | "en";
  Icon: (props: { size?: number }) => React.ReactElement;
  alarming?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-1.5 text-label text-slate">
        <Icon size={16} />
        {label}
      </dt>
      <dd
        className={cn(
          "tnum font-display text-h3 font-bold",
          alarming ? "text-danger" : "text-ink",
        )}
      >
        <CountUp value={value} formatted={formatNumber(value, locale)} />
      </dd>
    </div>
  );
}
