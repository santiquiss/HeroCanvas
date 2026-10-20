// The demo app's data: who's using it (personas) and their projects and tasks. One source of truth: screens derive
// what they show from here, never write their own numbers.
import type { Persona } from '../types';

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

const PROJECTS: Project[] = [
  { id: 'home', name: 'Home', icon: 'cottage', color: '#ff9f0a' },
  { id: 'work', name: 'Work', icon: 'work', color: '#3b5bfd' },
  { id: 'trip', name: 'Lisbon trip', icon: 'flight', color: '#1a9e55' },
];

const ALEX: Task[] = [
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
  alex: { projects: PROJECTS, tasks: ALEX },
  sam: { projects: [], tasks: [] },
};

export const PERSONA_PARAM = 'persona';

export const personaData = (id: string | null | undefined): PersonaData => DATA[id ?? ''] ?? DATA[PERSONAS[0].id];

export const findPersona = (id: string | null | undefined): Persona => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

/** Tasks due today or overdue, not done first. */
export const todayTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.due != null && t.due <= 0).sort((a, b) => Number(a.done) - Number(b.done));

/** Tasks due after today, soonest first. */
export const upcomingTasks = (tasks: Task[]): Task[] => tasks.filter((t) => t.due != null && t.due > 0).sort((a, b) => a.due! - b.due!);

export const projectTasks = (tasks: Task[], project: string): Task[] => tasks.filter((t) => t.project === project);
