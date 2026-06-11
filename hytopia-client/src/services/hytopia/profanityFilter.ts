import {
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

/**
 * A service to filter profanity from text
 */
class ProfanityFilter {
  private matcher: RegExpMatcher;
  private censor: TextCensor;

  constructor() {
    this.matcher = new RegExpMatcher({
      ...englishDataset.build(),
      ...englishRecommendedTransformers,
    });

    this.censor = new TextCensor().setStrategy(asteriskCensorStrategy());
  }

  /**
   * Filters profanity from a given text
   */
  public clean(text: string): string {
    if (!text) return text;

    const matches = this.matcher.getAllMatches(text);
    return this.censor.applyTo(text, matches);
  }

  /**
   * Checks if a text contains profanity
   */
  public hasProfanity(text: string): boolean {
    if (!text) return false;

    return this.matcher.hasMatch(text);
  }
}

// Export a singleton instance
export const profanityFilter = new ProfanityFilter();