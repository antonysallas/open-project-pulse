const overflows = (el: HTMLElement): boolean => el.scrollHeight > el.clientHeight + 1;

const shrink = (host: HTMLElement, name: string, boxes: HTMLElement[]): void => {
  for (let k = 1; k >= 0.6; k -= 0.05) {
    host.style.setProperty(name, k.toFixed(2));
    if (!boxes.some(overflows)) return;
  }
};

// Shrink item text (--fit) on a PDF page until no [data-fit-box] in it
// overflows, down to 60%. A box with data-fit-var (the objectives) shrinks
// on its own scale first, so it doesn't shrink the rest of the page. The
// preview and the export both use it, so the preview shows the text at the
// size it will be exported.
export function fitPage(page: HTMLElement): void {
  const boxes = Array.from(page.querySelectorAll<HTMLElement>('[data-fit-box]'));
  for (const box of boxes.filter((b) => b.dataset.fitVar)) shrink(box, box.dataset.fitVar as string, [box]);
  shrink(page, '--fit', boxes.filter((b) => !b.dataset.fitVar));
}
