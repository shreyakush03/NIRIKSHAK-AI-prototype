import { redirect } from "next/navigation";

export default async function MpRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ parliament?: string }>;
}) {
  const { name } = await params;
  const { parliament } = await searchParams;
  const query = parliament ? `?parliament=${parliament}` : "";
  redirect(`/mps/${encodeURIComponent(name)}${query}`);
}

