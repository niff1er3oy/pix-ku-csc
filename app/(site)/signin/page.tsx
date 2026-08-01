import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { getSessionUser } from "@/lib/dal";
import { getDictionary } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.signInTitle };
}

/**
 * Google is the only provider, so this page is one button. Signing in is
 * optional throughout the product — it exists to save a reference face, not
 * to gate searching — so the way past it is as prominent as the way through.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [{ next, error }, dict, user] = await Promise.all([
    searchParams,
    getDictionary(),
    getSessionUser(),
  ]);

  // Only same-origin paths, so `?next=` cannot be used to bounce someone to
  // another site off the back of our sign-in.
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (user) redirect(target);

  async function withGoogle() {
    "use server";
    await signIn("google", { redirectTo: target });
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-20 sm:py-28">
      <h1 className="text-h1 font-bold">{dict.auth.signInTitle}</h1>
      <p className="mt-4 text-body-lg text-slate">{dict.auth.signInLede}</p>

      {error && (
        <p role="alert" className="mt-6 text-label text-danger">
          {dict.auth.signInError}
        </p>
      )}

      <form action={withGoogle} className="mt-8">
        <button
          type="submit"
          className="h-14 w-full rounded-pill bg-green-600 px-8 font-display text-base font-semibold text-paper shadow-[var(--shadow-pop)] transition-[background-color,transform] duration-200 hover:bg-green-700 active:scale-[0.98]"
        >
          {dict.auth.signInGoogle}
        </button>
      </form>

      <Link
        href={target}
        className="mt-6 text-center text-label font-medium text-green-700 underline underline-offset-4 hover:text-green-800"
      >
        {dict.auth.signInSkip}
      </Link>
    </section>
  );
}
