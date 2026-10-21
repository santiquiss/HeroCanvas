// CardDeck's stories: Welcome's deck, to swipe, and a short one.
import { stories } from '../design/storyFormat';
import { WELCOME } from './screens';
import { CardDeck } from './TourKit';

export default stories({
  component: 'CardDeck',
  args: { cards: WELCOME.length },
  controls: { cards: { type: 'number', min: 2, max: WELCOME.length, step: 1 } },
  width: 'content',
  render: ({ cards }) => (
    <div style={{ height: 640 }}>
      <CardDeck cards={WELCOME.slice(0, cards)} />
    </div>
  ),
  stories: [{ name: 'Welcome' }, { name: 'Two cards', args: { cards: 2 } }],
});
