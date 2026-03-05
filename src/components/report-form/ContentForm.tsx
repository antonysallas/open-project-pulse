import React, { useEffect } from 'react';
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
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    console.log("ContentForm received reportData:", reportData);
    console.log("Accomplishments:", reportData.accomplishments.length);
    console.log("Upcoming Goals:", reportData.upcomingGoals.length);
    console.log("People & Process:", reportData.peopleAndProcess.length);
    console.log("Technology:", reportData.technology.length);
  }, [reportData]);

  useEffect(() => {
    if (reportData.accomplishments.length === 0) {
      onDataChange({ accomplishments: [{ text: '', type: 'FYI' }] });
    }
    if (reportData.upcomingGoals.length === 0) {
      onDataChange({ upcomingGoals: [{ text: '', type: 'ASK' }] });
    }
    if (reportData.peopleAndProcess.length === 0) {
      onDataChange({ peopleAndProcess: [{ text: '', type: 'FYI' }] });
    }
    if (reportData.technology.length === 0) {
      onDataChange({ technology: [{ text: '', type: 'FYI' }] });
    }
  }, [reportData, onDataChange]);

  const renderItemSection = (
    sectionTitle: string,
    sectionItems: { text: string; type: ItemType }[],
    dataKey: 'peopleAndProcess' | 'technology',
    addLabel: string
  ) => (
    <div style={{ marginTop: '32px', marginBottom: '32px' }}>
      <Title headingLevel="h3" style={{ marginBottom: '16px', color: 'var(--primary-blue)' }}>
        {sectionTitle}
      </Title>

      <Grid hasGutter>
        {sectionItems.map((item, index) => (
          <GridItem span={12} key={index}>
            <Grid hasGutter style={{ alignItems: 'flex-start' }}>
              <GridItem span={8}>
                <div className="quill-editor-wrapper">
                  <ReactQuill
                    value={item.text}
                    onChange={(content) => {
                      const newItems = [...sectionItems];
                      newItems[index] = { ...newItems[index], text: content };
                      onDataChange({ [dataKey]: newItems });
                    }}
                    modules={paragraphQuillModules}
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#6a6e73' }}>
                    <strong>Tip:</strong> Press Enter to create a new line. Each paragraph will become a separate numbered item.
                  </small>
                </div>
              </GridItem>
              <GridItem span={3}>
                <FormGroup label="Type" fieldId={`${dataKey}-type-${index}`}>
                  <FormSelect
                    id={`${dataKey}-type-${index}`}
                    value={item.type}
                    onChange={(_event, value) => {
                      const newItems = [...sectionItems];
                      newItems[index] = { ...newItems[index], type: value as ItemType };
                      onDataChange({ [dataKey]: newItems });
                    }}
                    aria-label="Item type"
                  >
                    <FormSelectOption value="ASK" label="ASK" />
                    <FormSelectOption value="APPROVAL" label="APPROVAL" />
                    <FormSelectOption value="DIRECTIVE" label="DIRECTIVE" />
                    <FormSelectOption value="FYI" label="FYI" />
                  </FormSelect>
                </FormGroup>
              </GridItem>
              <GridItem span={1} style={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  variant="plain"
                  aria-label="Delete item"
                  onClick={() => {
                    const newItems = sectionItems.filter((_, i) => i !== index);
                    onDataChange({ [dataKey]: newItems });
                  }}
                  style={{ color: '#c9190b' }}
                >
                  <TrashIcon />
                </Button>
              </GridItem>
            </Grid>
          </GridItem>
        ))}

        <GridItem span={12}>
          <Button
            variant="secondary"
            icon={<PlusCircleIcon />}
            onClick={() => {
              onDataChange({ [dataKey]: [...sectionItems, { text: '', type: 'FYI' }] });
            }}
            isDisabled={sectionItems.length >= 10}
          >
            {addLabel}
          </Button>
          <small style={{ display: 'block', marginTop: '4px', color: '#6a6e73' }}>
            Maximum 10 items allowed (currently {sectionItems.length}/10)
          </small>
        </GridItem>
      </Grid>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <small style={{ display: 'block', color: '#6a6e73' }}>
          Enter accomplishments below. Put each accomplishment on a new line for proper numbering in the report.
        </small>
        <small style={{ display: 'block', marginTop: '4px', color: '#6a6e73', fontWeight: 'bold' }}>
          Press Enter after each item to create a new numbered point.
        </small>
      </div>
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

      <div style={{ marginBottom: '16px' }}>
        <small style={{ display: 'block', color: '#6a6e73' }}>
          Enter upcoming goals below. Put each goal on a new line for proper numbering in the report.
        </small>
        <small style={{ display: 'block', marginTop: '4px', color: '#6a6e73', fontWeight: 'bold' }}>
          Press Enter after each item to create a new numbered point.
        </small>
      </div>
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

      {renderItemSection('People and Process', reportData.peopleAndProcess, 'peopleAndProcess', 'Add People & Process Item')}
      {renderItemSection('Technology', reportData.technology, 'technology', 'Add Technology Item')}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
        <Button variant="secondary" onClick={onPrevStep}>
          Back to Basic Info
        </Button>
        <Button variant="primary" onClick={() => onNextStep()}>
          Preview &amp; Generate
        </Button>
      </div>
    </div>
  );
};

export default ContentForm;
