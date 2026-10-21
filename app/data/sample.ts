// SAMPLE DATA. Everything here is made up: the people, their projects and their tasks exist only so the sample app
// (a small task manager) has something to show. Connecting your app replaces it with your app's own mock data.
// One source of truth: screens and stories derive what they show from here, never write their own.

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Days from today (0 today, 1 tomorrow, -1 yesterday); none: no date. */
  due?: number;
  done: boolean;
  project: string;
}

export interface Project {
  id: string;
  name: string;
  /** A Material Symbol. */
  icon: string;
  /** A CSS color for its icon's tile. */
  color: string;
}

export interface PersonaData {
  projects: Project[];
  tasks: Task[];
}

export const PERSONAS: Persona[] = [
  { id: 'alex', name: 'Alex', description: 'Three projects, a busy week' },
  { id: 'sam', name: 'Sam', description: 'Just signed up: nothing yet' },
];

export const SAMPLE_PROJECTS: Project[] = [
  { id: 'home', name: 'Home', icon: 'cottage', color: '#ff9f0a' },
  { id: 'work', name: 'Work', icon: 'work', color: '#3b5bfd' },
  { id: 'trip', name: 'Lisbon trip', icon: 'flight', color: '#1a9e55' },
];

export const SAMPLE_TASKS: Task[] = [
  { id: 't1', title: 'Send the quarterly report', notes: 'Numbers from finance, then a short summary on top.', due: 0, done: false, project: 'work' },
  { id: 't2', title: 'Book the dentist', due: 0, done: false, project: 'home' },
  { id: 't3', title: 'Review the design proposal', due: 0, done: true, project: 'work' },
  { id: 't4', title: 'Water the plants', due: 1, done: false, project: 'home' },
  { id: 't5', title: 'Find a hotel in Alfama', notes: 'Walking distance to the tram 28.', due: 3, done: false, project: 'trip' },
  { id: 't6', title: 'Plan the team offsite', due: 5, done: false, project: 'work' },
  { id: 't7', title: 'Renew the passport', due: -1, done: false, project: 'trip' },
  { id: 't8', title: 'Fix the kitchen tap', done: false, project: 'home' },
];

const DATA: Record<string, PersonaData> = {
  alex: { projects: SAMPLE_PROJECTS, tasks: SAMPLE_TASKS },
  sam: { projects: [], tasks: [] },
};

export const PERSONA_PARAM = 'persona';

export const personaData = (id: string | null | undefined): PersonaData => DATA[id ?? ''] ?? DATA[PERSONAS[0].id];

export const findPersona = (id: string | null | undefined): Persona => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

/** Tasks due today or overdue, not done first. */
export const todayTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.due != null && t.due <= 0).sort((a, b) => Number(a.done) - Number(b.done));

/** Tasks due after today, soonest first. */
export const upcomingTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.due != null && t.due > 0).sort((a, b) => a.due! - b.due!);

/** A sample task or project by id (stories show these; a missing id is a typo, so it throws). */
export const sampleTask = (id: string): Task => SAMPLE_TASKS.find((t) => t.id === id) ?? missing('task', id);
export const sampleProject = (id: string): Project => SAMPLE_PROJECTS.find((p) => p.id === id) ?? missing('project', id);
const missing = (what: string, id: string): never => {
  throw new Error(`No sample ${what} "${id}"`);
};

export const projectTasks = (tasks: Task[], project: string): Task[] => tasks.filter((t) => t.project === project);import type { Persona } from 'herocanvas';

