/**
 * The sun's turn, shared by the sunrise that turns it (sunField) and the sky
 * that answers it (heroField): each part of a full turn belongs to one
 * constellation, so as the sun rotates the sky walks through them, and a
 * visitor who drags the sun turns the sky by hand.
 */
export const sunTurn = {
  /** Radians the sun has turned since the page opened. */
  angle: 0,
  /** The visitor is turning it by hand. */
  held: false,
  /** The pointer is over the disc. */
  over: false,
};

/** Seconds for one full turn when nobody touches it: about twelve seconds
 *  for each of the six constellations. */
export const TURN_S = 72;
