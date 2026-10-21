// IconTile's stories: Settings-style icons in iOS's system tints, at a row's size and a step's.
import { stories } from '../design/storyFormat';
import { STEPS } from './steps';
import { IconTile, type Tint } from './TourKit';

const TINTS: Tint[] = ['blue', 'indigo', 'purple', 'pink', 'orange', 'green', 'teal', 'gray'];

export default stories({
  component: 'IconTile',
  args: { icon: STEPS[0].icon, tint: 'blue' as Tint, size: 30 },
  controls: { tint: { type: 'select', options: TINTS }, size: { type: 'number', min: 20, max: 96, step: 2 } },
  width: 'auto',
  render: (args) => <IconTile {...args} />,
  stories: [
    { name: 'Row', note: 'In a list row: 30 pt.' },
    { name: 'Step', args: { icon: STEPS[2].icon, tint: STEPS[2].tint, size: 64 }, note: 'A step’s page opens with it.' },
    ...STEPS.slice(1).map((s) => ({ name: s.title, args: { icon: s.icon, tint: s.tint } })),
  ],
});
