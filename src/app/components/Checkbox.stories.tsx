// Checkbox's stories: a task's round tick, which ticks.
import { stories } from '../../design/stories';
import { sampleTask } from '../data/sample';
import { Checkbox } from './Controls';

export default stories({
  component: 'Checkbox',
  args: { value: false, disabled: false },
  width: 'auto',
  render: ({ value, disabled }, ctx) => (
    <Checkbox
      value={value}
      semanticLabel={sampleTask('t1').title}
      onChanged={
        disabled
          ? undefined
          : (v) => {
              ctx.action('onChanged')(v);
              ctx.update({ value: v });
            }
      }
    />
  ),
  stories: [
    { name: 'Not done' },
    { name: 'Done', args: { value: true } },
    { name: 'Disabled', args: { disabled: true }, note: 'No onChanged.' },
  ],
});
