// ListRow's stories: a row of an inset grouped list, in its group as it sits on screen.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { ListRow, Section, type Tint } from './TourKit';

export default stories({
  component: 'ListRow',
  args: { icon: STEPS[0].icon, tint: STEPS[0].tint as Tint, title: STEPS[0].title, subtitle: STEPS[0].line, tappable: true },
  width: 'content',
  render: ({ tappable, ...a }, ctx) => (
    <Section>
      <ListRow {...a} onTap={tappable ? ctx.action('onTap') : undefined} />
    </Section>
  ),
  stories: [
    { name: 'Opens a page', note: 'A step in the Tour: a chevron.' },
    { name: 'Not tappable', args: { icon: STEPS[1].icon, tint: STEPS[1].tint as Tint, title: STEPS[1].title, subtitle: STEPS[1].line, tappable: false } },
    { name: 'Title only', args: { subtitle: '' } },
  ],
});
