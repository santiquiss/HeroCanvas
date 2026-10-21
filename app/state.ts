// The sample app's state: the tasks of whoever is using it (the persona, `?persona=`), changed in memory and shared by
// every screen on the canvas (useSharedState), so ticking a task on one device ticks it on all.
import { useSharedState, useUrlState } from 'herocanvas';
import { useMemo } from 'react';
import { PERSONA_PARAM, PERSONAS, personaData, type Task } from './data/sample';

export function useTasks() {
  const [personaId] = useUrlState<string>(PERSONA_PARAM, PERSONAS[0].id);
  const data = useMemo(() => personaData(personaId), [personaId]);
  // Each persona keeps its own changes: switching back finds them as they were left.
  const [byPersona, setByPersona] = useSharedState<Record<string, Task[]>>('tasks', {}, { app: true });
  const tasks = byPersona[personaId] ?? data.tasks;
  const set = (next: (tasks: Task[]) => Task[]) => setByPersona((all) => ({ ...all, [personaId]: next(all[personaId] ?? data.tasks) }));
  return {
    personaId,
    projects: data.projects,
    tasks,
    toggle: (id: string) => set((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    /** Removes a task; returns how to put it back (Undo). */
    remove: (id: string) => {
      const at = tasks.findIndex((t) => t.id === id);
      const task = tasks[at];
      set((ts) => ts.filter((t) => t.id !== id));
      return () => set((ts) => [...ts.slice(0, at), task, ...ts.slice(at)]);
    },
    add: (title: string, project?: string) =>
      set((ts) => [{ id: `new${Date.now()}`, title, due: 0, done: false, project: project ?? data.projects[0]?.id ?? '' }, ...ts]),
  };
}
