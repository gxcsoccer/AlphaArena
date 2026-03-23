/**
 * Content Filter Tests
 */

import { ContentFilter, checkContent, isContentClean } from '../content-filter';

describe('ContentFilter', () => {
  describe('hasSensitiveContent', () => {
    it('should detect sensitive words', () => {
      const filter = new ContentFilter();
      expect(filter.hasSensitiveContent('This is fuck content')).toBe(true);
      expect(filter.hasSensitiveContent('This is shit content')).toBe(true);
      expect(filter.hasSensitiveContent('This is clean content')).toBe(false);
    });

    it('should detect Chinese profanity', () => {
      const filter = new ContentFilter();
      expect(filter.hasSensitiveContent('这是一个操蛋的评论')).toBe(true);
      expect(filter.hasSensitiveContent('妈的，真糟糕')).toBe(true);
      expect(filter.hasSensitiveContent('这是一条正常的评论')).toBe(false);
    });

    it('should detect financial spam', () => {
      const filter = new ContentFilter();
      expect(filter.hasSensitiveContent('免费领取1000元')).toBe(true);
      expect(filter.hasSensitiveContent('加微信获取内幕消息')).toBe(true);
      expect(filter.hasSensitiveContent('保证盈利，稳赚不赔')).toBe(true);
    });

    it('should be case insensitive', () => {
      const filter = new ContentFilter();
      expect(filter.hasSensitiveContent('FUCK this')).toBe(true);
      expect(filter.hasSensitiveContent('What The FUCK')).toBe(true);
      expect(filter.hasSensitiveContent('Fuck yeah')).toBe(true);
    });

    it('should use custom word list', () => {
      const filter = new ContentFilter({ 
        useDefaultList: false, 
        additionalWords: ['badword', 'naughty'] 
      });
      expect(filter.hasSensitiveContent('This has badword')).toBe(true);
      expect(filter.hasSensitiveContent('This has naughty')).toBe(true);
      expect(filter.hasSensitiveContent('This has fuck')).toBe(false); // Default list not used
    });
  });

  describe('getDetectedWords', () => {
    it('should return list of detected words', () => {
      const filter = new ContentFilter();
      const words = filter.getDetectedWords('This is fuck and shit content');
      expect(words).toContain('fuck');
      expect(words).toContain('shit');
      expect(words).toHaveLength(2);
    });

    it('should return empty array for clean content', () => {
      const filter = new ContentFilter();
      const words = filter.getDetectedWords('This is clean content');
      expect(words).toHaveLength(0);
    });
  });

  describe('filter', () => {
    it('should replace sensitive words with asterisks', () => {
      const filter = new ContentFilter();
      const result = filter.filter('This is fuck content');
      expect(result.filteredContent).toBe('This is **** content');
      expect(result.isClean).toBe(false);
      expect(result.detectedWords).toContain('fuck');
    });

    it('should replace multiple sensitive words', () => {
      const filter = new ContentFilter();
      const result = filter.filter('What the fuck and shit');
      expect(result.filteredContent).toBe('What the **** and ****');
      expect(result.detectedWords).toHaveLength(2);
    });

    it('should use custom replacement character', () => {
      const filter = new ContentFilter({ replacementChar: '#' });
      const result = filter.filter('This is fuck content');
      expect(result.filteredContent).toBe('This is #### content');
    });

    it('should return clean content unchanged', () => {
      const filter = new ContentFilter();
      const result = filter.filter('This is perfectly clean content');
      expect(result.filteredContent).toBe('This is perfectly clean content');
      expect(result.isClean).toBe(true);
    });
  });

  describe('addWords and removeWords', () => {
    it('should add words to the filter', () => {
      const filter = new ContentFilter();
      filter.addWords(['custombadword']);
      expect(filter.hasSensitiveContent('This has custombadword')).toBe(true);
    });

    it('should remove words from the filter', () => {
      const filter = new ContentFilter();
      expect(filter.hasSensitiveContent('This is fuck')).toBe(true);
      filter.removeWords(['fuck']);
      expect(filter.hasSensitiveContent('This is fuck')).toBe(false);
    });
  });
});

describe('Convenience functions', () => {
  describe('checkContent', () => {
    it('should return filter result', () => {
      const result = checkContent('This is fuck content');
      expect(result.isClean).toBe(false);
      expect(result.detectedWords).toContain('fuck');
    });
  });

  describe('isContentClean', () => {
    it('should return true for clean content', () => {
      expect(isContentClean('This is clean content')).toBe(true);
    });

    it('should return false for sensitive content', () => {
      expect(isContentClean('This is fuck content')).toBe(false);
    });
  });
});