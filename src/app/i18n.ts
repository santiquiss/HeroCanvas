// The demo app's texts, in its two languages. The simulator gives the screen's language (useLanguage); the app picks
// its texts by it. A real app brings its own translations (its ARB, strings, xcstrings or JSON files) here.
import { useLanguage } from '../sim/language';

const EN = {
  'nav.today': 'Today',
  'nav.projects': 'Projects',
  'nav.profile': 'Profile',
  'today.title': 'Today',
  'today.overdue': 'Overdue',
  'today.upcoming': 'Upcoming',
  'today.empty': 'Nothing due today',
  'today.emptyHint': 'Add a task with the + button.',
  'today.dueToday': 'Today',
  'today.tomorrow': 'Tomorrow',
  'today.inDays': 'In {n} days',
  'today.yesterday': 'Yesterday',
  'projects.title': 'Projects',
  'projects.empty': 'No projects yet',
  'projects.tasks': '{n} tasks',
  'project.pick': 'Pick a project',
  'task.title': 'Task',
  'task.notes': 'Notes',
  'task.noNotes': 'No notes',
  'task.due': 'Due',
  'task.noDate': 'No date',
  'task.project': 'Project',
  'task.markDone': 'Mark as done',
  'task.markUndone': 'Mark as not done',
  'task.edit': 'Edit',
  'task.share': 'Share',
  'task.delete': 'Delete',
  'task.deleteTitle': 'Delete task',
  'task.deleteBody': 'This task will be gone for good.',
  'task.deleted': 'Task deleted',
  'task.undo': 'Undo',
  'new.title': 'New task',
  'new.hint': 'What needs doing?',
  'new.save': 'Save',
  'new.added': 'Task added',
  'profile.title': 'Profile',
  'profile.notifications': 'Notifications',
  'profile.appearance': 'Appearance',
  'profile.language': 'Language',
  'profile.signOut': 'Sign out',
  'welcome.title': 'Get things done',
  'welcome.body': 'Plan your day, keep your projects moving, and never lose a task again.',
  'welcome.start': 'Get started',
  'welcome.nameTitle': 'What should we call you?',
  'welcome.namePlaceholder': 'Your name',
  'welcome.continue': 'Continue',
  'welcome.doneTitle': 'You’re all set',
  'welcome.doneBody': 'Your first project is ready.',
  'welcome.open': 'Open the app',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.back': 'Back',
};

type Key = keyof typeof EN;

const ES: Record<Key, string> = {
  'nav.today': 'Hoy',
  'nav.projects': 'Proyectos',
  'nav.profile': 'Perfil',
  'today.title': 'Hoy',
  'today.overdue': 'Atrasadas',
  'today.upcoming': 'Próximas',
  'today.empty': 'Nada para hoy',
  'today.emptyHint': 'Agregá una tarea con el botón +.',
  'today.dueToday': 'Hoy',
  'today.tomorrow': 'Mañana',
  'today.inDays': 'En {n} días',
  'today.yesterday': 'Ayer',
  'projects.title': 'Proyectos',
  'projects.empty': 'Todavía no hay proyectos',
  'projects.tasks': '{n} tareas',
  'project.pick': 'Elegí un proyecto',
  'task.title': 'Tarea',
  'task.notes': 'Notas',
  'task.noNotes': 'Sin notas',
  'task.due': 'Vence',
  'task.noDate': 'Sin fecha',
  'task.project': 'Proyecto',
  'task.markDone': 'Marcar como hecha',
  'task.markUndone': 'Marcar como pendiente',
  'task.edit': 'Editar',
  'task.share': 'Compartir',
  'task.delete': 'Eliminar',
  'task.deleteTitle': 'Eliminar tarea',
  'task.deleteBody': 'Esta tarea se va a borrar para siempre.',
  'task.deleted': 'Tarea eliminada',
  'task.undo': 'Deshacer',
  'new.title': 'Nueva tarea',
  'new.hint': '¿Qué hay que hacer?',
  'new.save': 'Guardar',
  'new.added': 'Tarea agregada',
  'profile.title': 'Perfil',
  'profile.notifications': 'Notificaciones',
  'profile.appearance': 'Apariencia',
  'profile.language': 'Idioma',
  'profile.signOut': 'Cerrar sesión',
  'welcome.title': 'Hacé lo que importa',
  'welcome.body': 'Planeá tu día, avanzá con tus proyectos y no pierdas ninguna tarea.',
  'welcome.start': 'Empezar',
  'welcome.nameTitle': '¿Cómo te llamamos?',
  'welcome.namePlaceholder': 'Tu nombre',
  'welcome.continue': 'Continuar',
  'welcome.doneTitle': 'Todo listo',
  'welcome.doneBody': 'Tu primer proyecto está listo.',
  'welcome.open': 'Abrir la app',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.back': 'Volver',
};

const TEXTS: Record<string, Record<Key, string>> = { en: EN, es: ES };

export type T = (key: Key, vars?: Record<string, string | number>) => string;

/** The text for `key` in a language, with its {vars} filled in. */
export const translate = (language: string, key: Key, vars: Record<string, string | number> = {}): string =>
  (TEXTS[language] ?? EN)[key].replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''));

/** The screen's texts. */
export function useT(): T {
  const language = useLanguage();
  return (key, vars) => translate(language, key, vars);
}
