// LargeTitle's stories: a tab's title, as iOS opens a screen.
import { stories } from '../design/storyFormat';
import { LargeTitle } from './TourKit';

export default stories({
  component: 'LargeTitle',
  args: { title: 'Welcome', top: 0 },
  width: 'content',
  render: ({ title, top }) => <LargeTitle title={title} top={top} />,
  stories: [{ name: 'Tab' }, { name: 'Long', args: { title: 'Get Started' } }],
});
