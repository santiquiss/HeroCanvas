// Gallery URLs: #/components (coverage overview), #/components/<Name>?story=…&args=…; the tokens (their own mode),
// #/tokens/<group>?token=<name>.
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { isOverridable } from '../design/overridable';
import { PROPOSAL_STORIES, STORIES, storiesFor, type Args, type StoryModule } from '../design/stories';
import { isTokensPath, MODE_PATHS, rememberPrototype, useSimQuery } from '../sim/modes';

export { isTokensPath };

const PREFIX = MODE_PATHS.components;


/** `tokens`: the token group shown (`''` for the first), or null when it's a component or the overview. */
export function useGalleryRoute(): { active: boolean; name: string | null; tokens: string | null } {
  const { pathname } = useLocation();
  if (isTokensPath(pathname)) return { active: true, name: null, tokens: decodeURIComponent(pathname.replace(/^\/(components\/)?tokens\/?/, '')) };
  if (!pathname.startsWith(PREFIX)) return { active: false, name: null, tokens: null };
  const rest = pathname.slice(PREFIX.length).replace(/^\//, '');
  return { active: true, name: rest ? decodeURIComponent(rest) : null, tokens: null };
}

export function useGalleryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const sim = useSimQuery();
  return {
    /** `story` / `args`: open on that story with those args (the Controls' overrides), e.g. from Inspect. */
    openComponent: (name: string | null, at?: { story: string; args?: Args }, proposal?: string) => {
      rememberPrototype(location);
      const extra: Record<string, string> = at ? { story: at.story } : {};
      // `proposal`: open it in that proposal (one Live doesn't have yet).
      if (proposal) extra.proposal = proposal;
      if (at?.args && Object.keys(at.args).length) extra.args = JSON.stringify({ [at.story]: at.args });
      navigate(PREFIX + (name ? `/${encodeURIComponent(name)}` : '') + sim(extra));
    },
    /** A token group; `token`: one of its tokens, scrolled to and marked. */
    openTokens: (group: string, token?: string) => {
      rememberPrototype(location);
      navigate(`${MODE_PATHS.tokens}/${encodeURIComponent(group)}` + sim(token ? { token } : {}));
    },
  };
}

/** Stories of the base plus the active proposal, and the names the proposal adds or changes. */
export function useStories(): { stories: Map<string, StoryModule<Args>>; proposalNames: Set<string>; proposalId: string | null } {
  const [search] = useSearchParams();
  const proposalId = search.get('proposal');
  const own = (proposalId && PROPOSAL_STORIES.get(proposalId)) || [];
  return { stories: storiesFor(proposalId), proposalNames: new Set(own.map((s) => s.component)), proposalId };
}

export const isBaseComponent = (name: string) => STORIES.has(name);

/**
 * What a proposal does to a component: changes one Live has (one a proposal can replace, a base story; with `lib`,
 * also one in the code) or adds a new one. The gallery, Inspect, the Proposal panel and the changes popover all
 * read it.
 */
export const componentKind = (name: string, lib?: { widget: (name: string) => unknown } | null): 'changed' | 'new' =>
  isOverridable(name) || isBaseComponent(name) || lib?.widget(name) ? 'changed' : 'new';
