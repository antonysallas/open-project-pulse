// Loaded on demand by the report editor: html2canvas and jsPDF are most of the bundle.
import html2canvas from 'html2canvas';
import { jsPDF as JsPdf } from 'jspdf';
import { fitPage } from './fit';

async function imagesLoaded(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  }))));
}

// Pages are captured as images. At 96 px to the inch on screen, a scale of 4
// gives about 385 dpi: sharp in print and at 200% zoom. PNG keeps text edges
// clean where JPEG would smear them.
export const PDF_SCALE = 4;

// Each [data-pdf-page] in `stage` becomes one A4 landscape page.
export async function exportPdf(stage: HTMLElement, scale = PDF_SCALE): Promise<JsPdf> {
  await document.fonts.ready;
  await imagesLoaded(stage);
  const pages = Array.from(stage.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (!pages.length) throw new Error("Couldn't draw the report. Try again.");
  const pdf = new JsPdf({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < pages.length; i++) {
    fitPage(pages[i]);
    // eslint-disable-next-line no-await-in-loop
    const canvas = await html2canvas(pages[i], { scale, backgroundColor: '#ffffff', logging: false, useCORS: true });
    if (i > 0) pdf.addPage('a4', 'landscape');
    pdf.addImage(canvas, 'PNG', 0, 0, 297, 210, undefined, 'SLOW');
  }
  return pdf;
}

export const pdfBase64 = (pdf: JsPdf): string => pdf.output('datauristring').split(',')[1];
