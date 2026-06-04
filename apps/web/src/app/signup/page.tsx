import { AuthPage } from "@/components/auth-page";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return <AuthPage searchParams={searchParams} initialMode="signup" />;
}
