// TextCell's stories: a paragraph in a group's cell.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { Section, TextCell } from './TourKit';

export default stories({
  component: 'TextCell',
  args: { text: STEPS[0].tryIt },
  width: 'content',
  render: ({ text }) => (
    <Section>
      <TextCell>{text}</TextCell>
    </Section>
  ),
  stories: [{ name: 'Paragraph' }, { name: 'Short', args: { text: STEPS[6].line } }],
});
