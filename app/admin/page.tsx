import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AdminDashboard from "./AdminDashboard";

export default async function AdminPage() {
  const session = await getSession();
  if (session.role !== "admin") redirect("/login");
  return <AdminDashboard />;
}
