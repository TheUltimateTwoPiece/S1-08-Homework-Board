import { AuthForm } from "@/components/AuthForm";

type LoginPageProps = {
  searchParams: Promise<{ signup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <AuthForm initialMode={params.signup ? "signup" : "signin"} />
    </div>
  );
}
