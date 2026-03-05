import React from 'react';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  Title,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashIcon } from '@patternfly/react-icons';
import { ItemType, ReportItem } from '../../types/ReportTypes';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { quillModules } from './EditorConfig';

interface ItemListSectionProps {
  title: string;
  items: ReportItem[];
  itemLabel: string;
  onItemsChange: (items: ReportItem[]) => void;
  showItemType?: boolean;
  defaultType?: ItemType;
  showAddButton?: boolean;
  showItemLabels?: boolean;
  showDeleteButton?: boolean;
  modules?: any;
}

const ItemListSection: React.FC<ItemListSectionProps> = ({
  title,
  items,
  itemLabel,
  onItemsChange,
  showItemType = true,
  defaultType = 'FYI',
  showAddButton = true,
  showItemLabels = true,
  showDeleteButton = true,
  modules = quillModules
}) => {
  const handleItemTextChange = (index: number) => (content: string) => {
    try {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], text: content || '' };
      onItemsChange(newItems);
    } catch (error) {
      console.error("Error processing text input:", error);
      const newItems = [...items];
      newItems[index] = { ...newItems[index], text: content || '' };
      onItemsChange(newItems);
    }
  };

  const handleItemTypeChange = (index: number) => (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], type: value as ItemType };
    onItemsChange(newItems);
  };

  const handleAddItem = () => {
    onItemsChange([...items, { text: '', type: defaultType }]);
  };

  const handleRemoveItem = (index: number) => () => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const editorColSpan = showItemType ? (showDeleteButton ? 8 : 9) : (showDeleteButton ? 11 : 12);

  return (
    <div style={{ marginBottom: '32px' }}>
      <Title headingLevel="h3" style={{ marginBottom: '16px', color: 'var(--primary-blue)' }}>
        {title}
      </Title>

      {items.map((item, index) => (
        <Grid hasGutter key={index} style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
          <GridItem span={editorColSpan as any}>
            <div>
              {showItemLabels && (
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                  {itemLabel} {index + 1}
                </strong>
              )}
              <div className="quill-editor-wrapper">
                <ReactQuill
                  value={item.text}
                  onChange={content => handleItemTextChange(index)(content)}
                  modules={modules}
                  placeholder={!showAddButton ? "Enter items, with each point on a new line. Press Enter to create a new line..." : ""}
                />
                {!showAddButton && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#6a6e73' }}>
                    <strong>Important:</strong> Start each new item on a new line. Press Enter to create a new numbered point.
                  </small>
                )}
              </div>
            </div>
          </GridItem>

          {showItemType && (
            <GridItem span={3}>
              <FormGroup label="Type" fieldId={`item-type-${index}`}>
                <FormSelect
                  id={`item-type-${index}`}
                  value={item.type}
                  onChange={handleItemTypeChange(index)}
                  aria-label="Item type"
                >
                  <FormSelectOption value="ASK" label="ASK" />
                  <FormSelectOption value="APPROVAL" label="APPROVAL" />
                  <FormSelectOption value="DIRECTIVE" label="DIRECTIVE" />
                  <FormSelectOption value="FYI" label="FYI" />
                </FormSelect>
              </FormGroup>
            </GridItem>
          )}

          {showDeleteButton && (
            <GridItem span={1} style={{ display: 'flex', alignItems: 'center' }}>
              <Button
                variant="plain"
                aria-label="Delete item"
                onClick={handleRemoveItem(index)}
                style={{ color: '#c9190b' }}
              >
                <TrashIcon />
              </Button>
            </GridItem>
          )}
        </Grid>
      ))}

      {showAddButton && (
        <Button
          variant="secondary"
          icon={<PlusCircleIcon />}
          onClick={handleAddItem}
          isDisabled={items.length >= 10}
        >
          Add {itemLabel}
        </Button>
      )}
    </div>
  );
};

export default ItemListSection;
