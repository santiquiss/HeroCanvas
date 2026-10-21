// Section's stories: inset grouped sections, with their rows or their text.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { ListRow, Section, TextCell } from './TourKit';

export default stories({
  component: 'Section',
  args: { header: 'Try each part', footer: '', rows: 'list' },
  controls: { rows: { type: 'select', options: ['list', 'text'] } },
  width: 'content',
  render: ({ header, footer, rows }) => (
    <Section header={header || undefined} footer={footer || undefined}>
      {rows === 'list' ? STEPS.slice(0, 4).map((h) => <ListRow key={h.id} icon={h.icon} tint={h.tint} title={h.title} subtitle={h.line} />) : STEPS[2].body.map((p) => <TextCell key={p}>{p}</TextCell>)}
    </Section>
  ),
  stories: [
    { name: 'Rows' },
    { name: 'Text', args: { header: 'Try it', rows: 'text' } },
    { name: 'With footer', args: { header: 'Try each part', footer: 'Each step is a page; try it on the interface around the device.' } },
  ],
});
