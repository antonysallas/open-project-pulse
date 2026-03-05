import React, { useEffect } from 'react';
import {
  Button,
  Card,
  CardBody,
  DatePicker,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { ReportData } from '../../types/ReportTypes';
import { generateTimelineDates, generateTimelineDatesFromSprints, findCurrentTimelinePosition } from './DateUtils';

const getMaxSprintNumber = (reportData: ReportData): number => {
  if (!reportData.projectStartDate || !reportData.projectEndDate) {
    return 8;
  }
  const projectDuration = Math.ceil(
    (reportData.projectEndDate.getTime() - reportData.projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const projectWeeks = Math.ceil(projectDuration / 7);
  const maxSprint = Math.ceil(projectWeeks / reportData.sprintDuration);
  return Math.max(maxSprint, 1);
};

const formatDate = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

interface TimelineFormProps {
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

const TimelineForm: React.FC<TimelineFormProps> = ({ reportData, onDataChange, onPrevStep, onNextStep }) => {
  useEffect(() => {
    if (reportData.projectSprints && reportData.projectSprints.length > 0 && reportData.timelineDates.length === 0) {
      const newDates = generateTimelineDatesFromSprints(reportData.projectSprints);
      onDataChange({
        timelineDates: newDates,
        currentTimelinePosition: findCurrentTimelinePosition(newDates, reportData.reportDate)
      });
    } else if (reportData.timelineDates.length === 0 && reportData.projectStartDate && reportData.projectEndDate) {
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
    <div>
      <Title headingLevel="h3" style={{ marginBottom: '16px', color: 'var(--primary-blue)' }}>
        Sprint Information
      </Title>

      <Grid hasGutter>
        <GridItem span={12}>
          <Grid hasGutter style={{ marginTop: '16px' }}>
            <GridItem span={12} sm={6}>
              <FormGroup label="Current Sprint" fieldId="timeline-current-sprint">
                <FormSelect
                  id="timeline-current-sprint"
                  value={String(reportData.currentSprint)}
                  onChange={(_event, value) => {
                    onDataChange({ currentSprint: Number(value) });
                  }}
                  aria-label="Current Sprint"
                >
                  {reportData.projectSprints && reportData.projectSprints.length > 0 ? (
                    reportData.projectSprints.map((sprint) => (
                      <FormSelectOption key={sprint.number} value={String(sprint.number)} label={sprint.name} />
                    ))
                  ) : (
                    Array.from({ length: getMaxSprintNumber(reportData) }).map((_, index) => (
                      <FormSelectOption key={index + 1} value={String(index + 1)} label={`Sprint ${index + 1}`} />
                    ))
                  )}
                </FormSelect>
              </FormGroup>
            </GridItem>

            <GridItem span={12} sm={6}>
              <FormGroup label="Project Status" fieldId="timeline-status">
                <FormSelect
                  id="timeline-status"
                  value={reportData.status}
                  onChange={(_event, value) => {
                    onDataChange({ status: value as 'on-track' | 'at-risk' | 'delayed' });
                  }}
                  aria-label="Project Status"
                >
                  <FormSelectOption value="on-track" label="On Track" />
                  <FormSelectOption value="at-risk" label="At Risk" />
                  <FormSelectOption value="delayed" label="Delayed" />
                </FormSelect>
              </FormGroup>
            </GridItem>
          </Grid>
        </GridItem>

        <GridItem span={12}>
          <Title headingLevel="h3" style={{ marginBottom: '16px', color: 'var(--primary-blue)' }}>
            Timeline and Sprint Mapping
          </Title>

          <Card isPlain style={{ backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', marginBottom: '16px' }}>
            <CardBody>
              <strong>Timeline for {reportData.projectTitle}</strong>
              <p style={{ marginTop: '4px', fontSize: '14px' }}>
                {reportData.projectSprints && reportData.projectSprints.length > 0
                  ? "Timeline is auto-generated based on predefined sprint dates from project configuration."
                  : `Timeline is auto-generated with sprint duration of ${reportData.sprintDuration} weeks.`}
              </p>
            </CardBody>
          </Card>

          {reportData.projectSprints && reportData.projectSprints.map((sprint) => {
            const sprintDates = reportData.timelineDates.filter(
              weekItem => weekItem.sprintNumber === sprint.number
            );
            if (sprintDates.length === 0) return null;

            return (
              <div key={sprint.number} style={{
                marginBottom: '24px',
                padding: '16px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                borderLeft: '3px solid #3498db',
                backgroundColor: '#f8fbff'
              }}>
                <strong style={{ color: '#3498db', marginBottom: '8px', display: 'block' }}>
                  {sprint.name}: {new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()}
                </strong>

                {sprintDates.map((weekItem, index) => (
                  <div key={index} style={{ display: 'flex', marginBottom: '8px', alignItems: 'center', gap: '8px' }}>
                    <DatePicker
                      value={formatDate(weekItem.date)}
                      isDisabled
                      aria-label={weekItem.isSprintStart ? "Sprint Start" : "Sprint Date"}
                    />
                    <TextInput
                      value={weekItem.label}
                      type="text"
                      aria-label="Label"
                      style={{ width: '120px' }}
                      onChange={(_event, value) => {
                        const newDates = [...reportData.timelineDates];
                        const dateIndex = reportData.timelineDates.findIndex(
                          d => d.date.getTime() === weekItem.date.getTime()
                        );
                        if (dateIndex >= 0) {
                          newDates[dateIndex] = { ...newDates[dateIndex], label: value };
                          onDataChange({ timelineDates: newDates });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {(!reportData.projectSprints || reportData.projectSprints.length === 0) &&
            reportData.timelineDates.map((weekItem, index) => (
              <div key={index} style={{
                display: 'flex',
                marginBottom: '8px',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: weekItem.isSprintStart ? '#f0f7ff' : 'transparent',
                padding: weekItem.isSprintStart ? '8px' : '0',
                borderLeft: weekItem.isSprintStart ? '3px solid #3498db' : 'none',
              }}>
                {weekItem.isSprintStart && (
                  <strong style={{ marginRight: '8px', color: '#3498db' }}>
                    Sprint {weekItem.sprintNumber} →
                  </strong>
                )}
                <DatePicker
                  value={formatDate(weekItem.date)}
                  isDisabled
                  aria-label={`Week ${index + 1} ${weekItem.isSprintStart ? '(Sprint Start)' : ''}`}
                />
                <TextInput
                  value={weekItem.label}
                  type="text"
                  aria-label="Label"
                  style={{ width: '120px' }}
                  onChange={(_event, value) => {
                    const newDates = [...reportData.timelineDates];
                    newDates[index] = { ...newDates[index], label: value };
                    onDataChange({ timelineDates: newDates });
                  }}
                />
              </div>
            ))
          }
        </GridItem>

        <GridItem span={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <Button variant="secondary" onClick={onPrevStep}>
              Back to Basic Info
            </Button>
            <Button variant="primary" onClick={onNextStep}>
              Next: Sections &amp; Content
            </Button>
          </div>
        </GridItem>
      </Grid>
    </div>
  );
};

export default TimelineForm;
