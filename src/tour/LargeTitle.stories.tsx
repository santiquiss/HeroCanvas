// LargeTitle's stories: a tab's title, as iOS opens a screen.
import { stories } from '../design/storyFormat';
import { LargeTitle } from './TourKit';

export default stories({
  component: 'LargeTitle',
  args: { title: 'Tour' },
  width: 'content',
  render: ({ title }) => <LargeTitle title={title} />,
  stories: [{ name: 'Tab' }, { name: 'Long', args: { title: 'Get Started' } }],
});
