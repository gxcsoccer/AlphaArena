// Mock PDFKit and PdfPrinter for tests
export class PDFDocument {
  constructor() {}
  pipe() { return this; }
  end() {}
  fontSize() { return this; }
  font() { return this; }
  text() { return this; }
  moveDown() { return this; }
  addPage() { return this; }
}

export default PDFDocument;