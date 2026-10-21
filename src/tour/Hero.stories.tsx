// Hero's stories: a screen's opening, the app icon over its name and line.
import { stories } from '../design/storyFormat';
import { Hero, IconTile } from './TourKit';
import { STEPS } from './steps';

export default stories({
  component: 'Hero',
  args: { title: 'Welcome to HeroCanvas', subtitle: 'Design your app’s screens in code, with an AI agent, on a canvas of real devices.', icon: 'app' },
  controls: { icon: { type: 'select', options: ['app', 'tile'] } },
  width: 'content',
  render: ({ title, subtitle, icon }) => (
    <Hero
      icon={icon === 'app' ? <img src="/pwa/icon-192.png" alt="" width={88} height={88} style={{ borderRadius: 20 }} /> : <IconTile icon={STEPS[0].icon} tint={STEPS[0].tint} size={64} />}
      title={title}
      subtitle={subtitle}
    />
  ),
  stories: [{ name: 'Welcome' }, { name: 'With a tile', args: { icon: 'tile', title: STEPS[0].title, subtitle: STEPS[0].line } }],
});
