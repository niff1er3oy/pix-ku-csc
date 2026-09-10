/**
 * The "select all" checkbox above a photo grid — identical across
 * `FaceSearchPanel`, `EventGallery`, and `DeletePhotosForm` except which
 * dictionary strings it carries. Its own label flips to `deselectLabel`
 * once `checked` is true, mirroring the checkbox's own state rather than
 * saying "select all" while every photo is already selected.
 */
export function SelectAllToggle({
  checked,
  onChange,
  selectLabel,
  deselectLabel,
}: {
  checked: boolean;
  onChange: () => void;
  selectLabel: string;
  deselectLabel: string;
}) {
  return (
    <label className="flex min-h-11 w-fit items-center gap-2 text-label font-medium text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-5 rounded-[6px] accent-green-600"
      />
      {checked ? deselectLabel : selectLabel}
    </label>
  );
}
