// Today (a tab): what's overdue and due today, then what's coming. Tick a task to mark it done, tap it for its page.
// Scenarios: "Completed" shows or hides the done ones (`done`).
import { useNav } from '../../nav/context';
import { useUrlState } from '../../sim/SimContext';
import { Checkbox, EmptyState, ListSection, ListTile, Scaffold } from '../components';
import { todayTasks, upcomingTasks, type Task } from '../data/tasks';
import { useT } from '../i18n';
import { useTasks } from '../state';
import { dueText, useNewTask } from './taskActions';

export function Today() {
  const t = useT();
  const nav = useNav();
  const newTask = useNewTask();
  const { tasks, projects, toggle } = useTasks();
  const [showDone] = useUrlState<string>('done', '1');
  const visible = showDone === '1' ? tasks : tasks.filter((x) => !x.done);
  const overdue = todayTasks(visible).filter((x) => x.due! < 0);
  const today = todayTasks(visible).filter((x) => x.due === 0);
  const upcoming = upcomingTasks(visible);
  const row = (x: Task) => (
    <ListTile
      key={x.id}
      title={x.title}
      subtitle={[projects.find((p) => p.id === x.project)?.name, dueText(t, x.due)].filter(Boolean).join(' · ')}
      muted={x.done}
      leading={<Checkbox value={x.done} semanticLabel={x.title} onChanged={() => toggle(x.id)} />}
      onTap={() => nav.push('task', { id: x.id })}
    />
  );
  return (
    <Scaffold title={t('today.title')} fab={{ icon: 'add', semanticLabel: t('new.title'), onPressed: () => newTask() }}>
      {!overdue.length && !today.length && !upcoming.length && <EmptyState icon="task_alt" title={t('today.empty')} body={t('today.emptyHint')} />}
      {overdue.length > 0 && <ListSection header={t('today.overdue')}>{overdue.map(row)}</ListSection>}
      {today.length > 0 && <ListSection header={t('today.dueToday')}>{today.map(row)}</ListSection>}
      {upcoming.length > 0 && <ListSection header={t('today.upcoming')}>{upcoming.map(row)}</ListSection>}
    </Scaffold>
  );
}
