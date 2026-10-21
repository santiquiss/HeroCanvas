// NavigationBar's stories: a pushed screen's bar, back as a glass circle; a tab's, its title once scrolled.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { NavigationBar } from './TourKit';

export default stories({
  component: 'NavigationBar',
  width: 'content',
  args: { title: STEPS[2].title, back: true },
  render: ({ title, back }, ctx) => <NavigationBar title={title} onBack={back ? ctx.action('onBack') : undefined} />,
  stories: [
    { name: 'Step' },
    { name: 'Tab, scrolled', args: { title: 'Tour', back: false }, note: 'A tab’s bar once its large title has scrolled under it.' },
    { name: 'Long title', args: { title: 'A title long enough to be cut at the end' } },
  ],
});
