import React, { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, query, where } from "firebase/firestore";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};
const addWeeks = (dateStr, w) => addDays(dateStr, w * 7);
const addMonths = (dateStr, m) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().split("T")[0];
};

const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = [
  { value: "todo", label: "To Do", emoji: "○", color: "#6b7280" },
  { value: "inprogress", label: "In Progress", emoji: "◑", color: "#3b82f6" },
  { value: "review", label: "In Review", emoji: "◈", color: "#f59e0b" },
  { value: "done", label: "Done", emoji: "●", color: "#10b981" },
  { value: "cancelled", label: "Cancelled", emoji: "✕", color: "#ef4444" },
];
const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));
const CATEGORIES = ["Work", "Personal", "Urgent", "Project", "Meeting", "Other"];
const CAT_COLOR = {
  Work: "#3b82f6",
  Personal: "#8b5cf6",
  Urgent: "#ef4444",
  Project: "#10b981",
  Meeting: "#f59e0b",
  Other: "#6b7280",
};
const REPEAT_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];
const PROJECT_COLORS = [
  "#ef4444","#f59e0b","#10b981","#3b82f6",
  "#8b5cf6","#ec4899","#14b8a6","#f97316",
  "#6366f1","#84cc16",
];

// Sabit seed — sadece useState'in başlangıç değeri olarak kullanılır
const INITIAL_USERS = [
  {
    id: "u1",
    name: "Engin Yılmaz",
    email: "engin@demo.com",
    password: "123",
    role: "admin",
  },
  {
    id: "u2",
    name: "Ayşe Kaya",
    email: "ayse@demo.com",
    password: "123",
    role: "member",
  },
  {
    id: "u3",
    name: "Mehmet Demir",
    email: "mehmet@demo.com",
    password: "123",
    role: "member",
  },
];

const mkTask = (o) => ({
  id: uid(),
  status: "todo",
  ownerId: "u1",
  createdAt: Date.now(),
  subtasks: [],
  tags: [],
  links: [],
  files: [],
  repeat: "",
  note: "",
  due: todayStr(),
  priority: "Medium",
  assigneeId: "u1",
  projectId: "",
  ...o,
});
const SEED_TASKS = [
  mkTask({
    title: "Landing page tasarımı",
    assigneeId: "u2",
    priority: "High",
    status: "inprogress",
    due: "2026-03-20",
    note: "Figma linki paylaşıldı",
    tags: ["İş", "Proje"],
    links: [{ id: uid(), url: "https://figma.com", label: "Figma Dosyası" }],
    subtasks: [
      { id: uid(), text: "Wireframe", done: true },
      { id: uid(), text: "Renk paleti", done: false },
    ],
  }),
  mkTask({
    title: "Haftalık rapor gönder",
    assigneeId: "u1",
    priority: "Medium",
    status: "todo",
    due: "2026-03-14",
    tags: ["İş", "Toplantı"],
    repeat: "weekly",
  }),
  mkTask({
    title: "API entegrasyonu",
    assigneeId: "u3",
    priority: "High",
    status: "review",
    due: "2026-03-18",
    tags: ["İş", "Proje"],
  }),
  mkTask({
    title: "Alışveriş listesi",
    assigneeId: "u1",
    priority: "Low",
    status: "done",
    due: "2026-03-12",
    tags: ["Kişisel"],
  }),
];

const DARK = {
  bg: "#0f1117",
  surface: "#1a1d27",
  surface2: "#222639",
  border: "#2e3147",
  border2: "#3a3f5c",
  text: "#e8eaf0",
  textSub: "#8b90a8",
  textMuted: "#555a75",
  accent: "#4f6ef7",
  accentBg: "#1e2547",
  danger: "#ef4444",
  dangerBg: "#2d1515",
  success: "#10b981",
  successBg: "#0f2d1a",
  priHigh: { color: "#f87171", bg: "#2d1515" },
  priMed: { color: "#fbbf24", bg: "#2d2010" },
  priLow: { color: "#4ade80", bg: "#0f2d1a" },
};
const LIGHT = {
  bg: "#f0f2f8",
  surface: "#ffffff",
  surface2: "#eef1f8",
  border: "#dde1ef",
  border2: "#c8cde0",
  text: "#0f1117",
  textSub: "#5a5f7a",
  textMuted: "#9499b5",
  accent: "#4f6ef7",
  accentBg: "#eef1ff",
  danger: "#ef4444",
  dangerBg: "#fef2f2",
  success: "#10b981",
  successBg: "#f0fdf4",
  priHigh: { color: "#ef4444", bg: "#fef2f2" },
  priMed: { color: "#d97706", bg: "#fffbeb" },
  priLow: { color: "#16a34a", bg: "#f0fdf4" },
};
const priTokens = (theme, p) =>
  p === "High" ? theme.priHigh : p === "Medium" ? theme.priMed : theme.priLow;

function buildCss(t) {
  return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{height:100%;}
body{background:${t.bg};color:${t.text};font-family:'IBM Plex Sans',sans-serif;-webkit-text-size-adjust:100%;overflow-x:hidden;min-height:100%;-webkit-tap-highlight-color:transparent;}
input,select,textarea,button{font-family:'IBM Plex Sans',sans-serif;}
.mono{font-family:'JetBrains Mono',monospace !important;}
.fade{animation:fadeIn .18s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.slide-up{animation:slideUp .26s cubic-bezier(.32,1,.28,1);}
@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
.task-row{transition:background .1s;}
.kanban-card{background:${t.surface};border:1px solid ${t.border};border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.07);transition:box-shadow .15s,background .1s;}
@media(hover:hover){.kanban-card:hover{box-shadow:0 3px 10px rgba(0,0,0,.12);background:${t.surface2};}}
.del-btn{opacity:0;transition:opacity .12s;}
@media(hover:hover){.kanban-card:hover .del-btn{opacity:1;}}
@media(hover:none){.del-btn{opacity:1;}}
.del-btn{opacity:0;transition:opacity .12s;}
@media(hover:hover){.task-row:hover .del-btn{opacity:1;}}
@media(hover:hover){.sidebar-item:hover .del-btn{opacity:1;}}
@media(hover:none){.del-btn{opacity:1;}}
.pill{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;letter-spacing:.03em;white-space:nowrap;font-family:'JetBrains Mono',monospace;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;z-index:200;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);align-items:flex-end;justify-content:center;}
.modal{background:${t.surface};border-radius:20px 20px 0 0;border-top:1px solid ${t.border2};width:100%;max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch;}
@media(min-width:768px){
  .modal-bg{align-items:center;justify-content:center;padding:24px;}
  .modal{border-radius:16px;border:1px solid ${t.border2};max-width:560px;max-height:88vh;width:100%;}
  .slide-up{animation:fadeIn .18s ease;}
}
.modal-inner{padding:20px 20px 32px;}
@media(min-width:768px){.modal-inner{padding:28px;}}
.btn-primary{background:${t.accent};color:#fff;border:none;padding:14px 20px;cursor:pointer;font-size:15px;font-weight:600;transition:opacity .15s;border-radius:12px;width:100%;display:block;}
.btn-primary:active{opacity:.82;}
@media(hover:hover){.btn-primary:hover{opacity:.88;}}
@media(min-width:768px){.btn-primary{padding:10px 20px;font-size:14px;border-radius:8px;}}
.btn-danger{background:${t.danger};color:#fff;border:none;padding:10px 20px;cursor:pointer;font-size:14px;font-weight:600;transition:opacity .15s;border-radius:8px;}
.btn-danger:active{opacity:.82;}
@media(hover:hover){.btn-danger:hover{opacity:.88;}}
.btn-secondary{background:${t.surface2};color:${t.text};border:none;padding:14px 20px;cursor:pointer;font-size:15px;font-weight:500;transition:opacity .15s;border-radius:12px;}
.btn-secondary:active{opacity:.75;}
@media(min-width:768px){.btn-secondary{padding:10px 20px;font-size:14px;border-radius:8px;}}
.btn-sm{background:transparent;border:1px solid ${t.border2};padding:7px 13px;cursor:pointer;font-size:13px;font-weight:500;color:${t.textSub};transition:all .15s;border-radius:8px;}
.btn-sm:active{background:${t.surface2};}
@media(hover:hover){.btn-sm:hover{border-color:${t.accent};color:${t.accent};}}
.btn-icon{background:transparent;border:none;cursor:pointer;padding:6px;font-size:15px;color:${t.textMuted};transition:all .12s;line-height:1;border-radius:6px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;}
.btn-icon:active{background:${t.surface2};color:${t.text};}
@media(hover:hover){.btn-icon:hover{background:${t.surface2};color:${t.text};}}
.input-field{width:100%;padding:13px 14px;border:1.5px solid ${t.border2};background:${t.surface2};font-size:16px;outline:none;color:${t.text};transition:border-color .15s;-webkit-appearance:none;border-radius:12px;}
.input-field:focus{border-color:${t.accent};box-shadow:0 0 0 3px ${t.accentBg};}
.input-field option{background:${t.surface};}
@media(min-width:768px){.input-field{font-size:14px;padding:9px 12px;border-radius:8px;}}
.input-sm{width:100%;padding:8px 10px;border:1px solid ${t.border2};background:${t.surface2};font-size:14px;outline:none;color:${t.text};transition:border-color .15s;-webkit-appearance:none;border-radius:8px;}
.input-sm:focus{border-color:${t.accent};}
.input-sm option{background:${t.surface};}
.lbl{font-size:11px;font-weight:600;letter-spacing:.07em;color:${t.textMuted};margin-bottom:5px;display:block;text-transform:uppercase;font-family:'JetBrains Mono',monospace;}
.chk{width:20px;height:20px;border:2px solid ${t.border2};background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;border-radius:5px;min-width:20px;}
.chk.on{background:${t.accent};border-color:${t.accent};}
.chk-sm{width:16px;height:16px;border:1.5px solid ${t.border2};background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;border-radius:4px;min-width:16px;}
.chk-sm.on{background:${t.accent};border-color:${t.accent};}
.tab-btn{padding:10px 0;background:transparent;border:none;cursor:pointer;font-size:13px;font-weight:600;letter-spacing:.02em;transition:all .15s;border-bottom:2px solid transparent;color:${t.textMuted};margin-bottom:-1.5px;flex:1;text-align:center;}
.tab-btn.active{border-bottom-color:${t.accent};color:${t.accent};}
.stitle{font-size:13px;font-weight:700;color:${t.text};margin-bottom:8px;}
.tag-chip{display:inline-flex;align-items:center;padding:6px 11px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:all .12s;}
@media(min-width:768px){.tag-chip{padding:4px 9px;font-size:12px;border-radius:6px;}}
.sub-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${t.border};}
.link-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid ${t.border};font-size:13px;}
.drop-zone{border:2px dashed ${t.border2};padding:24px;text-align:center;font-size:14px;color:${t.textMuted};cursor:pointer;transition:all .15s;border-radius:12px;}
@media(hover:hover){.drop-zone:hover{border-color:${t.accent};color:${t.accent};background:${t.accentBg};}}
.status-menu{position:fixed;background:${t.surface};border:1px solid ${t.border2};z-index:300;min-width:185px;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden;}
.status-item{display:flex;align-items:center;gap:10px;padding:11px 14px;font-size:13px;font-weight:500;cursor:pointer;transition:background .1s;border:none;background:transparent;width:100%;text-align:left;color:${t.text};}
.status-item:active{background:${t.surface2};}
@media(hover:hover){.status-item:hover{background:${t.surface2};}}
.rbadge{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:${t.accent};background:${t.accentBg};padding:2px 7px;border-radius:4px;white-space:nowrap;font-family:'JetBrains Mono',monospace;}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:${t.surface};border-top:1px solid ${t.border};display:flex;padding-bottom:env(safe-area-inset-bottom,0px);z-index:100;}
.nav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:9px 4px 7px;cursor:pointer;border:none;background:transparent;font-size:10px;font-weight:600;letter-spacing:.04em;color:${t.textMuted};transition:color .15s;gap:3px;}
.nav-item.active{color:${t.accent};}
.desktop-layout{display:none;}
@media(min-width:768px){
  .mobile-layout{display:none !important;}
  .desktop-layout{display:flex;min-height:100vh;}
  .sidebar{width:230px;flex-shrink:0;background:${t.surface};border-right:1px solid ${t.border};display:flex;flex-direction:column;padding:20px 12px;position:sticky;top:0;height:100vh;overflow-y:auto;}
  .sidebar-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;border:none;background:transparent;font-size:14px;font-weight:500;color:${t.textSub};transition:all .15s;width:100%;text-align:left;}
  .sidebar-item:hover{background:${t.surface2};color:${t.text};}
  .sidebar-item.active{background:${t.accentBg};color:${t.accent};font-weight:600;}
  .main-content{flex:1;min-width:0;max-width:1400px;padding:24px 28px;}
}
.settings-section{background:${t.surface};border:1px solid ${t.border};border-radius:12px;overflow:hidden;margin-bottom:16px;}
.settings-row{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid ${t.border};gap:12px;}
.settings-row:last-child{border-bottom:none;}
.user-card{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid ${t.border};transition:background .12s;}
.user-card:last-child{border-bottom:none;}
@media(hover:hover){.user-card:hover{background:${t.surface2};}}
`;
}

function injectCss(dark) {
  let el = document.getElementById("app-css");
  if (!el) {
    el = document.createElement("style");
    el.id = "app-css";
    document.head.appendChild(el);
  }
  el.textContent = buildCss(dark ? DARK : LIGHT);
  document.body.style.background = dark ? DARK.bg : LIGHT.bg;
}

function Avatar({ name, size = 32 }) {
  const colors = [
    "#4f6ef7",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
  ];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: "#fff",
          fontSize: size * 0.42,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {name[0].toUpperCase()}
      </span>
    </div>
  );
}

const Chk = ({ checked, onChange, small }) => (
  <button
    className={`${small ? "chk-sm" : "chk"}${checked ? " on" : ""}`}
    onClick={onChange}
  >
    {checked && (
      <svg
        width={small ? 8 : 10}
        height={small ? 7 : 8}
        viewBox="0 0 10 8"
        fill="none"
      >
        <path
          d="M1 4L3.8 7L9 1"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </button>
);

function StatusBadge({ status, onChange, dark }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLButtonElement>(null);
  const t = dark ? DARK : LIGHT;
  const s = statusMap[status] || STATUSES[0];
  const handleClick = (e) => {
    e.stopPropagation();
    const rect = ref.current!.getBoundingClientRect();
    const menuH = STATUSES.length * 42 + 8;
    const top =
      rect.bottom + menuH > window.innerHeight
        ? rect.top - menuH - 4
        : rect.bottom + 4;
    setPos({ top, left: Math.min(rect.left, window.innerWidth - 195) });
    setOpen((o) => !o);
  };
  return (
    <>
      <button
        ref={ref}
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 9px",
          borderRadius: 6,
          border: `1px solid ${t.border2}`,
          background: t.surface2,
          color: s.color,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono',monospace",
          whiteSpace: "nowrap",
          minHeight: 28,
        }}
      >
        <span>{s.emoji}</span>
        <span>{s.label}</span>
        <span style={{ fontSize: 8, opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 299 }}
            onClick={() => setOpen(false)}
          />
          <div className="status-menu" style={{ top: pos.top, left: pos.left }}>
            {STATUSES.map((st) => (
              <button
                key={st.value}
                className="status-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(st.value);
                  setOpen(false);
                }}
              >
                <span style={{ color: st.color }}>{st.emoji}</span>
                <span
                  style={{
                    color: st.color,
                    fontWeight: status === st.value ? 700 : 500,
                  }}
                >
                  {st.label}
                </span>
                {status === st.value && (
                  <span style={{ marginLeft: "auto", color: t.accent }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Settings ──────────────────────────────────────────────
function SettingsScreen({
  users,
  setUsers,
  me,
  setMe,
  dark,
  toggleDark,
  tasks,
}) {
  const t = dark ? DARK : LIGHT;
  const [tab, setTab] = useState("users");
  const [editingUser, setEditingUser] = useState(null);
  const [addingUser, setAddingUser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPw, setEditPw] = useState("");
  const [editRole, setEditRole] = useState("member");
  const [editErr, setEditErr] = useState("");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [newErr, setNewErr] = useState("");

  // Profile form state — sync with me prop
  const [profName, setProfName] = useState(me.name);
  const [profEmail, setProfEmail] = useState(me.email);
  const [profPw, setProfPw] = useState("");
  const [profErr, setProfErr] = useState("");

  const openEdit = (u) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPw("");
    setEditRole(u.role);
    setEditErr("");
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editEmail.trim())
      return setEditErr("Name and email are required.");
    if (
      users.find((u) => u.email === editEmail.trim() && u.id !== editingUser.id)
    )
      return setEditErr("This email is already in use.");

    const updatedUser = {
      ...editingUser,
      name: editName.trim(),
      email: editEmail.trim(),
      password: editPw.trim() || editingUser.password,
      role: editRole,
    };
    await setDoc(doc(db, "users", updatedUser.id), updatedUser);
    if (me.id === editingUser.id) setMe(updatedUser);
    setEditingUser(null);
    showToast("User updated.");
  };

  const doAddUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPw.trim())
      return setNewErr("All fields are required.");
    if (users.find((u) => u.email === newEmail.trim()))
      return setNewErr("This email is already registered.");
    const u = {
      id: uid(),
      name: newName.trim(),
      email: newEmail.trim(),
      password: newPw.trim(),
      role: newRole,
    };
    await setDoc(doc(db, "users", u.id), u);
    setNewName("");
    setNewEmail("");
    setNewPw("");
    setNewRole("member");
    setNewErr("");
    setAddingUser(false);
    showToast("User added.");
  };

  const doDeleteUser = async (id) => {
    await deleteDoc(doc(db, "users", id));
    setConfirmDelete(null);
    showToast("User deleted.", "danger");
  };

  const saveProfile = async () => {
    if (!profName.trim() || !profEmail.trim())
      return setProfErr("Name and email are required.");
    if (users.find((u) => u.email === profEmail.trim() && u.id !== me.id))
      return setProfErr("This email is already in use.");

    const updatedMe = {
      ...me,
      name: profName.trim(),
      email: profEmail.trim(),
      password: profPw.trim() || me.password,
    };
    await setDoc(doc(db, "users", me.id), updatedMe);
    setMe(updatedMe);
    setProfPw("");
    setProfErr("");
    showToast("Profile updated.");
  };

  const taskCountFor = (uid) =>
    tasks.filter((t) => t.assigneeId === uid).length;
  const TABS = [
    { k: "users", l: "Users" },
    { k: "profile", l: "Profile" },
    { k: "system", l: "System" },
  ];

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 999,
            background: toast.type === "danger" ? t.danger : t.success,
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,.25)",
          }}
        >
          {toast.type === "danger" ? "🗑 " : "✓ "}
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: t.text,
            letterSpacing: "-.3px",
          }}
        >
          Settings
        </h1>
        <div
          style={{
            fontSize: 12,
            color: t.textMuted,
            fontFamily: "'JetBrains Mono',monospace",
            marginTop: 2,
          }}
        >
          Users and system settings
        </div>
      </div>

      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 20,
        }}
      >
        {TABS.map((tb) => (
          <button
            key={tb.k}
            className={`tab-btn${tab === tb.k ? " active" : ""}`}
            onClick={() => setTab(tb.k)}
          >
            {tb.l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* USERS */}
      {tab === "users" && (
        <div className="fade">
          {me.role !== "admin" && (
            <div
              style={{
                background: t.accentBg,
                border: `1px solid ${t.border2}`,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 16,
                fontSize: 13,
                color: t.textSub,
              }}
            >
              ℹ️ Admin permission required to manage users.
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: t.textMuted,
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              {users.length} users
            </span>
            {me.role === "admin" && (
              <button
                className="btn-sm"
                onClick={() => {
                  setAddingUser(true);
                  setNewErr("");
                }}
                style={{
                  background: t.accent,
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  padding: "7px 14px",
                }}
              >
                + Add User
              </button>
            )}
          </div>

          {addingUser && (
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border2}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
              className="fade"
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 14,
                }}
              >
                New User
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div>
                  <span className="lbl">Full Name</span>
                  <input
                    className="input-field"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <span className="lbl">Email</span>
                  <input
                    className="input-field"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <span className="lbl">Password</span>
                  <input
                    className="input-field"
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Set password"
                  />
                </div>
                <div>
                  <span className="lbl">Role</span>
                  <select
                    className="input-field"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {newErr && (
                  <div
                    style={{
                      fontSize: 12,
                      color: t.danger,
                      background: t.dangerBg,
                      padding: "8px 12px",
                      borderRadius: 7,
                    }}
                  >
                    {newErr}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    className="btn-primary"
                    onClick={doAddUser}
                    style={{ flex: 1 }}
                  >
                    Add
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setAddingUser(false)}
                    style={{ width: "auto", padding: "10px 16px" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-section">
            {users.map((u) => (
              <div key={u.id} className="user-card">
                <Avatar name={u.name} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: t.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {u.name}
                    {u.id === me.id && (
                      <span
                        style={{
                          fontSize: 10,
                          background: t.accentBg,
                          color: t.accent,
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontFamily: "'JetBrains Mono',monospace",
                          fontWeight: 600,
                        }}
                      >
                        Ben
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: t.textMuted,
                      fontFamily: "'JetBrains Mono',monospace",
                      marginTop: 1,
                    }}
                  >
                    {u.email}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 5,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background:
                          u.role === "admin" ? t.accentBg : t.surface2,
                        color: u.role === "admin" ? t.accent : t.textMuted,
                        fontWeight: 600,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {u.role}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: t.textMuted,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {taskCountFor(u.id)} tasks
                    </span>
                  </div>
                </div>
                {me.role === "admin" && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn-icon"
                      onClick={() => openEdit(u)}
                      style={{ color: t.accent }}
                    >
                      ✎
                    </button>
                    {u.id !== me.id && (
                      <button
                        className="btn-icon"
                        onClick={() => setConfirmDelete(u)}
                        style={{ color: t.danger }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE */}
      {tab === "profile" && (
        <div className="fade">
          <div className="settings-section" style={{ padding: 0 }}>
            <div
              style={{
                padding: "20px 16px",
                borderBottom: `1px solid ${t.border}`,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Avatar name={me.name} size={52} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
                  {me.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: t.textMuted,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {me.email}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: me.role === "admin" ? t.accentBg : t.surface2,
                    color: me.role === "admin" ? t.accent : t.textMuted,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono',monospace",
                    display: "inline-block",
                  }}
                >
                  {me.role}
                </div>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <span className="lbl">Full Name</span>
                  <input
                    className="input-field"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                  />
                </div>
                <div>
                  <span className="lbl">Email</span>
                  <input
                    className="input-field"
                    type="email"
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                  />
                </div>
                <div>
                  <span className="lbl">New Password</span>
                  <input
                    className="input-field"
                    type="password"
                    value={profPw}
                    onChange={(e) => setProfPw(e.target.value)}
                    placeholder="Enter to change (optional)"
                  />
                </div>
                {profErr && (
                  <div
                    style={{
                      fontSize: 12,
                      color: t.danger,
                      background: t.dangerBg,
                      padding: "8px 12px",
                      borderRadius: 7,
                    }}
                  >
                    {profErr}
                  </div>
                )}
                <button className="btn-primary" onClick={saveProfile}>
                  Save
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: t.textMuted,
              fontFamily: "'JetBrains Mono',monospace",
              padding: "0 4px",
            }}
          >
            // {taskCountFor(me.id)} atanmış görev
          </div>
        </div>
      )}

      {/* SYSTEM */}
      {tab === "system" && (
        <div className="fade">
          <div className="settings-section">
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Theme
                </div>
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                  Dark mode
                </div>
              </div>
              <button
                onClick={toggleDark}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: t.surface2,
                  border: `1px solid ${t.border2}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.text,
                }}
              >
                {dark ? "☀️ Light" : "🌙 Dark"}
              </button>
            </div>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Versiyon
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: t.textMuted,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                v1.0.0
              </span>
            </div>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Toplam Görev
                </div>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.accent,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {tasks.length}
              </span>
            </div>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  Kayıtlı Kullanıcı
                </div>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.accent,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {users.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div
          className="modal-bg"
          onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}
        >
          <div className="modal slide-up">
            <div
              style={{
                width: 36,
                height: 4,
                background: t.border2,
                borderRadius: 99,
                margin: "12px auto 0",
              }}
            />
            <div className="modal-inner">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={editingUser.name} size={36} />
                  <span
                    style={{ fontSize: 16, fontWeight: 700, color: t.text }}
                  >
                    Edit User
                  </span>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => setEditingUser(null)}
                >
                  ✕
                </button>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div>
                  <span className="lbl">Full Name</span>
                  <input
                    className="input-field"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <span className="lbl">Email</span>
                  <input
                    className="input-field"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div>
                  <span className="lbl">New Password</span>
                  <input
                    className="input-field"
                    type="password"
                    value={editPw}
                    onChange={(e) => setEditPw(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                  />
                </div>
                <div>
                  <span className="lbl">Role</span>
                  <select
                    className="input-field"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={editingUser.id === me.id}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {editingUser.id === me.id && (
                    <div
                      style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}
                    >
                      You cannot change your own role.
                    </div>
                  )}
                </div>
                {editErr && (
                  <div
                    style={{
                      fontSize: 12,
                      color: t.danger,
                      background: t.dangerBg,
                      padding: "8px 12px",
                      borderRadius: 7,
                    }}
                  >
                    {editErr}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    className="btn-primary"
                    onClick={saveEdit}
                    style={{ flex: 1 }}
                  >
                    Save
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setEditingUser(null)}
                    style={{ width: "auto", padding: "10px 16px" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div
          className="modal-bg"
          onClick={(e) =>
            e.target === e.currentTarget && setConfirmDelete(null)
          }
        >
          <div className="modal slide-up">
            <div
              style={{
                width: 36,
                height: 4,
                background: t.border2,
                borderRadius: 99,
                margin: "12px auto 0",
              }}
            />
            <div className="modal-inner">
              <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: t.text,
                    marginBottom: 8,
                  }}
                >
                  Delete user?
                </div>
                <div
                  style={{ fontSize: 13, color: t.textSub, lineHeight: 1.6 }}
                >
                  <strong>{confirmDelete.name}</strong> will be permanently deleted.
                  <br />
                  Assigned tasks:{" "}
                  <strong>{taskCountFor(confirmDelete.id)}</strong>{" "}
                  (tasks may be affected)
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-danger"
                  onClick={() => doDeleteUser(confirmDelete.id)}
                  style={{ flex: 1 }}
                >
                  Delete
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setConfirmDelete(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth ──────────────────────────────────────────────────
// users prop'u live state — her değişiklikte güncel liste gelir
function AuthScreen({ users, setUsers, onLogin, dark, toggleDark }) {
  const t = dark ? DARK : LIGHT;
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const doLogin = () => {
    const u = users.find((u) => u.email === email && u.password === pw);
    if (!u) return setErr("Invalid email or password.");
    onLogin(u);
  };
  const doReg = async () => {
    if (!name.trim() || !email.trim() || !pw.trim())
      return setErr("All fields are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setErr("Please enter a valid email address.");
    if (users.find((u) => u.email === email))
      return setErr("This email is already registered.");
    const u = {
      id: uid(),
      name: name.trim(),
      email: email.trim(),
      password: pw,
      role: "member",
    };
    await setDoc(doc(db, "users", u.id), u);
    onLogin(u);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <button
            onClick={toggleDark}
            style={{
              background: t.surface2,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "7px 11px",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              background: t.accent,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <rect
                x="2"
                y="2"
                width="11"
                height="11"
                rx="3"
                fill="white"
                opacity=".9"
              />
              <rect
                x="15"
                y="2"
                width="11"
                height="11"
                rx="3"
                fill="white"
                opacity=".45"
              />
              <rect
                x="2"
                y="15"
                width="11"
                height="11"
                rx="3"
                fill="white"
                opacity=".45"
              />
              <rect
                x="15"
                y="15"
                width="11"
                height="11"
                rx="3"
                fill="white"
                opacity=".9"
              />
            </svg>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 10,
              letterSpacing: ".18em",
              color: t.textMuted,
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            Evanato
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: t.text,
              letterSpacing: "-.4px",
              lineHeight: 1.1,
            }}
          >
            Task Manager
          </div>
          <div style={{ fontSize: 14, color: t.textSub, marginTop: 6 }}>
            Manage, delegate, and track tasks.
          </div>
        </div>
        <div
          style={{
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            padding: "24px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              background: t.surface2,
              borderRadius: 10,
              padding: 3,
              marginBottom: 22,
            }}
          >
            {["login", "register"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErr("");
                }}
                style={{
                  flex: 1,
                  padding: "9px",
                  border: "none",
                  borderRadius: 8,
                  background: mode === m ? t.surface : "transparent",
                  color: mode === m ? t.text : t.textMuted,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .18s",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.12)" : "none",
                }}
              >
                {m === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "register" && (
              <div>
                <span className="lbl">Full Name</span>
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <span className="lbl">Email</span>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div>
              <span className="lbl">Password</span>
              <input
                className="input-field"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) =>
                  e.key === "Enter" && (mode === "login" ? doLogin() : doReg())
                }
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
            {err && (
              <div
                style={{
                  fontSize: 13,
                  color: "#ef4444",
                  fontWeight: 500,
                  background: "#ef444420",
                  padding: "9px 12px",
                  borderRadius: 8,
                }}
              >
                {err}
              </div>
            )}
            <button
              className="btn-primary"
              style={{ marginTop: 2 }}
              onClick={mode === "login" ? doLogin : doReg}
            >
              {mode === "login" ? "Log In" : "Create Account"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────
function TaskModal({ task, users, currentUser, onSave, onClose, dark, projects, onAddProject, labels, onAddLabel, onDeleteLabel }) {
  const t = dark ? DARK : LIGHT;
  const [title, setTitle] = useState(task?.title || "");
  const [assigneeId, setAss] = useState(task?.assigneeId || currentUser.id);
  const [priority, setPri] = useState(task?.priority || "Medium");
  const [status, setStat] = useState(task?.status || "todo");
  const [due, setDue] = useState(task?.due || todayStr());
  const [note, setNote] = useState(task?.note || "");
  const [repeat, setRepeat] = useState(task?.repeat || "");
  const [tags, setTags] = useState(task?.tags || []);
  const [projectId, setProjectId] = useState(task?.projectId || "");
  const [subtasks, setSubs] = useState(task?.subtasks || []);
  const [links, setLinks] = useState(task?.links || []);
  const [files, setFiles] = useState(task?.files || []);
  const [newSub, setNewSub] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLbl, setNewLbl] = useState("");
  const [tab, setTab] = useState("basic");
  const [newProjName, setNewProjName] = useState("");
  const [newProjColor, setNewProjColor] = useState(PROJECT_COLORS[3]);
  const [addingProj, setAddingProj] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleTag = (tag) =>
    setTags((p) =>
      p.includes(tag) ? p.filter((x) => x !== tag) : [...p, tag]
    );
  const addSub = () => {
    if (!newSub.trim()) return;
    setSubs((p) => [...p, { id: uid(), text: newSub.trim(), done: false }]);
    setNewSub("");
  };
  const toggleSub = (id) =>
    setSubs((p) => p.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  const rmSub = (id) => setSubs((p) => p.filter((s) => s.id !== id));
  const addLink = () => {
    if (!newUrl.trim()) return;
    let url = newUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setLinks((p) => [...p, { id: uid(), url, label: newLbl.trim() || url }]);
    setNewUrl("");
    setNewLbl("");
  };
  const rmLink = (id) => setLinks((p) => p.filter((l) => l.id !== id));
  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) =>
      setFiles((p) => [
        ...p,
        { id: uid(), name: f.name, dataUrl: ev.target.result },
      ]);
    r.readAsDataURL(f);
  };
  const save = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      assigneeId,
      priority,
      status,
      due,
      note,
      repeat,
      tags,
      projectId,
      subtasks,
      links,
      files,
    });
  };
  const handleAddProject = async () => {
    if (!newProjName.trim()) return;
    const id = await onAddProject(newProjName, newProjColor);
    setProjectId(id);
    setAddingProj(false);
    setNewProjName("");
  };
  const TABS = [
    { k: "basic", l: "Basic" },
    { k: "sub", l: `Subtasks${subtasks.length ? ` (${subtasks.length})` : ""}` },
    {
      k: "files",
      l: `Files${
        links.length + files.length ? ` (${links.length + files.length})` : ""
      }`,
    },
  ];

  return (
    <div
      className="modal-bg"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal slide-up">
        <div
          style={{
            width: 36,
            height: 4,
            background: t.border2,
            borderRadius: 99,
            margin: "12px auto 0",
          }}
          className="mobile-layout"
        />
        <div className="modal-inner">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
              {task ? "Edit Task" : "New Task"}
            </span>
            <button className="btn-icon" onClick={onClose}>
              ✕
            </button>
          </div>
          <div
            style={{
              display: "flex",
              borderBottom: `1px solid ${t.border}`,
              marginBottom: 18,
            }}
          >
            {TABS.map((tb) => (
              <button
                key={tb.k}
                className={`tab-btn${tab === tb.k ? " active" : ""}`}
                onClick={() => setTab(tb.k)}
              >
                {tb.l.toUpperCase()}
              </button>
            ))}
          </div>
          {tab === "basic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span className="lbl">Title *</span>
                <input
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Describe the task..."
                  autoFocus
                />
              </div>
              <div>
                <span className="lbl">Status</span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStat(s.value)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "6px 10px",
                        borderRadius: 7,
                        border: `1.5px solid ${
                          status === s.value ? s.color : t.border2
                        }`,
                        background:
                          status === s.value ? s.color + "22" : t.surface2,
                        color: status === s.value ? s.color : t.textSub,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="lbl">Project</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    className="input-field"
                    value={projectId}
                    onChange={(e) => {
                      if (e.target.value === "__new__") setAddingProj(true);
                      else setProjectId(e.target.value);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">— No project —</option>
                    {(projects || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="__new__">+ New project…</option>
                  </select>
                  {projectId && (
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: (projects || []).find((p) => p.id === projectId)?.color || "#aaa", flexShrink: 0, display: "inline-block" }} />
                  )}
                </div>
                {addingProj && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, background: t.surface2, borderRadius: 10, padding: 12 }}>
                    <input className="input-sm" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="Project name…" autoFocus onKeyDown={(e) => e.key === "Enter" && handleAddProject()} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PROJECT_COLORS.map((c) => (
                        <button key={c} onClick={() => setNewProjColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: newProjColor === c ? `2px solid ${t.text}` : "2px solid transparent", cursor: "pointer" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: "8px" }} onClick={handleAddProject}>Add</button>
                      <button className="btn-secondary" style={{ padding: "8px 14px" }} onClick={() => setAddingProj(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <span className="lbl">Assignee</span>
                <select
                  className="input-field"
                  value={assigneeId}
                  onChange={(e) => setAss(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUser.id ? " (Me)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <span className="lbl">Priority</span>
                  <select
                    className="input-field"
                    value={priority}
                    onChange={(e) => setPri(e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="lbl">Due Date</span>
                  <input
                    className="input-field"
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <span className="lbl">Repeat</span>
                <select
                  className="input-field"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                >
                  {REPEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="lbl">Labels</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                  {(labels || []).map((lb: any) => (
                    <button
                      key={lb.id}
                      className="tag-chip"
                      onClick={() => toggleTag(lb.name)}
                      style={{
                        background: tags.includes(lb.name) ? lb.color + "33" : t.surface2,
                        color: tags.includes(lb.name) ? lb.color : t.textSub,
                        borderColor: tags.includes(lb.name) ? lb.color : t.border2,
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: lb.color, display: "inline-block", flexShrink: 0 }} />
                      {lb.name}
                    </button>
                  ))}
                  {(labels || []).length === 0 && (
                    <span style={{ fontSize: 11, color: t.textMuted }}>No labels yet — add from the sidebar</span>
                  )}
                </div>
              </div>
              <div>
                <span className="lbl">Notes</span>
                <textarea
                  className="input-field"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Additional notes..."
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}
          {tab === "sub" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  className="input-field"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSub()}
                  placeholder="Add subtask..."
                  style={{ flex: 1 }}
                />
                <button
                  onClick={addSub}
                  style={{
                    background: t.accent,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "0 16px",
                    fontSize: 20,
                    cursor: "pointer",
                    fontWeight: 300,
                  }}
                >
                  +
                </button>
              </div>
              {subtasks.length === 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: t.textMuted,
                    textAlign: "center",
                    padding: "28px 0",
                  }}
                >
                  No subtasks yet.
                </div>
              )}
              {subtasks.map((s) => (
                <div key={s.id} className="sub-row">
                  <Chk
                    small
                    checked={s.done}
                    onChange={() => toggleSub(s.id)}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: s.done ? t.textMuted : t.text,
                      textDecoration: s.done ? "line-through" : "none",
                    }}
                  >
                    {s.text}
                  </span>
                  <button className="btn-icon" onClick={() => rmSub(s.id)}>
                    ✕
                  </button>
                </div>
              ))}
              {subtasks.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: t.textMuted,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {subtasks.filter((s) => s.done).length}/{subtasks.length}{" "}
                  completed
                </div>
              )}
            </div>
          )}
          {tab === "files" && (
            <div>
              <div className="stitle">🔗 Add Link</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  className="input-field"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                />
                <input
                  className="input-field"
                  value={newLbl}
                  onChange={(e) => setNewLbl(e.target.value)}
                  placeholder="Label (optional)"
                />
              </div>
              <button
                className="btn-sm"
                onClick={addLink}
                style={{ marginBottom: 12 }}
              >
                + Add
              </button>
              {links.map((l) => (
                <div key={l.id} className="link-row">
                  <span>🔗</span>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      color: t.accent,
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {l.label}
                  </a>
                  <button className="btn-icon" onClick={() => rmLink(l.id)}>
                    ✕
                  </button>
                </div>
              ))}
              <div className="stitle" style={{ marginTop: 18 }}>
                📎 Upload File
              </div>
              <div
                className="drop-zone"
                onClick={() => fileRef.current!.click()}
              >
                Choose file
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={onFile}
                />
              </div>
              {files.map((f) => (
                <div key={f.id} className="link-row">
                  <span>📄</span>
                  <span
                    style={{ flex: 1, color: t.text, wordBreak: "break-all" }}
                  >
                    {f.name}
                  </span>
                  <a
                    href={f.dataUrl}
                    download={f.name}
                    style={{
                      color: t.accent,
                      textDecoration: "none",
                      marginRight: 6,
                    }}
                  >
                    ↓
                  </a>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 20,
              paddingTop: 16,
              borderTop: `1px solid ${t.border}`,
            }}
          >
            <button className="btn-primary" onClick={save} style={{ flex: 1 }}>
              Save
            </button>
            <button
              className="btn-secondary"
              onClick={onClose}
              style={{ width: "auto", padding: "10px 16px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Detail ───────────────────────────────────────────
function TaskDetail({
  task,
  users,
  onClose,
  onToggleSub,
  onStatusChange,
  dark,
  labels,
}) {
  const t = dark ? DARK : LIGHT;
  const assignee = users.find((u) => u.id === task.assigneeId);
  const owner = users.find((u) => u.id === task.ownerId);
  const repeatLabel = task.repeat
    ? REPEAT_OPTIONS.find((o) => o.value === task.repeat)?.label
    : null;
  const pri = priTokens(t, task.priority);
  return (
    <div
      className="modal-bg"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal slide-up" style={{ maxHeight: "90vh" }}>
        <div
          style={{
            width: 36,
            height: 4,
            background: t.border2,
            borderRadius: 99,
            margin: "12px auto 0",
          }}
          className="mobile-layout"
        />
        <div className="modal-inner">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: t.text,
                flex: 1,
                lineHeight: 1.4,
                paddingRight: 8,
              }}
            >
              {task.title}
            </div>
            <button className="btn-icon" onClick={onClose}>
              ✕
            </button>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <StatusBadge
              status={task.status || "todo"}
              onChange={(val) => onStatusChange(task.id, val)}
              dark={dark}
            />
            <span
              className="pill"
              style={{ background: pri.bg, color: pri.color }}
            >
              {task.priority}
            </span>
            {task.tags?.map((tag) => {
              const lc = (labels || []).find((l) => l.name === tag)?.color || (CAT_COLOR as any)[tag] || "#6b7280";
              return (
                <span key={tag} className="pill" style={{ background: lc + "33", color: lc }}>
                  {tag}
                </span>
              );
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
              padding: "12px 14px",
              background: t.surface2,
              borderRadius: 10,
            }}
          >
            <div>
              <span className="lbl">Assignee</span>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                {assignee?.name}
              </span>
            </div>
            <div>
              <span className="lbl">Owner</span>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                {owner?.name}
              </span>
            </div>
            <div>
              <span className="lbl">Due Date</span>
              <span
                style={{
                  fontSize: 13,
                  color: t.text,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {task.due}
              </span>
            </div>
            {repeatLabel && (
              <div>
                <span className="lbl">Repeat</span>
                <span className="rbadge">↻ {repeatLabel}</span>
              </div>
            )}
          </div>
          {task.note && (
            <div
              style={{
                background: t.accentBg,
                border: `1px solid ${t.border2}`,
                padding: "11px 13px",
                fontSize: 13,
                color: t.textSub,
                marginBottom: 14,
                lineHeight: 1.6,
                borderRadius: 9,
              }}
            >
              {task.note}
            </div>
          )}
          {task.subtasks?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="stitle">
                Subtasks{" "}
                <span
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11,
                    color: t.textMuted,
                    fontWeight: 400,
                  }}
                >
                  ({task.subtasks.filter((s) => s.done).length}/
                  {task.subtasks.length})
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: t.border,
                  borderRadius: 99,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: t.accent,
                    borderRadius: 99,
                    width: `${
                      task.subtasks.length
                        ? (task.subtasks.filter((s) => s.done).length /
                            task.subtasks.length) *
                          100
                        : 0
                    }%`,
                    transition: "width .3s",
                  }}
                />
              </div>
              {task.subtasks.map((s) => (
                <div key={s.id} className="sub-row">
                  <Chk
                    small
                    checked={s.done}
                    onChange={() => onToggleSub(task.id, s.id)}
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: s.done ? t.textMuted : t.text,
                      textDecoration: s.done ? "line-through" : "none",
                    }}
                  >
                    {s.text}
                  </span>
                </div>
              ))}
            </div>
          )}
          {task.links?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="stitle">Linkler</div>
              {task.links.map((l) => (
                <div key={l.id} className="link-row">
                  <span>🔗</span>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: t.accent,
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {l.label}
                  </a>
                </div>
              ))}
            </div>
          )}
          {task.files?.length > 0 && (
            <div>
              <div className="stitle">Dosyalar</div>
              {task.files.map((f) => (
                <div key={f.id} className="link-row">
                  <span>📄</span>
                  <span
                    style={{ flex: 1, color: t.text, wordBreak: "break-all" }}
                  >
                    {f.name}
                  </span>
                  <a
                    href={f.dataUrl}
                    download={f.name}
                    style={{ color: t.accent, textDecoration: "none" }}
                  >
                    ↓
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Card (Kanban) ────────────────────────────────────
function TaskCard({
  task,
  users,
  currentUser,
  onStatusChange,
  onEdit,
  onDelete,
  onDetail,
  dark,
  projects,
  labels,
}) {
  const t = dark ? DARK : LIGHT;
  const assignee = users.find((u) => u.id === task.assigneeId);
  const project = (projects || []).find((p) => p.id === task.projectId);
  const labelColor = (name: string) => (labels || []).find((l) => l.name === name)?.color || (CAT_COLOR as any)[name] || "#6b7280";
  const isOverdue =
    !["done", "cancelled"].includes(task.status) &&
    task.due &&
    task.due < todayStr();
  const subDone = task.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  const repeatLabel = task.repeat
    ? REPEAT_OPTIONS.find((o) => o.value === task.repeat)?.label
    : null;
  const attachCount = (task.links?.length || 0) + (task.files?.length || 0);
  const isDimmed = ["done", "cancelled"].includes(task.status);
  const pri = priTokens(t, task.priority);
  const statusInfo = statusMap[task.status || "todo"];
  return (
    <div
      className="task-row kanban-card"
      onClick={() => onDetail(task)}
      style={{
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 9,
        borderLeft: `3px solid ${statusInfo?.color || t.border2}`,
        minHeight: 90,
        position: "relative",
      }}
    >
      {/* Status + Priority + Labels */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        <StatusBadge
          status={task.status || "todo"}
          onChange={(val) => { onStatusChange(task.id, val); }}
          dark={dark}
        />
        <span className="pill" style={{ background: pri.bg, color: pri.color }}>
          {task.priority}
        </span>
        {task.tags?.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="pill"
            style={{
              background: labelColor(tag) + "22",
              color: labelColor(tag),
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isDimmed ? t.textMuted : t.text,
          textDecoration: isDimmed ? "line-through" : "none",
          lineHeight: 1.45,
          wordBreak: "break-word",
          flex: 1,
        }}
      >
        {task.title}
      </div>

      {/* Subtask progress */}
      {subTotal > 0 && (
        <div style={{ height: 2, background: t.border, borderRadius: 99 }}>
          <div
            style={{
              height: "100%",
              background: t.accent,
              borderRadius: 99,
              width: `${(subDone / subTotal) * 100}%`,
              transition: "width .3s",
            }}
          />
        </div>
      )}

      {/* Meta row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          fontSize: 11,
          color: t.textMuted,
          alignItems: "center",
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {assignee && (
          <Avatar name={assignee.name} size={18} />
        )}
        {task.due && (
          <span style={{ color: isOverdue ? "#ef4444" : t.textMuted }}>
            {isOverdue ? "⚠ " : ""}{task.due}
          </span>
        )}
        {subTotal > 0 && <span>{subDone}/{subTotal} sub</span>}
        {repeatLabel && <span className="rbadge">↻ {repeatLabel}</span>}
        {attachCount > 0 && <span>📎 {attachCount}</span>}

        <div style={{ marginLeft: "auto", display: "flex", gap: 1 }}>
          <button
            className="btn-icon del-btn"
            style={{ minWidth: 22, minHeight: 22, fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          >✎</button>
          <button
            className="btn-icon del-btn"
            style={{ minWidth: 22, minHeight: 22, fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          >✕</button>
        </div>
      </div>

    </div>
  );
}

// ── Task List ─────────────────────────────────────────────
function TaskList({
  vis,
  users,
  me,
  dark,
  projects,
  priF,
  setPriF,
  tagF,
  setTagF,
  statusF,
  setStatusF,
  search,
  setSearch,
  hideDone,
  setHideDone,
  onStatus,
  onEdit,
  onDelete,
  onDetail,
  onNew,
  labels,
}) {
  const t = dark ? DARK : LIGHT;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"project" | "label">("project");
  const labelColor = (name: string) => (labels || []).find((l: any) => l.name === name)?.color || (CAT_COLOR as any)[name] || "#6b7280";
  const activeCount = vis.filter((tk) => !["done", "cancelled"].includes(tk.status)).length;

  // Build groups
  const groupsMap: Record<string, { tasks: any[]; color: string; label: string }> = {};
  vis.forEach((task) => {
    let key: string;
    let label: string;
    let color: string;
    if (groupBy === "project") {
      const proj = (projects || []).find((p) => p.id === task.projectId);
      if (proj) {
        key = task.projectId;
        label = proj.name;
        color = proj.color;
      } else if (task.tags && task.tags.length > 0) {
        // fallback: no projectId assigned yet, use first tag as implicit group
        key = "tag_" + task.tags[0];
        label = task.tags[0];
        color = labelColor(task.tags[0]);
      } else {
        key = "__none__";
        label = "Unassigned";
        color = t.textMuted;
      }
    } else {
      key = task.tags && task.tags.length > 0 ? task.tags[0] : "__none__";
      label = task.tags && task.tags.length > 0 ? task.tags[0] : "Untagged";
      color = labelColor(label);
    }
    if (!groupsMap[key]) groupsMap[key] = { tasks: [], color, label };
    groupsMap[key].tasks.push(task);
  });
  const entries = Object.entries(groupsMap);

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      {/* Status filter bar */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch" as any, paddingBottom: 4, marginBottom: 12 }}>
        {[{ value: "ALL", label: "All", emoji: "·", color: t.textSub }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusF(s.value)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 11px", borderRadius: 7,
              border: `1px solid ${statusF === s.value ? s.color || t.accent : t.border}`,
              background: statusF === s.value ? (s.color ? s.color + "22" : t.accentBg) : t.surface2,
              color: statusF === s.value ? s.color || t.accent : t.textMuted,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Search + filters + new button */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input-sm" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..." style={{ flex: 1, minWidth: 120, fontSize: 14, padding: "8px 11px" }}
        />
        <select className="input-sm" value={priF} onChange={(e) => setPriF(e.target.value)} style={{ width: "auto", flexShrink: 0 }}>
          <option value="ALL">Priority</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input-sm" value={tagF} onChange={(e) => setTagF(e.target.value)} style={{ width: "auto", flexShrink: 0 }}>
          <option value="ALL">Label</option>
          {(labels || []).map((l: any) => <option key={l.id} value={l.name}>{l.name}</option>)}
        </select>
        <button onClick={onNew} style={{ flexShrink: 0, background: t.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          + New
        </button>
      </div>

      {/* Meta row: count + groupBy toggle + hide done */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", flex: 1 }}>
          {activeCount} active · {vis.length} total
        </span>
        {/* Group-by toggle */}
        <div style={{ display: "flex", background: t.surface2, borderRadius: 8, padding: 2, border: `1px solid ${t.border}` }}>
          {(["project", "label"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setGroupBy(mode)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "none",
                background: groupBy === mode ? t.accent : "transparent",
                color: groupBy === mode ? "#fff" : t.textMuted,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                textTransform: "capitalize",
              }}
            >
              {mode === "project" ? "By Project" : "By Label"}
            </button>
          ))}
        </div>
        <button className="btn-sm" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setHideDone((p) => !p)}>
          {hideDone ? "Show All" : "Hide Done/Cancelled"}
        </button>
      </div>

      {/* Grouped cards */}
      {entries.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: t.textMuted, fontSize: 14 }}>
          No tasks found.
        </div>
      ) : (
        entries.map(([key, { tasks: groupTasks, color: groupColor, label: groupLabel }]) => {
          const isCollapsed = collapsedGroups.has(key);
          return (
            <div key={key} style={{ marginBottom: 14 }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 14px",
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: isCollapsed ? 10 : "10px 10px 0 0",
                  cursor: "pointer",
                  borderLeft: `4px solid ${groupColor}`,
                }}
              >
                <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 700, color: t.text }}>{groupLabel}</span>
                <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", background: t.surface2, borderRadius: 5, padding: "2px 7px" }}>{groupTasks.length}</span>
                <span style={{ fontSize: 10, color: t.textMuted }}>{isCollapsed ? "▶" : "▼"}</span>
              </button>

              {/* Cards grid */}
              {!isCollapsed && (
                <div
                  style={{
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 8,
                  }}
                >
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      users={users}
                      currentUser={me}
                      dark={dark}
                      projects={projects}
                      labels={labels}
                      onStatusChange={onStatus}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDetail={onDetail}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [users, setUsers] = useState(INITIAL_USERS);
  const [me, setMe] = useState(null);
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [projects, setProjects] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [navTab, setNavTab] = useState("mine");
  const [filterUser, setFU] = useState("");
  const [filterProject, setFP] = useState("");
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [priF, setPriF] = useState("ALL");
  const [tagF, setTagF] = useState("ALL");
  const [statusF, setStatusF] = useState("ALL");
  const [search, setSearch] = useState("");
  const [hideDone, setHideDone] = useState(false);

  useEffect(() => { const s = localStorage.getItem('evanato_dark'); if (s !== null) setDark(s === '1'); }, []);
  useEffect(() => { try { const s = localStorage.getItem('evanato_session'); if (s) { const session = JSON.parse(s); if (session.expires > Date.now()) setMe(session.user as any); else localStorage.removeItem('evanato_session'); } } catch {} }, []);

  injectCss(dark);

  // Firebase: ilk yukleme
  useEffect(() => {
    const init = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      if (usersSnap.empty) {
        for (const u of INITIAL_USERS) {
          await setDoc(doc(db, "users", u.id), u);
        }
      }
      const tasksSnap = await getDocs(collection(db, "tasks"));
      if (tasksSnap.empty) {
        for (const tk of SEED_TASKS) {
          await setDoc(doc(db, "tasks", tk.id), tk);
        }
      }
    };
    init();
  }, []);

  // Firebase: users okuma
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      if (!snap.empty) {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
      }
    });
    return () => unsub();
  }, []);

  // Firebase: tasks okuma
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "tasks"), (snap) => {
      if (!snap.empty) {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
      }
    });
    return () => unsub();
  }, []);

  // Firebase: projects (per-user)
  useEffect(() => {
    if (!me) { setProjects([]); return; }
    const q = query(collection(db, "projects"), where("ownerId", "==", me.id));
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
    });
    return () => unsub();
  }, [(me as any)?.id]);

  const addProject = async (name: string, color: string) => {
    const p = { id: uid(), name: name.trim(), color, ownerId: me.id, createdAt: Date.now() };
    await setDoc(doc(db, "projects", p.id), p);
    return p.id;
  };
  const deleteProject = async (pid: string) => {
    await deleteDoc(doc(db, "projects", pid));
  };
  const renameProject = async (pid: string, oldName: string) => {
    const name = prompt("New project name:", oldName);
    if (!name?.trim() || name.trim() === oldName) return;
    const proj = projects.find((p) => p.id === pid);
    if (proj) await setDoc(doc(db, "projects", pid), { ...proj, name: name.trim() });
  };

  // Firebase: labels (per-user)
  useEffect(() => {
    if (!me) { setLabels([]); return; }
    const q = query(collection(db, "labels"), where("ownerId", "==", me.id));
    const unsub = onSnapshot(q, (snap) => {
      setLabels(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
    });
    return () => unsub();
  }, [(me as any)?.id]);

  const addLabel = async (name: string, color: string) => {
    const l = { id: uid(), name: name.trim(), color, ownerId: me.id, createdAt: Date.now() };
    await setDoc(doc(db, "labels", l.id), l);
    return l.id;
  };
  const deleteLabel = async (lid: string) => {
    await deleteDoc(doc(db, "labels", lid));
  };
  const renameLabel = async (lid: string, oldName: string) => {
    const name = prompt("New label name:", oldName);
    if (!name?.trim() || name.trim() === oldName) return;
    const lbl = labels.find((l) => l.id === lid);
    if (lbl) await setDoc(doc(db, "labels", lid), { ...lbl, name: name.trim() });
  };
  const t = dark ? DARK : LIGHT;
  const toggleDark = () => setDark((d) => { const n = !d; localStorage.setItem('evanato_dark', n ? '1' : '0'); return n; });

  // Logout: clear session
  const handleLogout = () => { localStorage.removeItem('evanato_session'); setMe(null); };

  // Login: persist session for 30 days
  const handleLogin = (u) => { const s = { user: u, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 }; localStorage.setItem('evanato_session', JSON.stringify(s)); setMe(u); };

  if (!me)
    return (
      <AuthScreen
        users={users} // live state — her güncellemede yeni liste gelir
        setUsers={setUsers}
        onLogin={handleLogin}
        dark={dark}
        toggleDark={toggleDark}
      />
    );

  const nextDue = (task) => {
    const d = task.due || todayStr();
    if (task.repeat === "daily") return addDays(d, 1);
    if (task.repeat === "weekly") return addWeeks(d, 1);
    if (task.repeat === "biweekly") return addWeeks(d, 2);
    if (task.repeat === "monthly") return addMonths(d, 1);
    return d;
  };
  const handleSave = async (data) => {
    if (!modal || modal === "new") {
      const newTask = { id: uid(), ownerId: me.id, createdAt: Date.now(), ...data };
      await setDoc(doc(db, "tasks", newTask.id), newTask);
    } else {
      await setDoc(doc(db, "tasks", (modal as any).id), { ...(modal as any), ...data });
    }
    setModal(null);
  };
  const changeStatus = async (id, val) => {
    const task = tasks.find((tk) => tk.id === id);
    if (!task) return;
    await setDoc(doc(db, "tasks", id), { ...task, status: val });
    if (val === "done" && task.repeat) {
      const newTask = {
        ...task,
        id: uid(),
        status: "todo",
        createdAt: Date.now(),
        due: nextDue(task),
        subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
      };
      await setDoc(doc(db, "tasks", newTask.id), newTask);
    }
    setDetail((prev) => (prev?.id === id ? { ...prev, status: val } : prev));
  };
  const toggleSub = async (tid, sid) => {
    const task = tasks.find((tk) => tk.id === tid);
    if (!task) return;
    const updated = {
      ...task,
      subtasks: task.subtasks.map((s) =>
        s.id === sid ? { ...s, done: !s.done } : s
      ),
    };
    await setDoc(doc(db, "tasks", tid), updated);
    setDetail((prev) =>
      prev?.id === tid
        ? {
            ...prev,
            subtasks: prev.subtasks.map((s) =>
              s.id === sid ? { ...s, done: !s.done } : s
            ),
          }
        : prev
    );
  };
  const delTask = async (id) => {
    await deleteDoc(doc(db, "tasks", id));
    if (detail?.id === id) setDetail(null);
  };

  let vis = tasks;
  if (navTab === "mine") vis = tasks.filter((tk) => tk.assigneeId === me.id);
  else if (navTab === "delegated")
    vis = tasks.filter((tk) => tk.ownerId === me.id && tk.assigneeId !== me.id);
  else if (navTab === "people" && filterUser)
    vis = tasks.filter((tk) => tk.assigneeId === filterUser);
  else if (navTab === "project" && filterProject) {
    const proj = projects.find((p) => p.id === filterProject);
    vis = tasks.filter((tk) =>
      tk.projectId === filterProject ||
      (!tk.projectId && proj && tk.tags?.includes(proj.name))
    );
  }
  if (priF !== "ALL") vis = vis.filter((tk) => tk.priority === priF);
  if (tagF !== "ALL") vis = vis.filter((tk) => tk.tags?.includes(tagF));
  if (statusF !== "ALL")
    vis = vis.filter((tk) => (tk.status || "todo") === statusF);
  if (search.trim())
    vis = vis.filter((tk) =>
      tk.title.toLowerCase().includes(search.toLowerCase())
    );
  if (hideDone)
    vis = vis.filter((tk) => !["done", "cancelled"].includes(tk.status));
  const statusOrder = {
    todo: 0,
    inprogress: 1,
    review: 2,
    done: 3,
    cancelled: 4,
  };
  vis = [...vis].sort((a, b) => {
    const sa = statusOrder[a.status || "todo"] ?? 0,
      sb = statusOrder[b.status || "todo"] ?? 0;
    if (sa !== sb) return sa - sb;
    return (
      ({ High: 0, Medium: 1, Low: 2 }[a.priority] ?? 1) -
      ({ High: 0, Medium: 1, Low: 2 }[b.priority] ?? 1)
    );
  });

  const SIDEBAR_NAV = [
    { k: "mine", label: "My Tasks", icon: "⊡" },
    { k: "delegated", label: "Delegated", icon: "⇢" },
    { k: "people", label: "By Person", icon: "⊕" },
    { k: "settings", label: "Settings", icon: "⚙" },
  ];
  const MOB_NAV = [
    { k: "mine", icon: "⊡", label: "My Tasks" },
    { k: "delegated", icon: "⇢", label: "Delegated" },
    { k: "people", icon: "⊕", label: "By Person" },
    { k: "settings", icon: "⚙", label: "Settings" },
  ];
  const activeProject = projects.find((p) => p.id === filterProject);
  const pageTitle: Record<string, string> = {
    mine: "My Tasks",
    delegated: "Delegated",
    people: "By Person",
    project: activeProject ? activeProject.name : "All Tasks",
    settings: "Settings",
  };

  const listProps = {
    vis,
    users,
    me,
    dark,
    projects,
    labels,
    priF,
    setPriF,
    tagF,
    setTagF,
    statusF,
    setStatusF,
    search,
    setSearch,
    hideDone,
    setHideDone,
    onStatus: changeStatus,
    onEdit: (tk) => setModal(tk),
    onDelete: delTask,
    onDetail: setDetail,
    onNew: () => setModal("new"),
  };
  // setMe burada da geçiliyor — ayarlardan profil güncellenince me güncellenir
  const settingsProps = { users, setUsers, me, setMe, dark, toggleDark, tasks };

  return (
    <>
      {/* DESKTOP */}
      <div className="desktop-layout">
        <div className="sidebar">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 28,
              paddingLeft: 4,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: t.accent,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <rect
                  x="2"
                  y="2"
                  width="11"
                  height="11"
                  rx="3"
                  fill="white"
                  opacity=".9"
                />
                <rect
                  x="15"
                  y="2"
                  width="11"
                  height="11"
                  rx="3"
                  fill="white"
                  opacity=".45"
                />
                <rect
                  x="2"
                  y="15"
                  width="11"
                  height="11"
                  rx="3"
                  fill="white"
                  opacity=".45"
                />
                <rect
                  x="15"
                  y="15"
                  width="11"
                  height="11"
                  rx="3"
                  fill="white"
                  opacity=".9"
                />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 9,
                  color: t.textMuted,
                  letterSpacing: ".15em",
                  textTransform: "uppercase",
                }}
              >
                Evanato
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: t.text,
                  lineHeight: 1,
                }}
              >
                Task Manager
              </div>
            </div>
          </div>
          {SIDEBAR_NAV.map((n) => (
            <button
              key={n.k}
              className={`sidebar-item${navTab === n.k && n.k !== "project" ? " active" : ""}`}
              onClick={() => { setNavTab(n.k); setFP(""); }}
            >
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}

          {/* Projects section — always visible */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: ".1em", textTransform: "uppercase", padding: "0 12px", marginBottom: 4 }}>Projects</div>
            {projects.map((p) => (
              <button
                key={p.id}
                className={`sidebar-item${navTab === "project" && filterProject === p.id ? " active" : ""}`}
                onClick={() => { setNavTab("project"); setFP(p.id); }}
                style={{ gap: 8 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); renameProject(p.id, p.name); }}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "0 2px", fontSize: 11, opacity: 0, transition: "opacity .12s" }}
                  className="del-btn"
                  title="Rename"
                >✎</button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete project "${p.name}"?`)) deleteProject(p.id); }}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "0 2px", fontSize: 11, opacity: 0, transition: "opacity .12s" }}
                  className="del-btn"
                  title="Delete"
                >✕</button>
                <span style={{ fontSize: 10, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
                  {tasks.filter((tk) => tk.projectId === p.id || (!tk.projectId && tk.tags?.includes(p.name))).length}
                </span>
              </button>
            ))}
          </div>

          {/* Labels section — collapsed by default */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setLabelsOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "0 12px", marginBottom: 4 }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: ".1em", textTransform: "uppercase", flex: 1, textAlign: "left" }}>Labels</span>
              <span style={{ fontSize: 10, color: t.textMuted, transition: "transform .15s", display: "inline-block", transform: labelsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
            </button>
            {labelsOpen && labels.map((lb: any) => (
              <div
                key={lb.id}
                className="sidebar-item"
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "default" }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: lb.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ flex: 1, fontSize: 13, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lb.name}</span>
                <button
                  onClick={() => renameLabel(lb.id, lb.name)}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "0 2px", fontSize: 11 }}
                  className="del-btn"
                  title="Rename"
                >✎</button>
                <button
                  onClick={() => { if (window.confirm(`Delete label "${lb.name}"?`)) deleteLabel(lb.id); }}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", padding: "0 2px", fontSize: 11 }}
                  className="del-btn"
                  title="Delete"
                >✕</button>
              </div>
            ))}
            {labelsOpen && labels.length === 0 && (
              <div style={{ fontSize: 11, color: t.textMuted, padding: "4px 12px" }}>No labels yet</div>
            )}
          </div>

          {/* Combined Add button */}
          <div style={{ marginTop: 8, padding: "0 0" }}>
            {addPickerOpen ? (
              <div style={{ display: "flex", gap: 6, padding: "4px 8px", alignItems: "center" }}>
                <button
                  onClick={async () => {
                    const name = prompt("Project name:");
                    if (!name?.trim()) { setAddPickerOpen(false); return; }
                    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
                    const id = await addProject(name, color);
                    setNavTab("project"); setFP(id); setAddPickerOpen(false);
                  }}
                  style={{ flex: 1, background: t.accent, color: "#fff", border: "none", borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >Project</button>
                <button
                  onClick={async () => {
                    const name = prompt("Label name:");
                    if (!name?.trim()) { setAddPickerOpen(false); return; }
                    const color = PROJECT_COLORS[(projects.length + labels.length) % PROJECT_COLORS.length];
                    await addLabel(name, color);
                    setLabelsOpen(true); setAddPickerOpen(false);
                  }}
                  style={{ flex: 1, background: t.surface2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 7, padding: "6px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >Label</button>
                <button
                  onClick={() => setAddPickerOpen(false)}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                >✕</button>
              </div>
            ) : (
              <button
                className="sidebar-item"
                onClick={() => setAddPickerOpen(true)}
                style={{ color: t.textMuted, fontSize: 12 }}
              >
                <span style={{ fontSize: 14 }}>+</span>
                <span>Add</span>
              </button>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: "12px",
              background: t.surface2,
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <Avatar name={me.name} size={28} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {me.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: t.textMuted,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {me.role}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn-sm"
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 11,
                  padding: "5px 8px",
                }}
                onClick={handleLogout}
              >
                Log Out
              </button>
              <button
                onClick={toggleDark}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border2}`,
                  borderRadius: 7,
                  padding: "5px 9px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {dark ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </div>
        <div className="main-content">
          <div style={{ marginBottom: 20 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.text,
                letterSpacing: "-.3px",
              }}
            >
              {pageTitle[navTab]}
            </h1>
            <div
              style={{
                fontSize: 12,
                color: t.textMuted,
                fontFamily: "'JetBrains Mono',monospace",
                marginTop: 2,
              }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
          {navTab === "people" && (
            <div style={{ marginBottom: 14 }}>
              <select
                className="input-sm"
                value={filterUser}
                onChange={(e) => setFU(e.target.value)}
                style={{ maxWidth: 260 }}
              >
                <option value="">— Show everyone —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {navTab === "settings" ? (
            <SettingsScreen {...settingsProps} />
          ) : (
            <TaskList {...listProps} />
          )}
        </div>
      </div>

      {/* MOBILE */}
      <div
        className="mobile-layout"
        style={{ minHeight: "100vh", paddingBottom: 72 }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: t.bg,
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px 10px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 9,
                  letterSpacing: ".18em",
                  color: t.textMuted,
                  textTransform: "uppercase",
                }}
              >
                Evanato
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: t.text,
                  letterSpacing: "-.3px",
                  lineHeight: 1.1,
                }}
              >
                {pageTitle[navTab]}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={toggleDark}
                style={{
                  background: t.surface2,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                {dark ? "☀️" : "🌙"}
              </button>
              <div
                onClick={handleLogout}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: t.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {me.name[0]}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 14px 0" }}>
          {navTab === "people" && (
            <div style={{ marginBottom: 12 }}>
              <select
                className="input-field"
                value={filterUser}
                onChange={(e) => setFU(e.target.value)}
              >
                <option value="">— Show everyone —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {navTab === "settings" ? (
            <div style={{ paddingTop: 6 }}>
              <SettingsScreen {...settingsProps} />
            </div>
          ) : (
            <TaskList {...listProps} />
          )}
        </div>
        <div className="bottom-nav">
          {MOB_NAV.map((n) => (
            <button
              key={n.k}
              className={`nav-item${navTab === n.k ? " active" : ""}`}
              onClick={() => setNavTab(n.k)}
            >
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
          {navTab !== "settings" && (
            <button
              onClick={() => setModal("new")}
              style={{
                position: "absolute",
                bottom: "calc(100% + 10px)",
                right: 16,
                width: 48,
                height: 48,
                borderRadius: 14,
                background: t.accent,
                border: "none",
                color: "#fff",
                fontSize: 24,
                fontWeight: 300,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 16px ${t.accent}55`,
              }}
            >
              +
            </button>
          )}
        </div>
      </div>

      {modal && (
        <TaskModal
          task={modal === "new" ? null : modal}
          users={users}
          currentUser={me}
          onSave={handleSave}
          onClose={() => setModal(null)}
          dark={dark}
          projects={projects}
          onAddProject={addProject}
          labels={labels}
          onAddLabel={addLabel}
          onDeleteLabel={deleteLabel}
        />
      )}
      {detail && (
        <TaskDetail
          task={detail}
          users={users}
          onClose={() => setDetail(null)}
          onToggleSub={toggleSub}
          onStatusChange={changeStatus}
          dark={dark}
          labels={labels}
        />
      )}
    </>
  );
}
