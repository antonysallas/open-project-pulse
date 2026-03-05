import React from 'react';
import { ReportItem, ItemType } from '../../types/ReportTypes';

interface ItemsByTypeSectionProps {
  title: string;
  items: ReportItem[];
}

interface ProcessedItem {
  html: string;
  plainText: string;
}

const ItemsByTypeSection: React.FC<ItemsByTypeSectionProps> = ({ title, items }) => {
  const itemTypes: ItemType[] = ['ASK', 'APPROVAL', 'DIRECTIVE', 'FYI'];
  
  /**
   * Processes text input to create an array of individual items for display
   * while preserving formatting (bold, italic, etc.)
   */
  const processTextToItems = (text: string): ProcessedItem[] => {
    // Empty check
    if (!text || text.trim() === '') return [];

    // ReactQuill creates <p> tags, so we need to extract each paragraph
    const div = document.createElement('div');
    div.innerHTML = text;

    // Extract each paragraph with its formatting
    const items: ProcessedItem[] = [];
    div.querySelectorAll('p').forEach(p => {
      // Get both the HTML (for formatting) and plain text (for filtering empty paragraphs)
      const html = p.innerHTML;
      const plainText = p.textContent?.trim() || '';
      
      if (plainText.length > 0) {
        items.push({ 
          html: html,
          plainText: plainText
        });
      }
    });

    // If no paragraphs found, handle plain text with line breaks
    if (items.length === 0) {
      return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => ({
          html: line,
          plainText: line
        }));
    }

    return items;
  };
  
  return (
    <div className="section">
      <div className="section-header">{title}</div>
      <div className="section-content">
        {itemTypes.map(tagType => {
          const filteredItems = items.filter(item => item.type === tagType);
          if (filteredItems.length === 0) return null;

          return (
            <div key={tagType} style={{ marginBottom: '15px' }}>
              <div className="subsection-title">
                <div className={`tag tag-${tagType.toLowerCase()}`}>{tagType}</div>
              </div>
              <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
                <ul className="custom-list" style={{ margin: 0, paddingLeft: '10px', listStyleType: 'none' }}>
                  {filteredItems.flatMap((item, idx) => {
                    // Process each item's text to handle paragraphs while preserving formatting
                    const processedItems = processTextToItems(item.text);
                    
                    // Calculate the starting index for this item's paragraphs
                    const startIndex = idx === 0 ? 1 : 
                      // Sum up the lengths of all previous items' processedItems
                      filteredItems.slice(0, idx).reduce((sum, prevItem) => {
                        return sum + processTextToItems(prevItem.text).length;
                      }, 1);
                    
                    // If we have multiple paragraphs within an item, display them as separate list items
                    return processedItems.map((processedItem, textIdx) => (
                      <li key={`${idx}-${textIdx}`} style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                        <span style={{ 
                          color: '#1976d2', 
                          fontSize: '14px', 
                          marginRight: '8px', 
                          minWidth: '20px',
                          fontWeight: 'bold'
                        }}>
                          {startIndex + textIdx}. 
                        </span>
                        <span 
                          style={{ fontSize: '14px' }}
                          dangerouslySetInnerHTML={{ __html: processedItem.html }}
                        />
                      </li>
                    ));
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ItemsByTypeSection;