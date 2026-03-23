/**
 * Content Filter - Sensitive word filtering
 * Used for filtering inappropriate content in comments
 */

// Common sensitive words list (can be expanded or loaded from database)
const DEFAULT_SENSITIVE_WORDS = [
  // Profanity (basic list - should be expanded based on requirements)
  'fuck', 'shit', 'asshole', 'bitch', 'dick', 'cock', 'pussy', 'whore',
  // Chinese profanity
  '操', '妈的', '傻逼', '王八蛋', '滚蛋', '草', '他妈的',
  // Financial spam patterns
  '免费领取', '加微信', '代客理财', '保证盈利', '稳赚不赔',
  // Scam indicators
  '立即提现', '点击链接领取', '投资返利',
];

export interface ContentFilterResult {
  isClean: boolean;
  filteredContent: string;
  detectedWords: string[];
}

export interface ContentFilterOptions {
  /** Custom list of sensitive words to add */
  additionalWords?: string[];
  /** Whether to use the default word list */
  useDefaultList?: boolean;
  /** Replacement character for filtered words */
  replacementChar?: string;
}

/**
 * Content Filter class for sensitive word detection and filtering
 */
export class ContentFilter {
  private sensitiveWords: Set<string>;
  private replacementChar: string;

  constructor(options: ContentFilterOptions = {}) {
    const {
      additionalWords = [],
      useDefaultList = true,
      replacementChar = '*',
    } = options;

    this.sensitiveWords = new Set(
      useDefaultList
        ? [...DEFAULT_SENSITIVE_WORDS, ...additionalWords.map(w => w.toLowerCase())]
        : additionalWords.map(w => w.toLowerCase())
    );
    this.replacementChar = replacementChar;
  }

  /**
   * Check if content contains sensitive words
   */
  hasSensitiveContent(content: string): boolean {
    const lowerContent = content.toLowerCase();
    for (const word of this.sensitiveWords) {
      if (lowerContent.includes(word)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get list of detected sensitive words in content
   */
  getDetectedWords(content: string): string[] {
    const lowerContent = content.toLowerCase();
    const detected: string[] = [];

    for (const word of this.sensitiveWords) {
      if (lowerContent.includes(word)) {
        detected.push(word);
      }
    }

    return detected;
  }

  /**
   * Filter sensitive words from content
   * Replaces detected words with asterisks
   */
  filter(content: string): ContentFilterResult {
    let filteredContent = content;
    const detectedWords = this.getDetectedWords(content);

    // Replace each detected word with asterisks of same length
    for (const word of detectedWords) {
      const regex = new RegExp(this.escapeRegex(word), 'gi');
      filteredContent = filteredContent.replace(regex, this.replacementChar.repeat(word.length));
    }

    return {
      isClean: detectedWords.length === 0,
      filteredContent,
      detectedWords,
    };
  }

  /**
   * Add words to the sensitive words list
   */
  addWords(words: string[]): void {
    for (const word of words) {
      this.sensitiveWords.add(word.toLowerCase());
    }
  }

  /**
   * Remove words from the sensitive words list
   */
  removeWords(words: string[]): void {
    for (const word of words) {
      this.sensitiveWords.delete(word.toLowerCase());
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Default instance for easy use
export const contentFilter = new ContentFilter();

/**
 * Quick function to check content for sensitive words
 */
export function checkContent(content: string): ContentFilterResult {
  return contentFilter.filter(content);
}

/**
 * Quick function to check if content is clean
 */
export function isContentClean(content: string): boolean {
  return !contentFilter.hasSensitiveContent(content);
}