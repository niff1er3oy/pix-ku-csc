"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { deleteFace, saveFace, type SaveFaceState } from "@/lib/actions/profile";
import { t, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/utils";

const fileInput =
  "mt-3 block w-full text-label text-slate file:mr-4 file:h-11 file:cursor-pointer file:rounded-pill file:border-0 file:bg-green-600 file:px-5 file:font-display file:text-[0.9375rem] file:font-semibold file:text-paper hover:file:bg-green-700";

/**
 * Add / replace / delete for the one selfie a user can keep on file. The
 * search route has read `user_face` since it shipped — `FaceSearchPanel`'s
 * "search with my saved face" button has just never had anything to find,
 * because nothing wrote to the table until this.
 */
export function SavedFaceSection({
  dict,
  locale,
  face,
}: {
  dict: Dictionary;
  locale: Locale;
  face: { imagePath: string; createdAt: Date } | null;
}) {
  const [state, action] = useActionState<SaveFaceState, FormData>(
    saveFace,
    undefined,
  );
  const [replacing, setReplacing] = useState(false);
  const showForm = !face || replacing;

  return (
    <section className="rounded-card bg-cloud p-5 sm:p-6">
      <h2 className="text-h3 font-semibold text-ink">
        {dict.profile.savedFaceTitle}
      </h2>

      {face && !replacing && (
        <div className="mt-4 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/media/${face.imagePath}`}
            alt=""
            className="size-20 rounded-media object-cover ring-1 ring-edge"
          />
          <div>
            <p className="text-label text-slate">
              {t(dict.profile.savedFaceStored, {
                date: formatDate(face.createdAt, locale),
              })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => setReplacing(true)}
                className="text-label font-medium text-green-700 underline underline-offset-4"
              >
                {dict.profile.savedFaceReplace}
              </button>
              <DeleteFaceForm
                label={dict.profile.savedFaceDelete}
                confirmMessage={dict.profile.savedFaceDeleteConfirm}
              />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form action={action} className="mt-4">
          {!face && (
            <p className="text-label text-slate">
              {dict.profile.savedFaceNoneBody}
            </p>
          )}

          <input
            type="file"
            name="selfie"
            accept="image/jpeg,image/png,image/webp"
            required
            className={fileInput}
          />

          {state && "error" in state && (
            <p role="alert" className="mt-3 text-label text-danger">
              {messageFor(state.error, dict)}
            </p>
          )}

          <div className="mt-4 flex items-center gap-4">
            <SubmitButton
              label={face ? dict.profile.savedFaceReplace : dict.profile.savedFaceAdd}
            />
            {face && (
              <button
                type="button"
                onClick={() => setReplacing(false)}
                className="text-label font-medium text-slate underline underline-offset-4"
              >
                {dict.common.cancel}
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" pending={pending}>
      {label}
    </Button>
  );
}

/** Its own `<form>`, deliberately not nested inside the save form above —
 *  the two are siblings so a delete click never also submits a selfie. */
function DeleteFaceForm({
  label,
  confirmMessage,
}: {
  label: string;
  confirmMessage: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmMessage)) event.preventDefault();
  }

  return (
    <form action={deleteFace} onSubmit={onSubmit}>
      <DeleteSubmit label={label} />
    </form>
  );
}

function DeleteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-label font-medium text-danger underline underline-offset-4 disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function messageFor(code: string, dict: Dictionary): string {
  switch (code) {
    case "no_face":
      return dict.search.errorNoFace;
    case "many_faces":
      return dict.search.errorManyFaces;
    case "too_large":
      return dict.search.errorTooLarge;
    case "bad_format":
      return dict.search.errorBadFormat;
    case "no_file":
      return dict.common.required;
    default:
      return dict.search.errorGeneric;
  }
}
