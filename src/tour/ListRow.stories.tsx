// ListRow's stories: a row of an inset grouped list, in its group as it sits on screen.
import { stories } from '../design/storyFormat';
import { HOW } from './screens';
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
    { name: 'Not tappable', args: { icon: HOW[0].icon, tint: HOW[0].tint, title: HOW[0].title, subtitle: HOW[0].subtitle, tappable: false }, note: 'How it works, on Welcome.' },
    { name: 'Title only', args: { subtitle: '' } },
  ],
});
