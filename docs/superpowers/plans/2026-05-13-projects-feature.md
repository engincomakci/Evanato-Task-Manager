# Projects Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Projects layer so multiple tasks can be grouped under named, color-coded projects with sidebar navigation and per-user visibility rules.

**Architecture:** A new `projects` Firestore collection stores project metadata; tasks get a `projectIds: string[]` field. Visibility is computed client-side: a user sees a project if they own it or have a task assigned to them in it. The existing `TaskList` component gains a `groupByProject` mode; the sidebar gains a "Projeler" section below the existing nav.

**Tech Stack:** React 18, TypeScript, Firebase Firestore, single-file `src/App.tsx`

---

## File Map

| File | Change |
|---|---|
| `src/App.tsx` | All changes — constants, state, Firebase, UI |

No new files needed. All additions are in `src/App.tsx`.

---

## Task 1: Add `PROJECT_COLORS` constant and `projects` Firebase state

**Files:**
- Modify: `src/App.tsx` — near line 28, alongside `CATEGORIES` / `CAT_COLOR`

- [ ] **Step 1: Add PROJECT_COLORS constant**

Find the line `const CATEGORIES = [...]` and add directly above it:

```ts
const PROJECT_COLORS = [
  "#3b82f6", "#8b5cf6", "#ef4444", "#10b981",
  "#f59e0b", "#0ea5e9", "#f97316", "#ec4899",
];
```

- [ ] **Step 2: Add `projects` state to App component**

Find `const [tasks, setTasks] = useState(SEED_TASKS);` and add below it:

```ts
const [projects, setProjects] = useState<any[]>([]);
```

- [ ] **Step 3: Add Firebase onSnapshot listener for projects**

Find the `// Firebase: tasks okuma` useEffect block and add a new useEffect directly after it:

```ts
// Firebase: projects okuma
useEffect(() => {
  const unsub = onSnapshot(collection(db, "projects"), (snap) => {
    setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any);
  });
  return () => unsub();
}, []);
```

- [ ] **Step 4: Commit**

```bash
cd /tmp/Evanato-Task-Manager
git add src/App.tsx
git commit -m "feat: add projects state and Firebase listener"
```

---

## Task 2: Add `createProject` and `deleteProject` functions

**Files:**
- Modify: `src/App.tsx` — inside App component, near `delTask`

- [ ] **Step 1: Add `createProject` function**

Find `const delTask = async (id) => {` and add directly before it:

```ts
const createProject = async (name: string, color: string) => {
  const p = { id: uid(), name, color, createdAt: Date.now(), ownerId: me.id };
  setProjects((prev) => [...prev, p]);
  await setDoc(doc(db, "projects", p.id), p);
};
```

- [ ] **Step 2: Add `deleteProject` function**

Add directly after `createProject`:

```ts
const deleteProject = async (pid: string) => {
  setProjects((prev) => prev.filter((p) => p.id !== pid));
  await deleteDoc(doc(db, "projects", pid));
  const affected = tasks.filter((tk) => tk.projectIds?.includes(pid));
  for (const tk of affected) {
    const updated = { ...tk, projectIds: tk.projectIds.filter((x) => x !== pid) };
    setTasks((prev) => prev.map((t) => (t.id === tk.id ? updated : t)));
    await setDoc(doc(db, "tasks", tk.id), updated);
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add createProject and deleteProject with cascade cleanup"
```

---

## Task 3: Add `projectIds` to task data model and `TaskModal`

**Files:**
- Modify: `src/App.tsx` — `mkTask` default + `TaskModal` component

- [ ] **Step 1: Add `projectIds` default to `mkTask`**

Find:
```ts
  subtasks: [],
```
(inside the `mkTask` function defaults, around line 75). Add below it:
```ts
  projectIds: [],
```

- [ ] **Step 2: Add `projects` prop to `TaskModal` signature**

Find:
```ts
function TaskModal({ task, users, currentUser, onSave, onClose, dark }) {
```
Change to:
```ts
function TaskModal({ task, users, currentUser, onSave, onClose, dark, projects = [] }) {
```

- [ ] **Step 3: Add `projectIds` state inside TaskModal**

Find `const [subtasks, setSubs] = useState(task?.subtasks || []);` and add below it:
```ts
const [projectIds, setProjectIds] = useState<string[]>(task?.projectIds || []);
```

- [ ] **Step 4: Include `projectIds` in the `save()` call**

Find inside the `save` function:
```ts
      subtasks,
      links,
      files,
```
Add `projectIds,` to the object so it reads:
```ts
      subtasks,
      links,
      files,
      projectIds,
```

- [ ] **Step 5: Add project multi-select UI in "Temel" tab**

Find the `<div>` containing `<span className="lbl">Not</span>` (the note textarea block) and add directly before it:

```tsx
{projects.length > 0 && (
  <div style={{ marginBottom: 14 }}>
    <span className="lbl">Projeler</span>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {projects.map((p) => {
        const active = projectIds.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              setProjectIds((prev) =>
                active ? prev.filter((x) => x !== p.id) : [...prev, p.id]
              )
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 11px",
              borderRadius: 8,
              border: `1px solid ${active ? p.color : t.border}`,
              background: active ? p.color + "22" : t.surface2,
              color: active ? p.color : t.textSub,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: p.color,
                flexShrink: 0,
              }}
            />
            {p.name}
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 6: Pass `projects` to TaskModal from App**

Find:
```tsx
        <TaskModal
          task={modal === "new" ? null : modal}
          users={users}
          currentUser={me}
          onSave={handleSave}
          onClose={() => setModal(null)}
          dark={dark}
        />
```
Add `projects={visibleProjects}` (defined in Task 5 below):
```tsx
        <TaskModal
          task={modal === "new" ? null : modal}
          users={users}
          currentUser={me}
          onSave={handleSave}
          onClose={() => setModal(null)}
          dark={dark}
          projects={visibleProjects}
        />
```

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add projectIds to task model and project picker in TaskModal"
```

---

## Task 4: Add `selectedProject` state + "Tüm Görevler" nav tab

**Files:**
- Modify: `src/App.tsx` — App state + SIDEBAR_NAV + pageTitle + vis filtering

- [ ] **Step 1: Add `selectedProject` state**

Find `const [hideDone, setHideDone] = useState(false);` and add below it:
```ts
const [selectedProject, setSelectedProject] = useState<string | null>(null);
```

- [ ] **Step 2: Add "Tüm Görevler" to SIDEBAR_NAV**

Find:
```ts
  const SIDEBAR_NAV = [
    { k: "mine", label: "Görevlerim", icon: "⊡" },
```
Change to:
```ts
  const SIDEBAR_NAV = [
    { k: "all", label: "Tüm Görevler", icon: "⊞" },
    { k: "mine", label: "Görevlerim", icon: "⊡" },
```

- [ ] **Step 3: Add "all" to MOB_NAV**

Find:
```ts
  const MOB_NAV = [
    { k: "mine", icon: "⊡", label: "Görevlerim" },
```
Change to:
```ts
  const MOB_NAV = [
    { k: "all", icon: "⊞", label: "Tümü" },
    { k: "mine", icon: "⊡", label: "Görevlerim" },
```

- [ ] **Step 4: Add "all" and project to pageTitle**

Find `const pageTitle = {` and add `all` and `project` entries:
```ts
  const pageTitle = {
    all: "Tüm Görevler",
    mine: "Görevlerim",
    delegated: "Delege Ettiklerim",
    people: "Kişiye Göre",
    settings: "Ayarlar",
  };
```

- [ ] **Step 5: Clear selectedProject when a nav tab is clicked**

Find both places where `onClick={() => setNavTab(n.k)}` is used (sidebar + mobile nav) and change them to:
```ts
onClick={() => { setNavTab(n.k); setSelectedProject(null); }}
```

- [ ] **Step 6: Add "all" branch to `vis` filtering**

Find:
```ts
  let vis = tasks;
  if (navTab === "mine") vis = tasks.filter((tk) => tk.assigneeId === me.id);
  else if (navTab === "delegated")
    vis = tasks.filter((tk) => tk.ownerId === me.id && tk.assigneeId !== me.id);
  else if (navTab === "people" && filterUser)
    vis = tasks.filter((tk) => tk.assigneeId === filterUser);
```
Change to:
```ts
  let vis = tasks;
  if (selectedProject) {
    vis = tasks.filter((tk) => tk.projectIds?.includes(selectedProject));
  } else if (navTab === "mine") {
    vis = tasks.filter((tk) => tk.assigneeId === me.id);
  } else if (navTab === "delegated") {
    vis = tasks.filter((tk) => tk.ownerId === me.id && tk.assigneeId !== me.id);
  } else if (navTab === "people" && filterUser) {
    vis = tasks.filter((tk) => tk.assigneeId === filterUser);
  }
```

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add selectedProject state and Tüm Görevler nav tab"
```

---

## Task 5: Sidebar Projeler section + create project modal

**Files:**
- Modify: `src/App.tsx` — App state + sidebar JSX + modal JSX

- [ ] **Step 1: Add `visibleProjects` computed value**

Find `const listProps = {` and add directly before it:
```ts
  const visibleProjects = projects.filter(
    (p) =>
      p.ownerId === me.id ||
      tasks.some((tk) => tk.projectIds?.includes(p.id) && tk.assigneeId === me.id)
  );
```

- [ ] **Step 2: Add create-project modal state**

Find `const [selectedProject, setSelectedProject] = useState<string | null>(null);` and add below it:
```ts
const [showNewProject, setShowNewProject] = useState(false);
const [newProjectName, setNewProjectName] = useState("");
const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
```

- [ ] **Step 3: Add project create handler**

Find `const handleLogout = () => setMe(null);` and add below it:
```ts
const handleCreateProject = async () => {
  if (!newProjectName.trim()) return;
  await createProject(newProjectName.trim(), newProjectColor);
  setNewProjectName("");
  setNewProjectColor(PROJECT_COLORS[0]);
  setShowNewProject(false);
};
```

- [ ] **Step 4: Add Projeler section to the desktop sidebar**

Find the line `<div style={{ flex: 1 }} />` inside `<div className="sidebar">` and add directly before it:

```tsx
          {/* Projeler bölümü */}
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: t.textMuted,
                }}
              >
                Projeler
              </span>
              <button
                className="btn-icon"
                style={{ fontSize: 16, color: t.textMuted }}
                onClick={() => setShowNewProject(true)}
              >
                +
              </button>
            </div>
            {visibleProjects.map((p) => (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center" }}
              >
                <button
                  className={`sidebar-item${selectedProject === p.id ? " active" : ""}`}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setSelectedProject(p.id);
                    setNavTab("all");
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: p.color,
                      flexShrink: 0,
                    }}
                  />
                  <span>{p.name}</span>
                </button>
                <button
                  className="btn-icon"
                  style={{ fontSize: 12, color: t.textMuted, paddingRight: 8 }}
                  onClick={() => {
                    if (window.confirm(`"${p.name}" projesini silmek istiyor musun?`))
                      deleteProject(p.id);
                    if (selectedProject === p.id) setSelectedProject(null);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {visibleProjects.length === 0 && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 12,
                  color: t.textMuted,
                }}
              >
                Henüz proje yok.
              </div>
            )}
          </div>
```

- [ ] **Step 5: Add create project modal JSX**

Find the closing `{detail && (` modal block and add a new modal directly before it:

```tsx
      {showNewProject && (
        <div
          className="modal-bg"
          onClick={(e) => e.target === e.currentTarget && setShowNewProject(false)}
        >
          <div className="modal slide-up">
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
                  Yeni Proje
                </span>
                <button className="btn-icon" onClick={() => setShowNewProject(false)}>
                  ✕
                </button>
              </div>
              <span className="lbl">Proje Adı</span>
              <input
                className="input-field"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="Proje adı..."
                autoFocus
                style={{ marginBottom: 16 }}
              />
              <span className="lbl">Renk</span>
              <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 20 }}>
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProjectColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c,
                      border: newProjectColor === c ? `3px solid ${t.text}` : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={handleCreateProject} style={{ flex: 1 }}>
                  Kaydet
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowNewProject(false)}
                  style={{ width: "auto", padding: "10px 16px" }}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add sidebar Projeler section and create project modal"
```

---

## Task 6: Task list grouping in "Tüm Görevler" view

**Files:**
- Modify: `src/App.tsx` — `TaskList` component + `listProps`

- [ ] **Step 1: Add `groupByProject` and `projects` props to `TaskList`**

Find:
```ts
function TaskList({
  vis,
  users,
  me,
  dark,
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
}) {
```
Change to:
```ts
function TaskList({
  vis,
  users,
  me,
  dark,
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
  groupByProject = false,
  projects = [],
}) {
```

- [ ] **Step 2: Add grouped rendering inside TaskList**

Find inside TaskList, the block that starts with:
```tsx
      <div
        style={{
          background: t.surface,
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          overflow: "hidden",
        }}
      >
        {vis.length === 0 && (
```
Replace the entire `<div>` through to its closing (which ends after `{vis.map(...)}`):
```tsx
      {groupByProject ? (
        <>
          {projects
            .filter((p) => vis.some((tk) => tk.projectIds?.includes(p.id)))
            .map((p) => {
              const group = vis.filter((tk) => tk.projectIds?.includes(p.id));
              return (
                <div key={p.id} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 6,
                      paddingLeft: 2,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: p.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: t.textSub,
                        letterSpacing: ".02em",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: t.textMuted,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {group.length}
                    </span>
                  </div>
                  <div
                    style={{
                      background: t.surface,
                      borderRadius: 12,
                      border: `1px solid ${t.border}`,
                      overflow: "hidden",
                    }}
                  >
                    {group.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        users={users}
                        currentUser={me}
                        dark={dark}
                        onStatusChange={onStatus}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onDetail={onDetail}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          {vis.filter((tk) => !tk.projectIds?.length).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: t.border2,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.textSub,
                    letterSpacing: ".02em",
                  }}
                >
                  Genel
                </span>
              </div>
              <div
                style={{
                  background: t.surface,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  overflow: "hidden",
                }}
              >
                {vis
                  .filter((tk) => !tk.projectIds?.length)
                  .map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      users={users}
                      currentUser={me}
                      dark={dark}
                      onStatusChange={onStatus}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDetail={onDetail}
                    />
                  ))}
              </div>
            </div>
          )}
          {vis.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: t.textMuted,
                fontSize: 14,
              }}
            >
              Görev bulunamadı.
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            background: t.surface,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            overflow: "hidden",
          }}
        >
          {vis.length === 0 && (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: t.textMuted,
                fontSize: 14,
              }}
            >
              Görev bulunamadı.
            </div>
          )}
          {vis.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              users={users}
              currentUser={me}
              dark={dark}
              onStatusChange={onStatus}
              onEdit={onEdit}
              onDelete={onDelete}
              onDetail={onDetail}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 3: Pass `groupByProject` and `projects` through `listProps`**

Find `const listProps = {` and add two new entries before the closing `};`:
```ts
    groupByProject: navTab === "all" && !selectedProject,
    projects: visibleProjects,
```

- [ ] **Step 4: Update page title when a project is selected**

Find the heading that renders `{pageTitle[navTab]}` (there are two — desktop and mobile) and change each to:
```tsx
{selectedProject
  ? visibleProjects.find((p) => p.id === selectedProject)?.name ?? "Proje"
  : pageTitle[navTab]}
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: group tasks by project in Tüm Görevler view"
```

---

## Task 7: Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Verify Vercel deployment**

Wait ~2 minutes for Vercel to build. Open `https://evanato-task-manager.vercel.app/` and verify:
- "Tüm Görevler" tab is visible in sidebar
- "Projeler" section appears in sidebar with "+" button
- Creating a project shows it in the sidebar with the chosen color
- Editing a task shows the project multi-select in the "Temel" tab
- Assigning a task to a project causes it to appear under that project's group in "Tüm Görevler"
- Selecting a project in the sidebar filters to that project's tasks
- Deleting a project removes it and clears `projectIds` from affected tasks
- A second user only sees projects they own or have tasks assigned to them in
