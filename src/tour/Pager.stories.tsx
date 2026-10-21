// Pager's stories: pages to swipe one at a time, with their page control.
import { stories } from '../design/storyFormat';
import { HOW } from './screens';
import { STEPS } from './steps';
import { ListRow, Pager, Section, TextCell } from './TourKit';

export default stories({
  component: 'Pager',
  args: { pages: 3 },
  controls: { pages: { type: 'number', min: 2, max: 7, step: 1 } },
  width: 'content',
  render: ({ pages }) => (
    <Pager>
      {STEPS.slice(0, pages - 1).map((s) => (
        <Section key={s.id} header={s.title}>
          <TextCell>{s.body[0]}</TextCell>
        </Section>
      ))}
      <Section header="How it works">
        {HOW.map((h) => (
          <ListRow key={h.title} icon={h.icon} tint={h.tint} title={h.title} subtitle={h.subtitle} />
        ))}
      </Section>
    </Pager>
  ),
  stories: [{ name: 'Three pages' }, { name: 'Two pages', args: { pages: 2 } }, { name: 'Five pages', args: { pages: 5 }, note: 'Welcome has four.' }],
});
