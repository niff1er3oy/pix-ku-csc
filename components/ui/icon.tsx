import { cn } from "@/lib/utils";

/**
 * The icon set.
 *
 * **Drawn here rather than pasted from an aggregator, and that is a licensing
 * decision as much as a design one.** A site that indexes 200+ icon libraries
 * hands back glyphs under whatever licence each source set carries — MIT,
 * Apache, CC-BY — and dropping them into a repository without knowing which is
 * which leaves an attribution obligation nobody recorded. These are plain
 * geometric strokes in the project's own hand, so there is nothing to attribute
 * and nothing to audit later.
 *
 * The house style, matching the chevron already inline on the landing page:
 * a 24×24 box, no fill, `currentColor` stroke, round caps and joins. Colour
 * therefore comes from whatever text colour the icon sits in — an icon beside
 * slate text is slate, and no call site ever passes a hex.
 *
 * `aria-hidden` is the default because an icon here always sits beside its own
 * label. An icon that is genuinely the only content of a control passes a
 * `title`, which turns it into an `img` with an accessible name instead.
 */
function Icon({
  size = 20,
  strokeWidth = 2,
  title,
  className,
  children,
}: {
  size?: number;
  strokeWidth?: number;
  /** Supply only when the icon stands alone; otherwise it is decorative. */
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      {children}
    </svg>
  );
}

type Props = Omit<React.ComponentProps<typeof Icon>, "children">;

/* --- People and roles ---------------------------------------------------- */

export const UsersIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.25" />
    <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16.5 5.5a3.25 3.25 0 0 1 0 6" />
    <path d="M17.5 14.8c2 .7 3.5 2.4 3.5 4.7" />
  </Icon>
);

export const CameraIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3 8.5h3l1.6-2.4a1 1 0 0 1 .84-.45h7.12a1 1 0 0 1 .84.45L18 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.25" />
  </Icon>
);

/** Admin. A shield reads as authority without borrowing a padlock's "locked". */
export const ShieldIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 3l7 2.8v5.4c0 4.2-2.9 7.7-7 9.3-4.1-1.6-7-5.1-7-9.3V5.8L12 3Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

/* --- Events and photos --------------------------------------------------- */

export const CalendarIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);

export const PhotoIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.75" />
    <path d="m4 17 4.5-4.2a1.6 1.6 0 0 1 2.2 0L15 17" />
    <path d="m13.5 14 1.6-1.5a1.6 1.6 0 0 1 2.2 0L20 15" />
  </Icon>
);

/** A face inside capture brackets — the product's own subject. */
export const FaceScanIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="11" r="2.25" />
    <path d="M8.5 16.5c.7-1.4 2-2.2 3.5-2.2s2.8.8 3.5 2.2" />
  </Icon>
);

export const SearchIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 4.5 4.5" />
  </Icon>
);

/* --- Decisions and states ------------------------------------------------ */

export const CheckIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const CloseIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/**
 * Failure. Always shipped beside a word — DESIGN.md and the dataviz rules both
 * refuse status signalled by shape or colour alone.
 */
export const AlertIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 4.5 21 19.5H3L12 4.5Z" />
    <path d="M12 10v4" />
    <path d="M12 16.8v.2" />
  </Icon>
);

export const ClockIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
);

/* --- Navigation ---------------------------------------------------------- */

export const ChevronDownIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 5v13M6 13l6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m14 6-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m10 6 6 6-6 6" />
  </Icon>
);

/** Eight spokes around a hub read as "settings" without drawing literal gear
 *  teeth, which do not survive this house style's stroke weight at 20-24px. */
export const SettingsIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.75M12 18.25V21M4.93 4.93l1.94 1.94M17.13 17.13l1.94 1.94M3 12h2.75M18.25 12H21M4.93 19.07l1.94-1.94M17.13 6.87l1.94-1.94" />
  </Icon>
);

export const TrashIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const DownloadIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 4v10" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
  </Icon>
);

export const RefreshIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8.5" />
    <path d="M20 4v4.5h-4.5" />
    <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15.5" />
    <path d="M4 20v-4.5h4.5" />
  </Icon>
);
