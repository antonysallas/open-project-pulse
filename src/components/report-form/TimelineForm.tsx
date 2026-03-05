import React, { useEffect } from 'react';
import { Box, Typography, Grid, Button, FormControl, InputLabel, MenuItem, Select, TextField, Paper, SelectChangeEvent } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { ReportData } from '../../types/ReportTypes';
import { generateTimelineDates, generateTimelineDatesFromSprints, findCurrentTimelinePosition } from './DateUtils';

/**
 * Calculate the maximum sprint number based on project duration and sprint length
 */
const getMaxSprintNumber = (reportData: ReportData): number => {
  if (!reportData.projectStartDate || !reportData.projectEndDate) {
    return 8; // Fallback to original hardcoded value
  }
  
  // Calculate total project duration in days
  const projectDuration = Math.ceil(
    (reportData.projectEndDate.getTime() - reportData.projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Convert days to weeks
  const projectWeeks = Math.ceil(projectDuration / 7);
  
  // Calculate max sprint number based on weeks and sprint duration
  const maxSprint = Math.ceil(projectWeeks / reportData.sprintDuration);
  
  // Return at least 1 sprint
  return Math.max(maxSprint, 1);
};

interface TimelineFormProps {
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

const TimelineForm: React.FC<TimelineFormProps> = ({ reportData, onDataChange, onPrevStep, onNextStep }) => {
  // Auto-generate timeline when component mounts or when specific project details change
  useEffect(() => {
    // Check if we have predefined sprints
    if (reportData.projectSprints && reportData.projectSprints.length > 0 && reportData.timelineDates.length === 0) {
      // Generate timeline from sprint definitions
      const newDates = generateTimelineDatesFromSprints(reportData.projectSprints);
      
      onDataChange({
        timelineDates: newDates,
        currentTimelinePosition: findCurrentTimelinePosition(newDates, reportData.reportDate)
      });
    } 
    // Fallback to the original method if no sprints defined
    else if (reportData.timelineDates.length === 0 && reportData.projectStartDate && reportData.projectEndDate) {
      const newDates = generateTimelineDates(
        reportData.projectStartDate,
        reportData.projectEndDate,
        reportData.sprintDuration,
        reportData.sprintStart || 1
      );

      onDataChange({
        timelineDates: newDates,
        currentTimelinePosition: findCurrentTimelinePosition(newDates, reportData.reportDate)
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData.projectSprints, reportData.projectStartDate, reportData.projectEndDate]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
        Sprint Information
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="current-sprint-label">Current Sprint</InputLabel>
                <Select
                  labelId="current-sprint-label"
                  value={reportData.currentSprint}
                  label="Current Sprint"
                  onChange={(e: SelectChangeEvent<number>) => {
                    onDataChange({ currentSprint: Number(e.target.value) });
                  }}
                >
                  {/* Use predefined sprints from project details */}
                  {reportData.projectSprints && reportData.projectSprints.length > 0 ? (
                    reportData.projectSprints.map((sprint) => (
                      <MenuItem key={sprint.number} value={sprint.number}>
                        {sprint.name}
                      </MenuItem>
                    ))
                  ) : (
                    // Fall back to the old method if no sprints are defined
                    Array.from({ length: getMaxSprintNumber(reportData) }).map((_, index) => (
                      <MenuItem key={index + 1} value={index + 1}>Sprint {index + 1}</MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="status-label">Project Status</InputLabel>
                <Select
                  labelId="status-label"
                  value={reportData.status}
                  label="Project Status"
                  onChange={(e) => {
                    onDataChange({
                      status: e.target.value as 'on-track' | 'at-risk' | 'delayed'
                    });
                  }}
                >
                  <MenuItem value="on-track">On Track</MenuItem>
                  <MenuItem value="at-risk">At Risk</MenuItem>
                  <MenuItem value="delayed">Delayed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'var(--primary-blue)' }}>
            Timeline and Sprint Mapping
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Timeline for {reportData.projectTitle}
              </Typography>
              <Typography variant="body2">
                {reportData.projectSprints && reportData.projectSprints.length > 0 
                  ? "Timeline is auto-generated based on predefined sprint dates from project configuration."
                  : `Timeline is auto-generated with sprint duration of ${reportData.sprintDuration} weeks.`}
              </Typography>
            </Paper>
          </Box>

          {/* Group timeline dates by sprint */}
          {reportData.projectSprints && reportData.projectSprints.map((sprint) => {
            // Find all timeline dates for this sprint
            const sprintDates = reportData.timelineDates.filter(
              weekItem => weekItem.sprintNumber === sprint.number
            );
            
            // Only render if there are dates for this sprint
            if (sprintDates.length === 0) return null;
            
            return (
              <Box key={sprint.number} sx={{
                mb: 3,
                p: 2,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                borderLeft: '3px solid #3498db',
                bgcolor: '#f8fbff'
              }}>
                <Typography 
                  variant="subtitle1" 
                  sx={{ mb: 2, color: '#3498db', fontWeight: 'bold' }}
                >
                  {sprint.name}: {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                </Typography>
                
                {sprintDates.map((weekItem, index) => (
                  <Box key={index} sx={{
                    display: 'flex',
                    mb: 1,
                    alignItems: 'center',
                  }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DatePicker
                        label={weekItem.isSprintStart ? "Sprint Start" : "Sprint Date"}
                        value={dayjs(weekItem.date)}
                        readOnly
                        slotProps={{ textField: { fullWidth: true, size: "small" } }}
                      />
                    </LocalizationProvider>
                    <TextField
                      value={weekItem.label}
                      label="Label"
                      size="small"
                      sx={{ width: '120px', ml: 1 }}
                      onChange={(e) => {
                        // Just update the label without changing sprint assignments
                        const newDates = [...reportData.timelineDates];
                        const dateIndex = reportData.timelineDates.findIndex(
                          d => d.date.getTime() === weekItem.date.getTime()
                        );
                        if (dateIndex >= 0) {
                          newDates[dateIndex] = {
                            ...newDates[dateIndex],
                            label: e.target.value
                          };
                          onDataChange({
                            timelineDates: newDates
                          });
                        }
                      }}
                    />
                  </Box>
                ))}
              </Box>
            );
          })}
          
          {/* Fallback display for non-sprint based timeline (old method) */}
          {(!reportData.projectSprints || reportData.projectSprints.length === 0) && 
            reportData.timelineDates.map((weekItem, index) => (
              <Box key={index} sx={{
                display: 'flex',
                mb: 1,
                alignItems: 'center',
                bgcolor: weekItem.isSprintStart ? '#f0f7ff' : 'transparent',
                p: weekItem.isSprintStart ? 1 : 0,
                borderLeft: weekItem.isSprintStart ? '3px solid #3498db' : 'none',
              }}>
                {weekItem.isSprintStart && (
                  <Box sx={{ mr: 2, color: '#3498db', fontWeight: 'bold' }}>
                    Sprint {weekItem.sprintNumber} →
                  </Box>
                )}
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label={`Week ${index + 1} ${weekItem.isSprintStart ? '(Sprint Start)' : ''}`}
                    value={dayjs(weekItem.date)}
                    readOnly
                    slotProps={{ textField: { fullWidth: true, size: "small" } }}
                  />
                </LocalizationProvider>
                <TextField
                  value={weekItem.label}
                  label="Label"
                  size="small"
                  sx={{ width: '120px', ml: 1 }}
                  onChange={(e) => {
                    const newDates = [...reportData.timelineDates];
                    newDates[index] = {
                      ...newDates[index],
                      label: e.target.value
                    };
                    onDataChange({
                      timelineDates: newDates
                    });
                  }}
                />
              </Box>
            ))
          }
        </Grid>

        <Grid item xs={12}>
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
              onClick={onNextStep}
            >
              Next: Sections & Content
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TimelineForm;