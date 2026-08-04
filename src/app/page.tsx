/**
 * Public landing. Deliberately says nothing: candidates arrive via emailed links and the
 * admin knows the /admin path. Nothing here may link into either surface.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6 text-center">
      <h1 className="text-xl font-semibold">Afenda Talents</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Assessments here are by invitation. If you were invited, please use the personal link in
        your email.
      </p>
    </main>
  );
}
