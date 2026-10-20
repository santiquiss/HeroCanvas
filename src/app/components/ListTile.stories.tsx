// ListTile's stories: every kind of row the sample app has, each in a card as it sits in a ListSection.
import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { stories } from '../../design/stories';
import { sampleProject, sampleTask, SAMPLE_TASKS, projectTasks } from '../data/sample';
import { translate } from '../i18n';
import { dueText } from '../screens/taskActions';
import { Checkbox, ProjectIcon } from './Controls';
import { ListSection, ListTile } from './List';

const en = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate('en', key, vars);
const taskSubtitle = (id: string) => `${sampleProject(sampleTask(id).project).name} · ${dueText(en, sampleTask(id).due)}`;

const LEADING: Record<string, (done: boolean) => ReactNode> = {
  none: () => null,
  checkbox: (done) => <Checkbox value={done} />,
  icon: () => <Icon name="notifications" size={24} color="var(--app-icon)" />,
  project: () => <ProjectIcon icon={sampleProject('trip').icon} color={sampleProject('trip').color} />,
};

export default stories({
  component: 'ListTile',
  args: { title: sampleTask('t1').title, subtitle: taskSubtitle('t1'), leading: 'checkbox', muted: false, destructive: false, tappable: true },
  controls: { leading: { type: 'select', options: Object.keys(LEADING) } },
  width: 'content',
  render: ({ title, subtitle, leading, muted, destructive, tappable }, ctx) => (
    <ListSection>
      <ListTile
        title={title}
        subtitle={subtitle || undefined}
        leading={LEADING[leading](muted) || undefined}
        muted={muted}
        destructive={destructive}
        onTap={tappable ? ctx.action('onTap') : undefined}
      />
    </ListSection>
  ),
  stories: [
    { name: 'Task' },
    { name: 'Done task', args: { title: sampleTask('t3').title, subtitle: taskSubtitle('t3'), muted: true } },
    {
      name: 'Project',
      args: { title: sampleProject('trip').name, subtitle: en('projects.tasks', { n: projectTasks(SAMPLE_TASKS, 'trip').filter((t) => !t.done).length }), leading: 'project' },
    },
    { name: 'Setting', args: { title: en('profile.notifications'), subtitle: '', leading: 'icon' }, note: 'Tappable, nothing on the right: a chevron.' },
    { name: 'Destructive', args: { title: en('profile.signOut'), subtitle: '', leading: 'none', destructive: true } },
    { name: 'Not tappable', args: { title: en('task.notes'), subtitle: sampleTask('t5').notes, leading: 'none', tappable: false } },
  ],
});
