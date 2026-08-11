import { EmployeeVerificationForm } from "@/components/employee-verification-form";

export const dynamic = "force-dynamic";

export default async function EmployeeVerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <EmployeeVerificationForm token={token} />
    </main>
  );
}
