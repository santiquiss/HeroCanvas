// TextField's stories: the new task's title and a task's notes. They type.
import { stories } from 'herocanvas';
import { sampleTask } from '../data/sample';
import { translate } from '../i18n';
import { TextField } from './Controls';

export default stories({
  component: 'TextField',
  args: { value: '', hintText: translate('en', 'new.hint'), multiline: false },
  width: 'content',
  render: ({ value, hintText, multiline }, ctx) => (
    <TextField
      value={value}
      hintText={hintText}
      multiline={multiline}
      onChanged={(v) => ctx.update({ value: v })}
      onSubmitted={ctx.action('onSubmitted')}
    />
  ),
  stories: [
    { name: 'Empty', note: 'The new task sheet, before typing.' },
    { name: 'Filled', args: { value: sampleTask('t1').title } },
    { name: 'Multiline', args: { value: sampleTask('t1').notes ?? '', hintText: translate('en', 'task.notes'), multiline: true } },
  ],
});
