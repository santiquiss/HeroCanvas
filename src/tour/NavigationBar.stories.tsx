// NavigationBar's stories: a pushed screen's bar, back as a glass circle.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { NavigationBar } from './TourKit';

export default stories({
  component: 'NavigationBar',
  args: { title: STEPS[2].title },
  width: 'content',
  render: ({ title }, ctx) => <NavigationBar title={title} onBack={ctx.action('onBack')} />,
  stories: [{ name: 'Step' }, { name: 'Long title', args: { title: 'A title long enough to be cut at the end' } }],
});
