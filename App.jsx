import React, { useEffect, useMemo, useState } from "react";
import {
  Bell, Check, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList,
  FolderKanban, LayoutDashboard, LogOut, Menu, Moon, Plus, Settings,
  Sun, Trash2, Wallet, X, Pencil
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { supabase, AUTH_EMAIL } from "./supabase";

const SALES_STAGES = [
  "Repérage",
  "Création du Code avec Claude",
  "Dépôt sur GitHub",
  "Trouver Images Google",
  "Intégration des images",
  "Contact du prospect",
  "Validation et intégration sur les plateformes"
];

const money = (n) => new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0
}).format(Number(n || 0));

const dateLabel = (d) => new Date(d).toLocaleDateString("fr-FR", {
  day: "2-digit", month: "short"
});

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="center-screen">Chargement…</div>;
  if (!session) return <Login />;

  return <Dashboard session={session} />;
}

function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: AUTH_EMAIL,
      password
    });
    if (error) setError("Mot de passe incorrect.");
    setBusy(false);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={login}>
        <div className="brand-mark"><Wallet size={23}/></div>
        <p className="eyebrow">ESPACE PRIVÉ</p>
        <h1>Mon commerce</h1>
        <p className="muted">Votre tableau de bord professionnel.</p>
        <label>Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoFocus
        />
        {error && <div className="error">{error}</div>}
        <button className="primary full" disabled={busy}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ session }) {
  const [tab, setTab] = useState("dashboard");
  const [dark, setDark] = useState(localStorage.getItem("dark") === "1");
  const [mobile, setMobile] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stages, setStages] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState(null);

  const userId = session.user.id;

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setBusy(true);
    const results = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("sales_stages").select("*").order("stage_order")
    ]);
    setTransactions(results[0].data || []);
    setProjects(results[1].data || []);
    setTasks(results[2].data || []);
    setNotifications(results[3].data || []);
    let loadedStages = results[4].data || [];

    if (!loadedStages.length) {
      const rows = SALES_STAGES.map((name, i) => ({
        user_id: userId, name, stage_order: i, status: "todo"
      }));
      const { data } = await supabase.from("sales_stages").insert(rows).select("*");
      loadedStages = data || [];
    }
    setStages(loadedStages);
    setBusy(false);
  }

  async function notify(title, message) {
    await supabase.from("notifications").insert({
      user_id: userId, title, message
    });
    setNotifications(n => [{ title, message, read: false, created_at: new Date().toISOString() }, ...n]);
  }

  async function addTransaction(data) {
    const { data: row, error } = await supabase.from("transactions").insert({
      user_id: userId, ...data
    }).select().single();
    if (!error) {
      setTransactions(t => [row, ...t]);
      await notify(data.type === "income" ? "Revenu ajouté" : "Dépense ajoutée", `${money(data.amount)} — ${data.description}`);
      setModal(null);
    }
  }

  async function deleteTransaction(id) {
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions(t => t.filter(x => x.id !== id));
    await notify("Opération supprimée", "Une opération a été supprimée.");
  }

  async function addProject(data) {
    const { data: row, error } = await supabase.from("projects").insert({
      user_id: userId, ...data, progress: 0, status: "En cours"
    }).select().single();
    if (!error) {
      setProjects(p => [row, ...p]);
      await notify("Projet créé", data.name);
      setModal(null);
    }
  }

  async function updateProject(project, progress) {
    const { data: row } = await supabase.from("projects")
      .update({ progress, status: progress >= 100 ? "Terminé" : "En cours" })
      .eq("id", project.id).select().single();
    if (row) {
      setProjects(p => p.map(x => x.id === row.id ? row : x));
      await notify("Projet mis à jour", `${row.name} — ${progress}%`);
    }
  }

  async function addTask(title) {
    if (!title.trim()) return;
    const { data: row } = await supabase.from("tasks").insert({
      user_id: userId, title, done: false
    }).select().single();
    if (row) {
      setTasks(t => [row, ...t]);
      await notify("Tâche ajoutée", title);
    }
  }

  async function toggleTask(task) {
    const { data: row } = await supabase.from("tasks")
      .update({ done: !task.done }).eq("id", task.id).select().single();
    if (row) {
      setTasks(t => t.map(x => x.id === row.id ? row : x));
      if (row.done) await notify("Tâche terminée", row.title);
    }
  }

  async function deleteTask(id) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(t => t.filter(x => x.id !== id));
  }

  async function updateStage(stage) {
    const next = stage.status === "todo" ? "done" : "todo";
    const { data: row } = await supabase.from("sales_stages")
      .update({ status: next }).eq("id", stage.id).select().single();
    if (row) {
      setStages(s => s.map(x => x.id === row.id ? row : x));
      await notify("Parcours de vente", `${row.name} : ${next === "done" ? "terminée" : "réouverte"}`);
    }
  }

  async function markRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(n => n.map(x => x.id === id ? {...x, read: true} : x));
  }

  async function logout() { await supabase.auth.signOut(); }

  const income = transactions.filter(t => t.type === "income").reduce((s,t) => s + Number(t.amount), 0);
  const expense = transactions.filter(t => t.type === "expense").reduce((s,t) => s + Number(t.amount), 0);
  const balance = income - expense;
  const unread = notifications.filter(n => !n.read).length;

  const chart = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      const dayIncome = transactions.filter(t => t.date?.slice(0,10) === key && t.type === "income").reduce((s,t)=>s+Number(t.amount),0);
      const dayExpense = transactions.filter(t => t.date?.slice(0,10) === key && t.type === "expense").reduce((s,t)=>s+Number(t.amount),0);
      days.push({ name: d.toLocaleDateString("fr-FR",{weekday:"short"}), revenus: dayIncome, dépenses: dayExpense });
    }
    return days;
  }, [transactions]);

  const nav = [
    ["dashboard","Dashboard",LayoutDashboard],
    ["finance","Finances",CircleDollarSign],
    ["projects","Projets",FolderKanban],
    ["tasks","À faire",ClipboardList],
    ["sales","Parcours de vente",ChevronRight],
    ["notifications","Notifications",Bell]
  ];

  if (busy) return <div className="center-screen">Chargement du tableau de bord…</div>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand"><div className="brand-mark small"><Wallet size={18}/></div><b>Mon commerce</b></div>
          <button className="icon-button mobile-only" onClick={()=>setMobile(false)}><X/></button>
        </div>
        <nav>
          {nav.map(([id,label,Icon]) => (
            <button key={id} className={tab===id ? "nav-item active" : "nav-item"} onClick={()=>{setTab(id);setMobile(false)}}>
              <Icon size={18}/><span>{label}</span>
              {id==="notifications" && unread > 0 && <em>{unread}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?"Mode clair":"Mode sombre"}</span></button>
          <button className="nav-item" onClick={logout}><LogOut size={18}/><span>Déconnexion</span></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={()=>setMobile(true)}><Menu/></button>
          <div><p className="eyebrow">TABLEAU DE BORD</p><h2>{nav.find(x=>x[0]===tab)?.[1]}</h2></div>
          <button className="notification-button" onClick={()=>setTab("notifications")}><Bell size={20}/>{unread>0&&<span>{unread}</span>}</button>
        </header>

        {tab==="dashboard" && <DashboardHome balance={balance} income={income} expense={expense} chart={chart} projects={projects} tasks={tasks} setTab={setTab}/>}
        {tab==="finance" && <Finance transactions={transactions} onAdd={()=>setModal("transaction")} onDelete={deleteTransaction}/>}
        {tab==="projects" && <Projects projects={projects} onAdd={()=>setModal("project")} onUpdate={updateProject}/>}
        {tab==="tasks" && <Tasks tasks={tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask}/>}
        {tab==="sales" && <Sales stages={stages} onToggle={updateStage}/>}
        {tab==="notifications" && <Notifications items={notifications} onRead={markRead}/>}

        {modal==="transaction" && <TransactionModal onClose={()=>setModal(null)} onSave={addTransaction}/>}
        {modal==="project" && <ProjectModal onClose={()=>setModal(null)} onSave={addProject}/>}
      </main>
    </div>
  );
}

function DashboardHome({balance,income,expense,chart,projects,tasks,setTab}) {
  return <section className="page">
    <div className="balance-card">
      <div><span>Solde actuel</span><strong>{money(balance)}</strong><small>Revenus moins dépenses</small></div>
      <div className="balance-icon"><Wallet size={26}/></div>
    </div>
    <div className="stats">
      <Stat label="Revenus" value={money(income)} positive/>
      <Stat label="Dépenses" value={money(expense)}/>
      <Stat label="Projets actifs" value={projects.filter(p=>p.status!=="Terminé").length}/>
      <Stat label="Tâches restantes" value={tasks.filter(t=>!t.done).length}/>
    </div>
    <div className="grid-2">
      <div className="card chart-card"><div className="card-head"><div><h3>Activité financière</h3><p>7 derniers jours</p></div></div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chart}>
            <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopOpacity={0.18}/><stop offset="95%" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.12}/>
            <XAxis dataKey="name" axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip formatter={(v)=>money(v)}/>
            <Area type="monotone" dataKey="revenus" strokeWidth={2} fill="url(#g1)" fillOpacity={1}/>
            <Area type="monotone" dataKey="dépenses" strokeWidth={2} fill="transparent"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card"><div className="card-head"><div><h3>Projets</h3><p>Votre activité en cours</p></div><button className="text-button" onClick={()=>setTab("projects")}>Voir tout</button></div>
        {projects.slice(0,3).map(p=><div className="mini-project" key={p.id}><div className="row-between"><b>{p.name}</b><span>{p.progress}%</span></div><div className="progress"><i style={{width:`${p.progress}%`}}/></div>)}
        {!projects.length && <Empty text="Aucun projet pour le moment."/>}
      </div>
    </div>
  </section>;
}

function Stat({label,value,positive}) { return <div className="stat card"><span>{label}</span><strong className={positive?"positive":""}>{value}</strong></div> }

function Finance({transactions,onAdd,onDelete}) {
  return <section className="page">
    <div className="section-head"><div><h3>Finances</h3><p>Vos revenus et dépenses.</p></div><button className="primary" onClick={onAdd}><Plus size={18}/> Ajouter</button></div>
    <div className="card table-card">
      {!transactions.length ? <Empty text="Aucune opération."/> :
      <div className="transactions">{transactions.map(t=><div className="transaction" key={t.id}>
        <div className={`transaction-icon ${t.type}`}><CircleDollarSign size={18}/></div>
        <div className="transaction-info"><b>{t.description || "Opération"}</b><span>{t.category || "Autre"} · {dateLabel(t.date)}</span></div>
        <strong className={t.type==="income"?"positive":""}>{t.type==="income"?"+":"-"}{money(t.amount)}</strong>
        <button className="icon-button danger" onClick={()=>onDelete(t.id)}><Trash2 size={17}/></button>
      </div>)}</div>}
    </div>
  </section>;
}

function Projects({projects,onAdd,onUpdate}) {
  return <section className="page">
    <div className="section-head"><div><h3>Projets</h3><p>Suivez simplement vos projets.</p></div><button className="primary" onClick={onAdd}><Plus size={18}/> Nouveau projet</button></div>
    <div className="project-grid">
      {projects.map(p=><div className="card project-card" key={p.id}><div className="row-between"><span className="pill">{p.status}</span><b>{p.progress}%</b></div><h3>{p.name}</h3><p>{p.description || "Aucune description."}</p><div className="progress large"><i style={{width:`${p.progress}%`}}/></div>
      <input className="range" type="range" min="0" max="100" step="5" value={p.progress} onChange={e=>onUpdate(p,Number(e.target.value))}/></div>)}
      {!projects.length&&<Empty text="Créez votre premier projet."/>}
    </div>
  </section>;
}

function Tasks({tasks,onAdd,onToggle,onDelete}) {
  const [value,setValue]=useState("");
  function submit(e){e.preventDefault();onAdd(value);setValue("")}
  return <section className="page">
    <div className="section-head"><div><h3>À faire</h3><p>Une liste simple pour avancer.</p></div></div>
    <form className="quick-add card" onSubmit={submit}><input value={value} onChange={e=>setValue(e.target.value)} placeholder="Ajouter une tâche…"/><button className="primary"><Plus size={18}/></button></form>
    <div className="card task-list">
      {tasks.map(t=><div className={`task ${t.done?"done":""}`} key={t.id}><button className="check" onClick={()=>onToggle(t)}>{t.done?<Check size={16}/>:null}</button><span>{t.title}</span><button className="icon-button danger" onClick={()=>onDelete(t.id)}><Trash2 size={16}/></button></div>)}
      {!tasks.length&&<Empty text="Aucune tâche."/>}
    </div>
  </section>;
}

function Sales({stages,onToggle}) {
  const done=stages.filter(s=>s.status==="done").length;
  const progress=stages.length?Math.round(done/stages.length*100):0;
  return <section className="page">
    <div className="sales-summary card"><div><span>Progression du parcours</span><strong>{progress}%</strong></div><div className="progress large"><i style={{width:`${progress}%`}}/></div></div>
    <div className="card sales-list">
      {stages.map((s,i)=><button className={`sales-stage ${s.status==="done"?"done":""}`} key={s.id} onClick={()=>onToggle(s)}>
        <div className="stage-number">{s.status==="done"?<Check size={16}/>:i+1}</div><span>{s.name}</span><ChevronRight size={18}/>
      </button>)}
    </div>
  </section>;
}

function Notifications({items,onRead}) {
  return <section className="page"><div className="card notification-list">
    {!items.length&&<Empty text="Aucune notification."/>}
    {items.map((n,i)=><button className={`notification ${n.read?"":"unread"}`} key={n.id||i} onClick={()=>n.id&&onRead(n.id)}>
      <div className="notification-dot"><Bell size={16}/></div><div><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></div>
    </button>)}
  </div></section>;
}

function TransactionModal({onClose,onSave}) {
  const [form,setForm]=useState({type:"income",amount:"",description:"",category:"Vente",date:new Date().toISOString().slice(0,10)});
  const set=(k,v)=>setForm({...form,[k]:v});
  return <Modal title="Ajouter une opération" onClose={onClose}><div className="form-grid">
    <label>Type<select value={form.type} onChange={e=>set("type",e.target.value)}><option value="income">Revenu</option><option value="expense">Dépense</option></select></label>
    <label>Montant (€)<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>set("amount",e.target.value)} required/></label>
    <label>Description<input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Ex. Vente client"/></label>
    <label>Catégorie<input value={form.category} onChange={e=>set("category",e.target.value)}/></label>
    <label>Date<input type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></label>
  </div><div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={()=>onSave({...form,amount:Number(form.amount)})}>Enregistrer</button></div></Modal>;
}

function ProjectModal({onClose,onSave}) {
  const [name,setName]=useState(""); const [description,setDescription]=useState("");
  return <Modal title="Nouveau projet" onClose={onClose}><div className="form-grid"><label>Nom<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows="3"/></label></div><div className="modal-actions"><button className="secondary" onClick={onClose}>Annuler</button><button className="primary" onClick={()=>name.trim()&&onSave({name,description})}>Créer</button></div></Modal>;
}

function Modal({title,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><h3>{title}</h3><button className="icon-button" onClick={onClose}><X/></button></div>{children}</div></div> }
function Empty({text}) { return <div className="empty"><ClipboardList size={22}/><span>{text}</span></div> }

export default App;