import { generatePin } from "@/lib/event-pin";
import { requireApprovedPhotographer } from "@/lib/dal";

/**
 * A freshly generated entry PIN.
 *
 * Generated on the server rather than in the browser because this value *is*
 * the PIN most photographers will keep, not a suggestion — and `Math.random`
 * in a page is not a source anything guarding photographs should rely on.
 *
 * Behind the photographer check so it cannot be used as a free random-number
 * endpoint, and `no-store` so no cache ever holds a PIN.
 */
export async function POST() {
  await requireApprovedPhotographer();

  return Response.json(
    { pin: generatePin() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
