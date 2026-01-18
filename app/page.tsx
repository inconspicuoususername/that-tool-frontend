import { cookies } from "next/headers";

import { AUTH_TOKEN_COOKIE } from "@/lib/auth";
import { Monitor } from "./ui";

export default async function Home() {
  const token = (await cookies()).get(AUTH_TOKEN_COOKIE)?.value;

  // Middleware should enforce this, but keep it safe.
  if (!token) {
    return null;
  }

  return <Monitor token={token} />;
}
