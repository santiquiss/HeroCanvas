// Illustration's stories: Welcome's drawings, on their cards' colors.
import { stories } from '../design/storyFormat';
import { Illustration, type ArtName } from './Art';

const ON: Record<ArtName, string> = { code: 'var(--app-primary)', devices: 'var(--app-indigo)', versions: 'var(--app-pink)', handoff: 'var(--app-yellow)' };

export default stories({
  component: 'Illustration',
  args: { name: 'code' },
  controls: { name: { type: 'select', options: Object.keys(ON) } },
  width: 'content',
  render: ({ name }) => (
    <div data-top="true" style={{ height: 260, padding: 20, borderRadius: 28, background: ON[name as ArtName] }}>
      <Illustration name={name as ArtName} />
    </div>
  ),
  stories: (Object.keys(ON) as ArtName[]).map((name) => ({ name: name[0].toUpperCase() + name.slice(1), args: { name } })),
});
