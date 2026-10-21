// PromptField's stories: a request for the agent, with Copy.
import { stories } from '../design/storyFormat';
import { WAYS } from './screens';
import { PromptField, Section } from './TourKit';

export default stories({
  component: 'PromptField',
  args: { prompt: WAYS[0].prompt as string },
  width: 'content',
  render: ({ prompt }) => (
    <Section>
      <PromptField prompt={prompt} />
    </Section>
  ),
  stories: [{ name: 'Code' }, { name: 'Figma', args: { prompt: WAYS[1].prompt } }],
});
