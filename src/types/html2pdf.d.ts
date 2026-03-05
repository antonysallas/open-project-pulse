declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    enableLinks?: boolean;
    html2canvas?: object;
    jsPDF?: object;
  }

  interface Html2PdfInterface {
    set: (options: Html2PdfOptions) => Html2PdfInterface;
    from: (element: HTMLElement | string) => Html2PdfInterface;
    save: () => Promise<void>;
    toPdf: () => any;
    get: (type: string, options?: any) => any;
    output: (type: string, options?: any) => any;
    outputPdf: (type?: string) => any;
  }

  export default function html2pdf(): Html2PdfInterface;
  export default function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Html2PdfInterface;
}