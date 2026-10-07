import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = process.env.APP_PASSWORD ?? "";
  const given = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!password || !safeEqual(await sessionToken(given), await sessionToken(password))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card">
        <h1>Limitless Daily</h1>
        <input type="hidden" name="next" value={next} />
        <input type="password" name="password" placeholder="Password" autoFocus required />
        {error && <p className="error">Wrong password.</p>}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
