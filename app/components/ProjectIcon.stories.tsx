// ProjectIcon's stories: each sample project's tile, and the smaller one a task's page shows.
import { stories } from 'herocanvas';
import { sampleProject } from '../data/sample';
import { ProjectIcon } from './Controls';

const at = (id: string) => ({ icon: sampleProject(id).icon, color: sampleProject(id).color });

export default stories({
  component: 'ProjectIcon',
  args: { ...at('home'), size: 36 },
  controls: { color: { type: 'color' }, size: { type: 'number', min: 20, max: 72, step: 4 } },
  width: 'auto',
  render: (args) => <ProjectIcon {...args} />,
  stories: [
    { name: 'Home' },
    { name: 'Work', args: at('work') },
    { name: 'Trip', args: at('trip') },
    { name: 'In a task', args: { ...at('work'), size: 28 }, note: 'Beside “Project” on a task’s page.' },
  ],
});
