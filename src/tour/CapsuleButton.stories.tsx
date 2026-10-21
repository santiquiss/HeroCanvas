// CapsuleButton's stories: the screen's main action, filled, and a second one, tinted.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { CapsuleButton } from './TourKit';

export default stories({
  component: 'CapsuleButton',
  args: { title: 'Take the Tour', filled: true },
  width: 'content',
  render: ({ title, filled }, ctx) => <CapsuleButton title={title} filled={filled} onPressed={ctx.action('onPressed')} />,
  stories: [
    { name: 'Filled' },
    { name: 'Tinted', args: { title: 'Get Started', filled: false } },
    { name: 'Next step', args: { title: `Next: ${STEPS[1].title}` } },
  ],
});
