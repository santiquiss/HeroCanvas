// PageControl's stories: a dot per page, the current one solid.
import { stories } from '../design/storyFormat';
import { PageControl } from './TourKit';

export default stories({
  component: 'PageControl',
  args: { count: 4, current: 0 },
  controls: { count: { type: 'number', min: 2, max: 8, step: 1 }, current: { type: 'number', min: 0, max: 7, step: 1 } },
  width: 'content',
  render: ({ count, current }, ctx) => <PageControl count={count} current={Math.min(current, count - 1)} onSelect={ctx.action('onSelect')} />,
  stories: [{ name: 'First page' }, { name: 'Last page', args: { current: 3 } }, { name: 'Two pages', args: { count: 2, current: 1 } }],
});
