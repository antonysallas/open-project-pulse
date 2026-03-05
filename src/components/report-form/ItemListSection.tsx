import React from 'react';
import { Box, Typography, Grid, Button, FormControl, InputLabel, MenuItem, Select, IconButton, SelectChangeEvent } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
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
      // Just update the current item with the content
      // Don't try to parse paragraphs on every keystroke as it causes performance issues
      const newItems = [...items];
      newItems[index] = { ...newItems[index], text: content || '' };
      onItemsChange(newItems);
    } catch (error) {
      console.error("Error processing text input:", error);

      // Fallback just in case
      const newItems = [...items];
      newItems[index] = { ...newItems[index], text: content || '' };
      onItemsChange(newItems);
    }
  };

  const handleItemTypeChange = (index: number) => (event: SelectChangeEvent<ItemType>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], type: event.target.value as ItemType };
    onItemsChange(newItems);
  };

  const handleAddItem = () => {
    onItemsChange([...items, { text: '', type: defaultType }]);
  };

  const handleRemoveItem = (index: number) => () => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
        {title}
      </Typography>

      {items.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', mb: 2, alignItems: 'start' }}>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={showItemType ? (showDeleteButton ? 8 : 9) : (showDeleteButton ? 11 : 12)}>
              <Box>
                {showItemLabels && (
                  <Typography variant="subtitle2" gutterBottom>
                    {itemLabel} {index + 1}
                  </Typography>
                )}
                <Box
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    '& .quill': {
                      display: 'flex',
                      flexDirection: 'column'
                    },
                    '& .ql-container': {
                      height: 'auto',
                      minHeight: !showAddButton ? '100px' : '50px'
                    },
                    '& .ql-editor': {
                      minHeight: !showAddButton ? '100px' : '50px',
                      maxHeight: !showAddButton ? '200px' : '150px',
                      overflowY: 'auto'
                    }
                  }}
                >
                  <ReactQuill
                    value={item.text}
                    onChange={content => handleItemTextChange(index)(content)}
                    modules={modules}
                    placeholder={!showAddButton ? "Enter items, with each point on a new line. Press Enter to create a new line..." : ""}
                  />
                  {!showAddButton && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                      <strong>Important:</strong> Start each new item on a new line. Press Enter to create a new numbered point.
                    </Typography>
                  )}
                </Box>
              </Box>
            </Grid>

            {showItemType && (
              <Grid item xs={3}>
                <FormControl fullWidth>
                  <InputLabel id={`item-type-label-${index}`}>Type</InputLabel>
                  <Select
                    labelId={`item-type-label-${index}`}
                    value={item.type}
                    label="Type"
                    onChange={handleItemTypeChange(index)}
                  >
                    <MenuItem value="ASK">ASK</MenuItem>
                    <MenuItem value="APPROVAL">APPROVAL</MenuItem>
                    <MenuItem value="DIRECTIVE">DIRECTIVE</MenuItem>
                    <MenuItem value="FYI">FYI</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {showDeleteButton && (
              <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton color="error" onClick={handleRemoveItem(index)}>
                  <DeleteIcon />
                </IconButton>
              </Grid>
            )}
          </Grid>
        </Box>
      ))}

      {showAddButton && (
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddItem}
          variant="outlined"
          disabled={items.length >= 10}
        >
          Add {itemLabel}
        </Button>
      )}

      {/* <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
        Maximum 10 items allowed (currently {items.length}/10)
      </Typography> */}
    </Box>
  );
};

export default ItemListSection;