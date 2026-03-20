// Mock JSDOM for tests - avoid ESM issues with jsdom and its dependencies
export class JSDOM {
  constructor(_html: string) {}
  get window() {
    return {
      document: {
        createElement: () => ({
          setAttribute: () => {},
          removeAttribute: () => {},
        }),
        createTextNode: () => ({}),
        documentElement: {},
      },
      Node: {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3,
      },
    };
  }
}