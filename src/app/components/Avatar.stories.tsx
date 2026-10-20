// Avatar's stories: the sample personas' initials, at the sizes the app uses.
import { stories } from '../../design/stories';
import { PERSONAS } from '../data/sample';
import { Avatar } from './Controls';

export default stories({
  component: 'Avatar',
  args: { name: PERSONAS[0].name, image: '', size: 40 },
  controls: { size: { type: 'number', min: 20, max: 120, step: 4 } },
  width: 'auto',
  render: ({ name, image, size }) => <Avatar name={name} image={image || undefined} size={size} />,
  stories: [
    { name: 'Initials' },
    { name: 'Profile', args: { size: 72 }, note: 'The Profile tab’s header.' },
    { name: 'Small', args: { name: PERSONAS[1].name, size: 28 } },
  ],
});
