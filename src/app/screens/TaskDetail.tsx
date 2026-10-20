// A task's page (pushed): its notes, when it's due, its project; ⋯ opens its actions (an action sheet, or a menu
// hanging from the button on large screens), Delete asks first and leaves an Undo.
import { useNav } from '../../nav/context';
import type { PageProps } from '../../nav/types';
import { Button } from '../../kit';
import { EmptyState, ListSection, ListTile, ProjectIcon, Scaffold } from '../components';
import { useT } from '../i18n';
import { useTasks } from '../state';
import { dueText, useTaskActions } from './taskActions';
import styles from './screens.module.css';

export function TaskDetail({ params }: PageProps) {
  const t = useT();
  const nav = useNav();
  const actions = useTaskActions();
  const { tasks, projects, toggle } = useTasks();
  const task = tasks.find((x) => x.id === params.id);
  if (!task)
    return (
      <Scaffold title={t('task.title')}>
        <EmptyState icon="task_alt" title={t('task.deleted')} />
      </Scaffold>
    );
  const project = projects.find((p) => p.id === task.project);
  return (
    <Scaffold title={t('task.title')} actions={[{ icon: 'more_horiz', semanticLabel: t('task.edit'), onPressed: () => actions(task, nav.back) }]}>
      <h2 className={`${styles.taskTitle} ${task.done ? styles.done : ''}`}>{task.title}</h2>
      <ListSection>
        <ListTile title={t('task.due')} subtitle={dueText(t, task.due)} />
        {project && <ListTile title={t('task.project')} subtitle={project.name} leading={<ProjectIcon icon={project.icon} color={project.color} size={28} />} />}
      </ListSection>
      <ListSection header={t('task.notes')}>
        <ListTile title={task.notes ?? t('task.noNotes')} muted={!task.notes} />
      </ListSection>
      <Button label={task.done ? t('task.markUndone') : t('task.markDone')} variant={task.done ? 'tertiary' : 'primary'} block onPressed={() => toggle(task.id)} />
    </Scaffold>
  );
}
