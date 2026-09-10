/**
 * The per-photo selection checkbox that sits in `PhotoThumb`'s `select`
 * slot — the same look across `FaceSearchPanel`, `EventGallery`, and the
 * studio's `DeletePhotosForm`.
 */
export function SelectCheckbox({
  checked,
  onChange,
  ariaLabel,
  name,
  value,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
  /** Only `DeletePhotosForm` needs these — its bulk delete/download still
   *  has to work with JavaScript disabled for a single photo's own delete
   *  button, which reads these straight off a native form submission. */
  name?: string;
  value?: string;
}) {
  return (
    <input
      type="checkbox"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      className="size-5 rounded border-2 border-paper bg-paper/80 accent-[var(--color-green-600)] shadow-[var(--shadow-card)]"
    />
  );
}
