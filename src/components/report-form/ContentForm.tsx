import React, { useEffect } from 'react';
import { Box, Button, Typography, Grid, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { ReportData, ItemType } from '../../types/ReportTypes';
import ItemListSection from './ItemListSection';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { paragraphQuillModules } from './EditorConfig';

interface ContentFormProps {
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

const ContentForm: React.FC<ContentFormProps> = ({ reportData, onDataChange, onPrevStep, onNextStep }) => {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);
  
  // Log when reportData changes to help with debugging
  useEffect(() => {
    console.log("ContentForm received reportData:", reportData);
    // Verify that the content sections are properly populated
    console.log("Accomplishments:", reportData.accomplishments.length);
    console.log("Upcoming Goals:", reportData.upcomingGoals.length);
    console.log("People & Process:", reportData.peopleAndProcess.length);
    console.log("Technology:", reportData.technology.length);
  }, [reportData]);

  // Ensure default text areas are present
  useEffect(() => {
    // For accomplishments, always ensure at least one item
    if (reportData.accomplishments.length === 0) {
      onDataChange({
        accomplishments: [{ text: '', type: 'FYI' }]
      });
    }

    // For upcoming goals, always ensure at least one item
    if (reportData.upcomingGoals.length === 0) {
      onDataChange({
        upcomingGoals: [{ text: '', type: 'ASK' }]
      });
    }

    // For people & process, ensure at least one FYI item if empty
    if (reportData.peopleAndProcess.length === 0) {
      onDataChange({
        peopleAndProcess: [{ text: '', type: 'FYI' }]
      });
    }

    // For technology, ensure at least one FYI item if empty
    if (reportData.technology.length === 0) {
      onDataChange({
        technology: [{ text: '', type: 'FYI' }]
      });
    }
  }, [reportData, onDataChange]);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Enter accomplishments below. Put each accomplishment on a new line for proper numbering in the report.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontWeight: 'bold' }}>
          Press Enter after each item to create a new numbered point.
        </Typography>
      </Box>
      <ItemListSection
        title="Accomplishments"
        items={reportData.accomplishments}
        itemLabel="Accomplishment"
        onItemsChange={(items) => onDataChange({ accomplishments: items })}
        showItemType={false}
        showAddButton={false}
        showItemLabels={false}
        showDeleteButton={false}
        modules={paragraphQuillModules}
      />

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          Enter upcoming goals below. Put each goal on a new line for proper numbering in the report.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontWeight: 'bold' }}>
          Press Enter after each item to create a new numbered point.
        </Typography>
      </Box>
      <ItemListSection
        title="Upcoming Goals"
        items={reportData.upcomingGoals}
        itemLabel="Goal"
        onItemsChange={(items) => onDataChange({ upcomingGoals: items })}
        showItemType={false}
        defaultType="ASK"
        showAddButton={false}
        showItemLabels={false}
        showDeleteButton={false}
        modules={paragraphQuillModules}
      />

      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
          People and Process
        </Typography>

        <Grid container spacing={3}>
          {reportData.peopleAndProcess.map((item, index) => (
            <Grid item xs={12} key={index}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={8}>
                  <Box sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    '& .quill': {
                      display: 'flex',
                      flexDirection: 'column'
                    },
                    '& .ql-container': {
                      height: 'auto',
                      minHeight: '50px'
                    },
                    '& .ql-editor': {
                      minHeight: '50px',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }
                  }}>
                    <ReactQuill
                      value={item.text}
                      onChange={(content) => {
                        const newItems = [...reportData.peopleAndProcess];
                        newItems[index] = { ...newItems[index], text: content };
                        onDataChange({ peopleAndProcess: newItems });
                      }}
                      modules={paragraphQuillModules}
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                      <strong>Tip:</strong> Press Enter to create a new line. Each paragraph will become a separate numbered item.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <FormControl fullWidth>
                    <InputLabel id={`people-type-label-${index}`}>Type</InputLabel>
                    <Select
                      labelId={`people-type-label-${index}`}
                      value={item.type}
                      label="Type"
                      onChange={(e: SelectChangeEvent<ItemType>) => {
                        const newItems = [...reportData.peopleAndProcess];
                        newItems[index] = { ...newItems[index], type: e.target.value as ItemType };
                        onDataChange({ peopleAndProcess: newItems });
                      }}
                    >
                      <MenuItem value="ASK">ASK</MenuItem>
                      <MenuItem value="APPROVAL">APPROVAL</MenuItem>
                      <MenuItem value="DIRECTIVE">DIRECTIVE</MenuItem>
                      <MenuItem value="FYI">FYI</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    color="error"
                    onClick={() => {
                      const newItems = reportData.peopleAndProcess.filter((_, i) => i !== index);
                      onDataChange({ peopleAndProcess: newItems });
                    }}
                    aria-label="Delete item"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                onDataChange({
                  peopleAndProcess: [...reportData.peopleAndProcess, { text: '', type: 'FYI' }]
                });
              }}
              variant="outlined"
              disabled={reportData.peopleAndProcess.length >= 10}
            >
              Add People & Process Item
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Maximum 10 items allowed (currently {reportData.peopleAndProcess.length}/10)
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
          Technology
        </Typography>

        <Grid container spacing={3}>
          {reportData.technology.map((item, index) => (
            <Grid item xs={12} key={index}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid item xs={8}>
                  <Box sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    mb: 1,
                    '& .quill': {
                      display: 'flex',
                      flexDirection: 'column'
                    },
                    '& .ql-container': {
                      height: 'auto',
                      minHeight: '50px'
                    },
                    '& .ql-editor': {
                      minHeight: '50px',
                      maxHeight: '150px',
                      overflowY: 'auto'
                    }
                  }}>
                    <ReactQuill
                      value={item.text}
                      onChange={(content) => {
                        const newItems = [...reportData.technology];
                        newItems[index] = { ...newItems[index], text: content };
                        onDataChange({ technology: newItems });
                      }}
                      modules={paragraphQuillModules}
                    />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                      <strong>Tip:</strong> Press Enter to create a new line. Each paragraph will become a separate numbered item.
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <FormControl fullWidth>
                    <InputLabel id={`tech-type-label-${index}`}>Type</InputLabel>
                    <Select
                      labelId={`tech-type-label-${index}`}
                      value={item.type}
                      label="Type"
                      onChange={(e: SelectChangeEvent<ItemType>) => {
                        const newItems = [...reportData.technology];
                        newItems[index] = { ...newItems[index], type: e.target.value as ItemType };
                        onDataChange({ technology: newItems });
                      }}
                    >
                      <MenuItem value="ASK">ASK</MenuItem>
                      <MenuItem value="APPROVAL">APPROVAL</MenuItem>
                      <MenuItem value="DIRECTIVE">DIRECTIVE</MenuItem>
                      <MenuItem value="FYI">FYI</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    color="error"
                    onClick={() => {
                      const newItems = reportData.technology.filter((_, i) => i !== index);
                      onDataChange({ technology: newItems });
                    }}
                    aria-label="Delete item"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                onDataChange({
                  technology: [...reportData.technology, { text: '', type: 'FYI' }]
                });
              }}
              variant="outlined"
              disabled={reportData.technology.length >= 10}
            >
              Add Technology Item
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Maximum 10 items allowed (currently {reportData.technology.length}/10)
            </Typography>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={onPrevStep}
        >
          Back to Basic Info
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            // Here we need to trigger both setTabValue("2") and handleNext() in App.tsx
            onNextStep();
            // We'll fix the outer App.tsx to handle this correctly
          }}
        >
          Preview & Generate
        </Button>
      </Box>
    </Box>
  );
};

export default ContentForm;