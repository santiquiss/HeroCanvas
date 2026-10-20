// ListSection's stories: a header over a card of rows, filled with the sample tasks or the settings.
import { Icon } from '../../components/Icon';
import { stories } from '../../design/stories';
import { SAMPLE_TASKS, todayTasks } from '../data/sample';
import { translate } from '../i18n';
import { Checkbox } from './Controls';
import { ListSection, ListTile } from './List';

const SETTINGS = [
  ['profile.notifications', 'notifications'],
  ['profile.appearance', 'palette'],
  ['profile.language', 'language'],
] as const;

export default stories({
  component: 'ListSection',
  args: { header: translate('en', 'today.dueToday'), rows: 'tasks' },
  controls: { rows: { type: 'select', options: ['tasks', 'settings'] } },
  width: 'content',
  render: ({ header, rows }, ctx) => (
    <ListSection header={header || undefined}>
      {rows === 'tasks'
        ? todayTasks(SAMPLE_TASKS)
            .filter((t) => t.due === 0)
            .map((t) => <ListTile key={t.id} title={t.title} muted={t.done} leading={<Checkbox value={t.done} onChanged={ctx.action('onChanged')} />} onTap={ctx.action('onTap')} />)
        : SETTINGS.map(([key, icon]) => (
            <ListTile key={key} title={translate('en', key)} leading={<Icon name={icon} size={24} color="var(--app-icon)" />} onTap={ctx.action('onTap')} />
          ))}
    </ListSection>
  ),
  stories: [
    { name: 'With header', note: 'Today’s tasks.' },
    { name: 'No header', args: { header: '', rows: 'settings' }, note: 'The Profile tab’s settings.' },
  ],
});
