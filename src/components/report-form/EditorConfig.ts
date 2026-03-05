/**
 * Rich text editor toolbar configuration
 */
export const quillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
};

/**
 * Special configuration for Accomplishments and Goals sections
 * that removes list options to avoid confusion with automated numbering
 */
export const paragraphQuillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    ['link'],
    ['clean']
  ],
  clipboard: {
    // Simplify pasted content
    matchVisual: false
  }
};