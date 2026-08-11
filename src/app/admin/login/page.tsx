import { AdminLoginForm } from "@/components/admin-login-form";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  return <AdminLoginForm developerMode={mode === "developer"} />;
}
