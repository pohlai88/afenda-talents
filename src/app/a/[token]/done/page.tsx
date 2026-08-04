export const dynamic = "force-dynamic";

/**
 * The landing spot for submitted, expired, revoked and unknown tokens alike.
 * It must not distinguish between them — doing so would let anyone probe which
 * links exist and in what state.
 */
export default function DonePage() {
  return (
    <main className="mx-auto max-w-xl p-5">
      <h1 className="text-xl font-semibold">Thank you</h1>
      <p className="mt-4 text-sm leading-relaxed">
        If you have just submitted your self-assessment, we have received it and no further
        action is needed from you.
      </p>
      <p className="mt-3 text-sm leading-relaxed">
        If you were expecting to see questions, this link has already been used or is no longer
        active. Please reply to your invitation email and we will help.
      </p>
    </main>
  );
}
