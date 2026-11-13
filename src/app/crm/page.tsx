import { redirect } from "next/navigation";
import { user } from "@/lib/server/python";
import { Crm } from "@/components/crm/Crm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Business Studio", robots: { index:false,follow:false } };
export default async function CrmPage() {
  const current = await user();
  if(!current) redirect("/account");
  if(current.role === "trade") redirect("/account");
  return <Crm name={current.name} role={current.role}/>;
}
