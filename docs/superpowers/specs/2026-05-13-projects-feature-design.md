# Projects Feature Design

**Date:** 2026-05-13  
**Status:** Approved

## Summary

Add a Projects layer to the task manager so that multiple tasks can be grouped under a named project. Users see only projects they own or have tasks assigned to them in.

---

## Data Model

### New: `projects` Firestore collection

```
{
  id: string,
  name: string,
  color: string,       // one of 8-10 fixed palette values
  createdAt: number,
  ownerId: string      // user who created the project
}
```

### Updated: `tasks` documents

Add `projectIds: string[]` (default `[]`). Existing tasks initialize with `[]` automatically — no migration needed.

**Fixed color palette (8 colors):**
`#3b82f6`, `#8b5cf6`, `#ef4444`, `#10b981`, `#f59e0b`, `#0ea5e9`, `#f97316`, `#ec4899`

---

## Visibility Rules

A user sees a project in their sidebar if **either**:
1. They are the `ownerId` of that project, **or**
2. At least one task in that project has `assigneeId === user.id`

Visibility is computed client-side by filtering the `projects` list against the loaded `tasks`.

---

## UI Changes

### Left Sidebar

- Add a "Projeler" section below the existing "Benim / Delege / Kişiler" tabs.
- Each project is shown as a colored dot + name.
- A "+" button opens the create-project modal (name input + color picker).
- A "···" or long-press menu on each project row shows a "Sil" option.

### Main View (task list)

- **"Tüm Görevler" selected:** tasks are grouped under project name headers. Tasks with no project appear at the bottom under "Genel".
- **A project selected from sidebar:** only that project's tasks are shown, flat list (no sub-grouping needed).
- Project header shows project color, name, and task count.

### Task Modal — "Temel" tab

- Add a "Projeler" field: multi-select list of available projects, each shown with its color dot and name.
- A task can belong to 0, 1, or many projects.

### Project Management

- No separate management page. Create and delete handled from the sidebar.
- Create: small modal with name text input + color selector grid → "Kaydet".
- Delete: confirmation prompt before deleting.

---

## Edge Cases

### Project deletion

When a project is deleted:
1. Delete the document from `projects` collection.
2. Find all tasks where `projectIds` contains the deleted project's id and remove it from their arrays (`setDoc` each affected task).
3. Tasks are NOT deleted — they move to "Genel".

### Sidebar visibility after task reassignment

If a task is reassigned away from a user and they no longer have any tasks in that project, the project disappears from their sidebar automatically (visibility is derived, not stored).

---

## What Does Not Change

- Existing tag/label system is unchanged.
- Existing "Benim / Delege / Kişiler" tabs are unchanged.
- Task ownership, assignment, and permission model are unchanged.
