// AppBar's stories: the header of a pushed page, as the sample app's pages use it.
import { stories } from 'herocanvas';
import { sampleProject, sampleTask } from '../data/sample';
import { translate } from '../i18n';
import { AppBar, type AppBarAction } from './AppBar';

const ACTIONS: Record<string, AppBarAction> = {
  more: { icon: 'more_horiz', semanticLabel: translate('en', 'task.edit') },
  add: { icon: 'add', semanticLabel: translate('en', 'new.title') },
  share: { icon: 'ios_share', semanticLabel: translate('en', 'task.share') },
};

export default stories({
  component: 'AppBar',
  args: { title: translate('en', 'task.title'), back: true, backIcon: 'arrow_back' as 'arrow_back' | 'close', actions: 'more' },
  controls: {
    backIcon: { type: 'select', options: ['arrow_back', 'close'] },
    actions: { type: 'select', options: ['none', 'more', 'add', 'more + share'] },
  },
  width: 'content',
  render: ({ title, back, backIcon, actions }, ctx) => (
    <AppBar
      title={title}
      backIcon={backIcon}
      onNavigateBack={back ? ctx.action('onNavigateBack') : undefined}
      actions={actions === 'none' ? [] : actions.split(' + ').map((k) => ({ ...ACTIONS[k], onPressed: ctx.action(`${k}.onPressed`) }))}
    />
  ),
  stories: [
    { name: 'Pushed page', note: "A task's page: back, and its menu." },
    { name: 'Closes', args: { backIcon: 'close' }, note: 'The first page in the tablet’s split panel closes it instead of going back.' },
    { name: 'Pane root', args: { title: sampleProject('work').name, back: false, actions: 'add' }, note: 'A project beside the list on a tablet: nothing to go back to.' },
    { name: 'Long title', args: { title: sampleTask('t5').title, actions: 'more + share' }, width: 320 },
  ],
});
