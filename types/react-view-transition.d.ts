import type { ExoticComponent, ReactNode } from "react";

/**
 * `experimental.viewTransition` makes Next alias `react` to its vendored
 * react-experimental build, which does export `ViewTransition`. The published
 * @types/react has not caught up, so declare the piece we use.
 *
 * Drop this file once @types/react ships the type.
 */
declare module "react" {
  interface ViewTransitionInstance {
    group: Animatable;
    imagePair: Animatable;
    old: Animatable;
    new: Animatable;
  }

  interface ViewTransitionProps {
    children?: ReactNode;
    /** Shared name — the same value on two routes morphs one into the other. */
    name?: string;
    /** Named class, "auto", or "none", applied to every phase. */
    default?: string;
    enter?: string;
    exit?: string;
    update?: string;
    share?: string;
    onEnter?: (instance: ViewTransitionInstance, types: string[]) => void;
    onExit?: (instance: ViewTransitionInstance, types: string[]) => void;
    onUpdate?: (instance: ViewTransitionInstance, types: string[]) => void;
    onShare?: (instance: ViewTransitionInstance, types: string[]) => void;
  }

  export const ViewTransition: ExoticComponent<ViewTransitionProps>;
}
