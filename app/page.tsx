import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session.role === "admin") redirect("/admin");
  if (session.role === "player") redirect("/play");
  redirect("/login");
}
