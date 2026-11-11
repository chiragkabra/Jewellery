"use client";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Gem, LayoutDashboard, LogOut, Package, Plus, Search, Users, X } from "lucide-react";
import styles from "./crm.module.css";
type Row = Record<string, any>;
type Field = { key: string; label: string; type?: string; options?: string[]; required?: boolean };
const tabs = ["Overview", "Enquiries", "Customers", "Tasks", "Orders", "Products", "Rates", "WhatsApp", "Team", "Activity"];
const resources: Record<string,string> = { Enquiries: "enquiries", Customers: "customers", Tasks: "tasks", Orders: "orders", Products: "products", Rates: "settings", Team: "users", Activity: "audit" };
const money = (paise: number) => new Intl.NumberFormat("en-IN",{ style: "currency",currency: "INR",maximumFractionDigits: 2 }).format(paise / 100);
const date = (value: string) => value ? new Date(value).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"}) : "—";
async function api(path: string, method = "GET", data?: Row) {
  const res = await fetch(path,{ method,headers: data ? { "Content-Type":"application/json" } : {},body: data ? JSON.stringify(data) : undefined });
  const result = await res.json(); if(!res.ok) throw new Error(result.error || "Request failed"); return result;
}
function fieldsFor(tab: string, creating: boolean): Field[] {
  const notes = { key:"notes",label:"Internal notes",type:"textarea" };
  if(tab === "Customers") return [{key:"name",label:"Name",required:true},{key:"email",label:"Email",type:"email",required:true},{key:"phone",label:"Phone"},{key:"company",label:"Company"},{key:"country",label:"Country"},{key:"segment",label:"Segment",options:["retail","trade","vip"]},notes];
  if(tab === "Enquiries") return [{key:"status",label:"Stage",options:["new","contacted","qualified","quoted","won","lost"]},{key:"assignee",label:"Assigned to"},notes];
  if(tab === "Tasks") return [...(creating ? [{key:"customerId",label:"Customer",required:true}] : []),{key:"title",label:"Task title",required:true},{key:"kind",label:"Type",options:["follow-up","repair","custom-order","appointment"]},{key:"dueAt",label:"Due date (your local time)",type:"datetime-local",required:true},{key:"assignee",label:"Assigned to"},{key:"status",label:"Status",options:["open","in-progress","ready","done"]},notes];
  if(tab === "Orders") return [{key:"status",label:"Order status",options:["pending","confirmed","processing","shipped","delivered","cancelled"]},{key:"paymentStatus",label:"Payment status",options:["unpaid","paid","refunded"]},{key:"carrier",label:"Delivery carrier"},{key:"trackingNumber",label:"Tracking reference"},{key:"trackingUrl",label:"Tracking URL (HTTPS)",type:"url"},notes];
  if(tab === "Products") return [...(creating ? [{key:"slug",label:"URL slug",required:true}] : []),{key:"name",label:"Product name",required:true},{key:"description",label:"Description",type:"textarea",required:true},{key:"material",label:"Material",options:["gold","silver","diamond"]},{key:"category",label:"Category",options:["rings","necklaces","earrings","bangles-bracelets","pendants","chains"]},{key:"price",label:"Fixed price incl. GST (INR, blank = rate based)",type:"number"},{key:"stock",label:"Available stock",type:"number",required:true},{key:"weightGrams",label:"Weight in grams",type:"number"},{key:"makingChargePct",label:"Making charge %",type:"number"},{key:"stoneValue",label:"Stone value (INR)",type:"number"},{key:"variants",label:"Variants (comma separated)",required:true},{key:"metalColours",label:"Metal colours (comma separated)",required:true},{key:"images",label:"Image paths (comma separated /images/...)",required:true},{key:"certificateNo",label:"Certificate / HUID"},{key:"active",label:"Published",options:["true","false"]}];
  if(tab === "Rates") return ["gold24","gold22","gold18","silver999"].map(key => ({key,label:key === "silver999" ? "Silver 999 — INR per kg" : `${key.replace("gold","Gold ")}K — INR per gram`,type:"number"}));
  if(tab === "Team") return [{key:"name",label:"Name",required:true},{key:"email",label:"Email",type:"email",required:true},{key:"password",label:"Temporary password (12+ characters)",type:"password",required:true},{key:"role",label:"Role",options:["staff","trade","admin"]}];
  return [];
}
export function Crm({ name, role }: { name: string; role: string }) {
  const editorRef = useRef<HTMLElement>(null);
  const loadVersion = useRef(0);
  const [tab,setTab] = useState("Overview"), [rows,setRows] = useState<Row[]>([]), [stats,setStats] = useState<Row>({}), [customers,setCustomers] = useState<Row[]>([]);
  const [query,setQuery] = useState(""), [filter,setFilter] = useState("all"), [selected,setSelected] = useState<Row | null>(null), [creating,setCreating] = useState(false), [values,setValues] = useState<Row>({});
  const [busy,setBusy] = useState(false),[loading,setLoading] = useState(true),[error,setError] = useState(""),[notice,setNotice] = useState("");
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if(tab === "WhatsApp") {setLoading(false);return;}
    setLoading(true); setError("");
    try {
      const [dashboard, contacts, list] = await Promise.all([api("/api/crm/dashboard"),api("/api/crm/customers"),tab === "Overview" ? api("/api/crm/enquiries") : api(`/api/crm/${resources[tab]}`)]);
      if (version !== loadVersion.current) return;
      setStats(dashboard); setCustomers(contacts.items); setRows(list.items || []);
      if(tab === "Rates") { setSelected({id:"rates"}); setValues(list.items.find((r:Row) => r.id === "rates") || {}); }
    } catch(e) { if(version === loadVersion.current) setError((e as Error).message); } finally { if(version === loadVersion.current) setLoading(false); }
  },[tab]);
  useEffect(() => { void load(); },[load]);
  useEffect(() => { if((selected || creating) && tab !== "Rates") editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"}); },[selected,creating,tab]);
  const switchTab = (next: string) => { window.scrollTo({top:0,behavior:"instant"}); setTab(next); setQuery("");setFilter("all");setSelected(null);setCreating(false);setNotice(""); };
  const edit = (row: Row) => { setSelected(row);setCreating(false);setValues({...row});setError(""); };
  const add = () => { setSelected(null);setCreating(true);setValues(tab === "Products" ? {stock:0,active:true,material:"gold",category:"rings",variants:"22K",metalColours:"Yellow",images:"/images/products/aurelia-band-ring-1.jpg"} : {});setError(""); };
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();setBusy(true);setError("");
    try {
      const payload: Row = {};
      for(const field of fieldsFor(tab,creating)) {
        let v = values[field.key] ?? field.options?.[0] ?? "";
        if(field.type === "number") v = v === "" ? null : Number(v);
        if(["variants","metalColours","images"].includes(field.key)) v = Array.isArray(v) ? v : String(v).split(",").map(s=>s.trim()).filter(Boolean);
        if(field.key === "active") v = String(v) === "true";
        if(field.key === "dueAt" && v) v = new Date(v).toISOString();
        payload[field.key] = v;
      }
      if(tab === "Team") await api("/api/auth","POST",{action:"create-user",...payload});
      else await api(`/api/crm/${resources[tab]}${creating ? "" : `/${selected?.id || "rates"}`}`,creating ? "POST":"PATCH",payload);
      setNotice("Saved successfully.");setSelected(null);setCreating(false); await load();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const visible = rows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || row.status === filter));
  const selectedCustomer = selected?.customerId || (tab === "Customers" ? selected?.id : "");
  const [history,setHistory] = useState<Row | null>(null);
  useEffect(() => {
    setHistory(null); if(!selectedCustomer) return;
    let live = true;
    Promise.all([api("/api/crm/enquiries"),api("/api/crm/orders"),api("/api/crm/tasks")]).then(([enquiries,orders,tasks]) => { if(live) setHistory({enquiries:enquiries.items.filter((r:Row)=>r.customerId === selectedCustomer),orders:orders.items.filter((r:Row)=>r.customerId === selectedCustomer),tasks:tasks.items.filter((r:Row)=>r.customerId === selectedCustomer)}); }).catch(()=>{});
    return () => {live=false;};
  },[selectedCustomer]);
  const allowedTabs = tabs.filter(t => role === "admin" || !["Rates","Team"].includes(t));
  const columns = tab === "Products" ? ["name","material","stock","price","active"] : tab === "Customers" ? ["name","email","segment","company"] : tab === "Tasks" ? ["title","kind","dueAt","status","assignee"] : tab === "Orders" ? ["id","name","totalPaise","status","paymentStatus"] : tab === "Team" ? ["name","email","role"] : tab === "Activity" ? ["action","actor","entity","created_at"] : ["id","form","customerId","status","assignee"];
  const renderValue = (key: string, value: any) => key === "totalPaise" ? money(Number(value)) : ["dueAt","created_at"].includes(key) ? date(value) : key === "customerId" ? customers.find(c=>c.id === value)?.name || "—" : typeof value === "boolean" ? value ? "Published" : "Hidden" : value == null || value === "" ? "—" : String(value);
  return <div className={styles.app}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}><Gem size={25}/><span>LUMERA<small>BUSINESS STUDIO</small></span></Link>
      <div className={styles.workspace}><span className={styles.dot}/><span>Jewellery workspace<small>Retail · Wholesale · Export</small></span></div>
      <nav aria-label="CRM navigation">{allowedTabs.map((t,i)=><button key={t} onClick={()=>switchTab(t)} className={tab===t ? styles.active : ""}>{i === 0 ? <LayoutDashboard size={18}/> : ["Customers","Team"].includes(t) ? <Users size={18}/> : <Package size={18}/>}<span>{t}</span>{t==="Enquiries" && <b>{stats.openEnquiries || 0}</b>}</button>)}</nav>
      <div className={styles.sidebarBottom}><Link href="/">Visit storefront <ArrowUpRight size={15}/></Link><Link href="/account" style={{marginTop:15}}>Account & password</Link><p>{name}<small>{role}</small></p><button onClick={async()=>{await api("/api/auth","POST",{action:"logout"});location.href="/account";}}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <div className={styles.main}>
      <header className={styles.topbar}><span>Workspace <ChevronRight size={14}/> {tab}</span><span><span className={styles.dot}/> Store connected</span></header>
      <div className={styles.content}>
        <div className={styles.heading}><div><p className={styles.eyebrow}>YOUR BUSINESS, AT A GLANCE</p><h1>{tab === "Overview" ? "A little clarity. A lot of possibility." : tab}</h1><p>{tab === "Overview" ? "Every conversation, every piece, every next step — together." : `Manage your ${tab.toLowerCase()} in one place.`}</p></div><div className={styles.actions}>{role === "admin" && tab === "Overview" && <a className={styles.secondary} href="/api/crm/export">Export CRM</a>}{["Customers","Tasks","Products","Team"].includes(tab) && <button className={styles.primary} onClick={add}><Plus size={16}/> Add {tab === "Team" ? "user" : tab.slice(0,-1).toLowerCase()}</button>}</div></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.success}><Check size={16}/> {notice}</p>}
        {tab === "WhatsApp" ? <WhatsAppPanel role={role}/> : loading ? <p className={styles.empty}>Loading workspace…</p> : <>
          {tab === "Overview" && <><div className={styles.metrics}>{[["Customers",stats.customers,"Customer relationships"],["Open enquiries",stats.openEnquiries,"Conversations to move forward"],["Active orders",stats.openOrders,"Pieces on their way"],["Recorded paid sales",money(stats.paidPaise || 0),"Excludes cancelled orders"]].map(([label,value,detail])=><article key={label} className={styles.metric}><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>)}</div><div className={styles.banner}><div><p className={styles.eyebrow}>THE NEXT RIGHT STEP</p><h2>Keep the details close.</h2><p>{stats.overdue || 0} overdue tasks · {stats.lowStock || 0} products with two or fewer pieces in stock.</p></div><button onClick={()=>switchTab("Tasks")}>Review follow-ups <ArrowUpRight size={18}/></button></div><div className={styles.sectionTitle}><h2>Latest conversations</h2><button onClick={()=>switchTab("Enquiries")}>View enquiries <ArrowUpRight size={16}/></button></div></>}
          {tab !== "Rates" && <section className={styles.panel}><div className={styles.toolbar}><label><Search size={17}/><input aria-label="Search records" placeholder="Search records…" value={query} onChange={e=>setQuery(e.target.value)}/></label>{["Enquiries","Tasks","Orders"].includes(tab) && <select aria-label="Filter by status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All stages</option>{[...new Set(rows.map(r=>r.status))].map(s=><option key={s}>{s}</option>)}</select>}<span>{visible.length} records</span></div><div className={styles.tableWrap}><table><thead><tr>{columns.map(c=><th key={c}>{({customerId:"Customer",totalPaise:"Total",paymentStatus:"Payment",dueAt:"Due date",created_at:"Time"} as Record<string,string>)[c] || c}</th>)}{!["Team","Activity"].includes(tab) && <th><span className={styles.srOnly}>Open</span></th>}</tr></thead><tbody>{visible.slice(0,tab==="Overview" ? 8 : visible.length).map(row=><tr key={row.id}>{columns.map(c=><td key={c}>{c === "status" || c === "paymentStatus" ? <span className={styles.badge}>{renderValue(c,row[c])}</span> : renderValue(c,row[c])}</td>)}{!["Team","Activity"].includes(tab) && <td><button aria-label={`Open ${row.name || row.id}`} onClick={()=>{if(tab === "Overview") {switchTab("Enquiries");} edit(row);}}>Open <ChevronRight size={14}/></button></td>}</tr>)}</tbody></table></div>{!visible.length && <div className={styles.empty}><Gem size={30}/><h3>A fresh start.</h3><p>{query ? "No matching records. Try another search." : "New records will appear here as your business grows."}</p></div>}</section>}
          {tab === "Rates" && <div className={styles.rateNote}><h2>Store-managed metal rates</h2><p>These rates appear on the storefront. Gold is INR per gram; silver is INR per kilogram. Blank values remain unavailable. This is a manual rate board, not a live market feed.</p></div>}
        </>}
        {(selected || creating) && <section ref={editorRef} className={styles.editor} aria-label="Record details"><div className={styles.sectionTitle}><h2>{creating ? `Add ${tab === "Team" ? "user" : tab.slice(0,-1).toLowerCase()}` : tab === "Rates" ? "Update rates" : selected?.name || selected?.title || selected?.id}</h2>{tab !== "Rates" && <button aria-label="Close details" onClick={()=>{setSelected(null);setCreating(false);}}><X size={19}/></button>}</div>
          {selected?.payload && <div className={styles.details}>{Object.entries(selected.payload).filter(([k])=>!["documents","form"].includes(k)).map(([k,v])=><div key={k}><strong>{k}</strong><span>{typeof v === "object" ? Array.isArray(v) ? v.map((i:any)=>typeof i === "object" ? `${i.name || i.slug} × ${i.qty}` : i).join(", ") : "See attached documents" : String(v)}</span></div>)}{selected.attachments?.map((f:Row)=><a key={f.id} href={`/api/crm/attachments/${f.id}`}>Download {f.name}</a>)}</div>}
          {tab === "Orders" && selected && <div className={styles.details}><p>{selected.name} · {selected.email} · {selected.phone}</p><p>{selected.address}</p>{selected.items?.map((item:Row,i:number)=><p key={i}>{item.name} · {item.variant} · {item.colour} · {item.size} × {item.qty} — {money(item.unitPaise * item.qty)}</p>)}<strong>Total: {money(selected.totalPaise)}</strong><p>Manual payment · Mark paid only after verifying receipt.</p></div>}
          <form className={styles.form} onSubmit={save}>{fieldsFor(tab,creating).map(field=>{
            let value = values[field.key] ?? field.options?.[0] ?? ""; if(Array.isArray(value)) value=value.join(", ");
            if(field.type === "datetime-local" && value) { const d=new Date(value); if(Number.isFinite(d.getTime())) value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
            return <label key={field.key} className={field.type === "textarea" ? styles.full : ""}>{field.label}{field.required && " *"}{field.key === "customerId" ? <select required value={value} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}><option value="">Choose customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select> : field.options ? <select value={String(value)} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}>{field.options.map(o=><option key={o}>{o}</option>)}</select> : field.type === "textarea" ? <textarea required={field.required} rows={4} value={value} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/> : <input type={field.type || "text"} required={field.required} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "any" : undefined} value={value} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>}</label>;
          })}<div className={styles.full}><button className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form>
          {history && <div className={styles.history}><h3>Customer history</h3>{Object.entries(history).map(([group,items])=><div key={group}><h4>{group}</h4>{items.length ? items.map((r:Row)=><p key={r.id}><span>{r.title || r.form || r.id}</span><span className={styles.badge}>{r.status}</span><small>{date(r.createdAt)}</small></p>) : <p>No {group} yet.</p>}</div>)}</div>}
        </section>}
        <p className={styles.footnote}>LUMERA Business Studio · Times shown in India Standard Time · Manual payments</p>
      </div>
    </div>
  </div>;
}






