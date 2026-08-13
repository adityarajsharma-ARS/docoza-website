// PdfOrganizeBridge — the JS half of lib/services/pdf/web/pdf_lib_bridge.dart.
//
// Performs TRUE structural PDF page copies (and crop-box edits) via
// pdf-lib's PDFDocument, so page geometry/vector content is preserved
// exactly instead of being re-rendered through Syncfusion's
// createTemplate() (see the architecture note atop organize_tools.dart
// for the full rationale).
//
// Requires pdf-lib to be loaded first — see the <script> tags added to
// web/index.html.
(function () {
  const { PDFDocument, degrees } = PDFLib;

  /**
   * @param {Uint8Array[]} sources
   * @param {string} instructionsJson  JSON array of {srcIndex, pageIndex, addRotation}
   * @returns {Promise<Uint8Array>}
   */
  async function buildPdf(sources, instructionsJson) {
    const instructions = JSON.parse(instructionsJson);

    // Load every distinct source document once, even if it's referenced by
    // multiple instructions (e.g. merge with duplicate/re-ordered pages).
    const srcDocs = await Promise.all(
      sources.map((bytes) => PDFDocument.load(bytes))
    );

    const outDoc = await PDFDocument.create();

    for (const inst of instructions) {
      const srcDoc = srcDocs[inst.srcIndex];
      const [copiedPage] = await outDoc.copyPages(srcDoc, [inst.pageIndex]);

      if (inst.addRotation) {
        const current = copiedPage.getRotation().angle || 0;
        const next = (current + inst.addRotation * 90 + 360) % 360;
        copiedPage.setRotation(degrees(next));
      }

      outDoc.addPage(copiedPage);
    }

    return outDoc.save();
  }

  /**
   * @param {Uint8Array} source
   * @param {string} cropsJson  JSON array of {pageIndex, left, top, right, bottom} in PDF points
   * @returns {Promise<Uint8Array>}
   */
  async function cropPdf(source, cropsJson) {
    const crops = JSON.parse(cropsJson);
    const doc = await PDFDocument.load(source);

    for (const c of crops) {
      const page = doc.getPage(c.pageIndex);
      const w = page.getWidth();
      const h = page.getHeight();

      const x = c.left;
      const y = c.bottom;
      const width = Math.max(0, w - c.left - c.right);
      const height = Math.max(0, h - c.top - c.bottom);

      page.setCropBox(x, y, width, height);
      page.setMediaBox(x, y, width, height);
    }

    return doc.save();
  }

  window.PdfOrganizeBridge = { buildPdf, cropPdf };
})();
