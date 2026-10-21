// DeckCard's stories: Welcome's cards, one by one, with their illustrations.
import { stories } from '../design/storyFormat';
import { WELCOME } from './screens';
import { DeckCard } from './TourKit';

export default stories({
  component: 'DeckCard',
  args: { card: 0, count: true },
  controls: { card: { type: 'number', min: 0, max: WELCOME.length - 1, step: 1 }, count: { type: 'boolean' } },
  width: 'content',
  render: ({ card, count }, ctx) => {
    const c = WELCOME[Math.max(0, Math.min(WELCOME.length - 1, card))];
    const last = card >= WELCOME.length - 1;
    return (
      <div style={{ position: 'relative', height: 520 }}>
        <DeckCard {...c} count={count ? `${card + 1} of ${WELCOME.length}` : undefined} action={last ? { title: 'Take the Tour', onPressed: ctx.action('onPressed') } : undefined} />
      </div>
    );
  },
  stories: WELCOME.map((c, i) => ({ name: c.kicker, args: { card: i } })),
});
