// Mock pdfmake for tests
class PdfPrinter {
  constructor(_fonts: any) {
    // Mock constructor
  }
  
  createPdfKitDocument(_docDefinitions: any, _options?: any): any {
    return {
      pipe: () => this,
      end: () => {},
      on: () => {},
    };
  }
}

// Export as default (CommonJS style for require)
module.exports = PdfPrinter;

// Also export as named export for ES module style
export { PdfPrinter };
export default PdfPrinter;