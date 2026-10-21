// The sample app's pages: one per screen, at its route, with where it sits (level), its tab, what it links to, its
// state, its flows and its scenario controls. The tools (Pages panel, Flow view, Scenarios, the inspector) read this;
// no tool knows a page by name.
import type { PageDef } from 'herocanvas';
import { PERSONAS, personaData } from './data/sample';
import { Project, Projects } from './screens/Projects';
import { Profile } from './screens/Profile';
import { TaskDetail } from './screens/TaskDetail';
import { Today } from './screens/Today';
import { Welcome, WELCOME_FLOW } from './screens/Welcome';

const SAMPLE = personaData(PERSONAS[0].id);

export const BASE_PAGES: Record<string, PageDef> = {
  // ---------------------------------------------------------------- Before the tabs
  welcome: {
    path: '/welcome',
    level: 'boot',
    title: 'Welcome',
    component: Welcome,
    flow: WELCOME_FLOW,
    status: 'done',
    note: 'Where someone new starts: an intro, their name, and into the app',
  },

  // ---------------------------------------------------------------- Tabs
  today: {
    path: '/today',
    level: 'tab',
    title: 'Today',
    component: Today,
    tab: { label: 'Today', short: 'Today', icon: 'today' },
    status: 'done',
    controls: [{ param: 'done', label: 'Completed', note: 'The tasks already done', options: [{ value: '1', label: 'Shown' }, { value: '0', label: 'Hidden' }] }],
    links: [{ to: 'task', params: { id: 't1' }, label: 'A task' }],
  },
  projects: {
    path: '/projects',
    level: 'tab',
    title: 'Projects',
    component: Projects,
    tab: { label: 'Projects', short: 'Projects', icon: 'folder' },
    status: 'done',
    // Wide enough, a project opens beside the list (Mail's mailboxes and messages).
    split: { minWidth: 700, ratio: 'detail', masterWidth: 320, defaultChild: { id: 'project', params: {} } },
    links: [{ to: 'project', params: { id: 'work' }, label: 'A project' }],
  },
  profile: {
    path: '/profile',
    level: 'tab',
    title: 'Profile',
    component: Profile,
    tab: { label: 'Profile', short: 'Profile', icon: 'person' },
    status: 'done',
    links: [{ to: 'welcome', label: 'Sign out' }],
  },

  // ---------------------------------------------------------------- Pushed
  project: {
    path: '/projects/:id',
    level: 'push',
    title: 'Project',
    name: 'Project',
    component: Project,
    parent: 'projects',
    defaults: { id: 'work' },
    variants: () => SAMPLE.projects.map((p) => ({ label: p.name, params: { id: p.id } })),
    status: 'done',
    links: [{ to: 'task', params: { id: 't1' }, label: 'A task' }],
  },
  task: {
    path: '/tasks/:id',
    level: 'push',
    title: 'Task',
    name: 'Task',
    component: TaskDetail,
    parent: 'today',
    defaults: { id: 't1' },
    variants: () => SAMPLE.tasks.slice(0, 4).map((t) => ({ label: t.title, params: { id: t.id } })),
    status: 'done',
  },
};
