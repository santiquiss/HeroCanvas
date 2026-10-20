// EmptyState's stories: what the sample app shows when there's nothing (Sam, who just signed up, sees them).
import { stories } from '../../design/stories';
import { translate } from '../i18n';
import { EmptyState } from './Controls';

export default stories({
  component: 'EmptyState',
  args: { icon: 'task_alt', title: translate('en', 'today.empty'), body: translate('en', 'today.emptyHint') },
  width: 'content',
  render: ({ icon, title, body }) => <EmptyState icon={icon} title={title} body={body || undefined} />,
  stories: [
    { name: 'Nothing today' },
    { name: 'No projects', args: { icon: 'folder_open', title: translate('en', 'projects.empty'), body: '' } },
    { name: 'Pick a project', args: { icon: 'folder_open', title: translate('en', 'project.pick'), body: '' }, note: 'The empty pane beside the projects on a tablet.' },
  ],
});
