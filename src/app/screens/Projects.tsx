// Projects (a tab) and a project's tasks (pushed; beside the list on wide screens: the manifest's `split`).
import { useNav, useSplit } from '../../nav/context';
import type { PageProps } from '../../nav/types';
import { Checkbox, EmptyState, ListSection, ListTile, ProjectIcon, Scaffold } from '../components';
import { projectTasks } from '../data/tasks';
import { useT } from '../i18n';
import { useTasks } from '../state';
import { dueText, useNewTask } from './taskActions';

export function Projects() {
  const t = useT();
  const nav = useNav();
  const split = useSplit();
  const { projects, tasks } = useTasks();
  return (
    <Scaffold title={t('projects.title')}>
      {projects.length ? (
        <ListSection>
          {projects.map((p) => (
            <ListTile
              key={p.id}
              title={p.name}
              subtitle={t('projects.tasks', { n: projectTasks(tasks, p.id).filter((x) => !x.done).length })}
              leading={<ProjectIcon icon={p.icon} color={p.color} />}
              // Beside the list (the split), the open project's row reads as selected: no chevron.
              trailing={split?.selected.params.id === p.id ? <span /> : undefined}
              onTap={() => nav.push('project', { id: p.id })}
            />
          ))}
        </ListSection>
      ) : (
        <EmptyState icon="folder_open" title={t('projects.empty')} />
      )}
    </Scaffold>
  );
}

export function Project({ params }: PageProps) {
  const t = useT();
  const nav = useNav();
  const newTask = useNewTask();
  const { projects, tasks, toggle } = useTasks();
  const project = projects.find((p) => p.id === params.id);
  if (!project)
    return (
      <Scaffold title={t('projects.title')}>
        <EmptyState icon="folder_open" title={t('project.pick')} />
      </Scaffold>
    );
  const list = projectTasks(tasks, project.id);
  return (
    <Scaffold title={project.name} actions={[{ icon: 'add', semanticLabel: t('new.title'), onPressed: () => newTask(project.id) }]}>
      <ListSection>
        {list.map((x) => (
          <ListTile
            key={x.id}
            title={x.title}
            subtitle={dueText(t, x.due)}
            muted={x.done}
            leading={<Checkbox value={x.done} semanticLabel={x.title} onChanged={() => toggle(x.id)} />}
            onTap={() => nav.push('task', { id: x.id })}
          />
        ))}
      </ListSection>
    </Scaffold>
  );
}
