import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Label, PanelSection } from '../../components';
import SegmentationConfig from './SegmentationConfig';
import SegmentationDropDownRow from './SegmentationDropDownRow';
import NoSegmentationRow from './NoSegmentationRow';
import AddSegmentRow from './AddSegmentRow';
import SegmentationGroupSegment from './SegmentationGroupSegment';
import { Select, Icon, Button, CheckBox } from '../../components';

const SegmentationGroupTable = ({
  segmentations,
  // segmentation initial config
  segmentationConfig,
  // UI show/hide
  disableEditing,
  showROIVolume,
  ROIVolume,
  showAddSegmentation,
  showAddSegment,
  showDeleteSegment,
  // segmentation/segment handlers
  onSegmentationAdd,
  onSegmentationEdit,
  onSegmentationClick,
  onSegmentationDelete,
  onSegmentationDownload,
  storeSegmentation,
  saveSegmentation,
  // segment handlers
  onSegmentClick,
  onSegmentAdd,
  onSegmentDelete,
  onSegmentEdit,
  onSegmentTypeEdit,
  onSegmentLocalizationEdit,
  onSegmentCapacityCalc,
  onToggleSegmentationVisibility,
  onToggleSegmentVisibility,
  onToggleSegmentLock,
  onSegmentColorClick,
  // segmentation config handlers
  setFillAlpha,
  setFillAlphaInactive,
  setOutlineWidthActive,
  setOutlineOpacityActive,
  setRenderFill,
  setRenderInactiveSegmentations,
  setRenderOutline,
}) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeSegmentationId, setActiveSegmentationId] = useState(null);

  const onActiveSegmentationChange = segmentationId => {
    onSegmentationClick(segmentationId);
    setActiveSegmentationId(segmentationId);
  };

  useEffect(() => {
    // find the first active segmentation to set
    let activeSegmentationIdToSet = segmentations?.find(segmentation => segmentation.isActive)?.id;

    // If there is no active segmentation, set the first one to be active
    if (!activeSegmentationIdToSet && segmentations?.length > 0) {
      activeSegmentationIdToSet = segmentations[0].id;
    }

    // If there is no segmentation, set the active segmentation to null
    if (segmentations?.length === 0) {
      activeSegmentationIdToSet = null;
    }

    setActiveSegmentationId(activeSegmentationIdToSet);
  }, [segmentations]);

  const activeSegmentation = segmentations?.find(
    segmentation => segmentation.id === activeSegmentationId
  );

  const segmentTypes = [
    { label: 'Solid', value: 'Solid' },
    { label: 'Part solid', value: 'Part solid' },
    { label: 'Non solid (GGN)', value: 'Non solid (GGN)' },
    { label: 'Juxtapleural', value: 'Juxtapleural' },
    { label: 'Airway nodule', value: 'Airway nodule' },
    { label: 'Atypical pulmonary cyst', value: 'Atypical pulmonary cyst' },
  ];

  const localizations = Array.from(Array(10).keys(), x => {
    return { label: (x + 1).toString(), value: (x + 1).toString() };
  });

  return (
    <div className="flex min-h-0 flex-col bg-black text-[13px] font-[300]">
      <PanelSection
        title="Segmentation"
        actionIcons={
          activeSegmentation && [
            {
              name: 'settings-bars',
              onClick: () => setIsConfigOpen(isOpen => !isOpen),
            },
          ]
        }
      >
        {isConfigOpen && (
          <SegmentationConfig
            setFillAlpha={setFillAlpha}
            setFillAlphaInactive={setFillAlphaInactive}
            setOutlineWidthActive={setOutlineWidthActive}
            setOutlineOpacityActive={setOutlineOpacityActive}
            setRenderFill={setRenderFill}
            setRenderInactiveSegmentations={setRenderInactiveSegmentations}
            setRenderOutline={setRenderOutline}
            segmentationConfig={segmentationConfig}
          />
        )}
        <div className="bg-primary-dark">
          {segmentations?.length === 0 ? (
            <div className="select-none rounded-[4px]">
              {showAddSegmentation && !disableEditing && (
                <NoSegmentationRow onSegmentationAdd={onSegmentationAdd} />
              )}
            </div>
          ) : (
            <div className="mt-1 select-none">
              <SegmentationDropDownRow
                segmentations={segmentations}
                disableEditing={disableEditing}
                activeSegmentation={activeSegmentation}
                onActiveSegmentationChange={onActiveSegmentationChange}
                onSegmentationDelete={onSegmentationDelete}
                onSegmentationEdit={onSegmentationEdit}
                onSegmentationDownload={onSegmentationDownload}
                storeSegmentation={storeSegmentation}
                saveSegmentation={saveSegmentation}
                onSegmentationAdd={onSegmentationAdd}
                onToggleSegmentationVisibility={onToggleSegmentationVisibility}
              />
              {!disableEditing && showAddSegment && (
                <AddSegmentRow onClick={() => onSegmentAdd(activeSegmentationId)} />
              )}
            </div>
          )}
        </div>
        {activeSegmentation && activeSegmentation.segmentCount > 0 && (
          <div>
            <div className="group mx-0.5 mt-[8px] flex items-center">
              <Select
                id="segment-type-select"
                isClearable={false}
                onChange={option => {
                  onSegmentTypeEdit(
                    activeSegmentation.id,
                    activeSegmentation.activeSegmentIndex,
                    option.value
                  );
                }}
                components={{
                  DropdownIndicator: () => (
                    <Icon
                      name={'chevron-down-new'}
                      className="mr-2"
                    />
                  ),
                }}
                isSearchable={false}
                options={segmentTypes}
                value={segmentTypes?.find(
                  o =>
                    o.value ===
                    activeSegmentation.segments[activeSegmentation.activeSegmentIndex]?.typeNodle
                )}
                className="text-aqua-pale h-[26px] w-1/2 text-[13px]"
              />
            </div>
            <div className="group mx-0.5 mt-[8px] flex items-center">
              <Select
                id="segment-localization-select"
                isClearable={false}
                onChange={option => {
                  onSegmentLocalizationEdit(
                    activeSegmentation.id,
                    activeSegmentation.activeSegmentIndex,
                    option.value
                  );
                }}
                components={{
                  DropdownIndicator: () => (
                    <Icon
                      name={'chevron-down-new'}
                      className="mr-2"
                    />
                  ),
                }}
                isSearchable={false}
                options={localizations}
                value={localizations?.find(
                  o =>
                    o.value ===
                    activeSegmentation.segments[activeSegmentation.activeSegmentIndex]?.localization
                )}
                className="text-aqua-pale h-[26px] w-1/2 text-[13px]"
              />
            </div>
            <div className="group mx-0.5 mt-[8px] flex items-center">
              <CheckBox
                checked={false}
                label={'qwert'}
              >
                Auto diameter
              </CheckBox>
            </div>

            <div className="group mx-0.5 mt-[8px] flex items-center">
              <Button
                onClick={() => {
                  onSegmentCapacityCalc(
                    activeSegmentation.id,
                    activeSegmentation.activeSegmentIndex
                  );
                }}
              >
                Volume
              </Button>
            </div>
          </div>
        )}
        {activeSegmentation && activeSegmentation.segmentCount > 0 && showROIVolume && (
          <Label
            className="text-[15px] text-white"
            text={ROIVolume}
          ></Label>
        )}
        {activeSegmentation && (
          <div className="ohif-scrollbar mt-1.5 flex min-h-0 flex-col overflow-y-hidden">
            {activeSegmentation?.segments?.map(segment => {
              if (!segment) {
                return null;
              }

              const { segmentIndex, color, label, isVisible, isLocked } = segment;
              return (
                <div
                  className="mb-[1px]"
                  key={segmentIndex}
                >
                  <SegmentationGroupSegment
                    segmentationId={activeSegmentationId}
                    segmentIndex={segmentIndex}
                    label={label}
                    color={color}
                    isActive={activeSegmentation.activeSegmentIndex === segmentIndex}
                    disableEditing={disableEditing}
                    isLocked={isLocked}
                    isVisible={isVisible}
                    onClick={onSegmentClick}
                    onEdit={onSegmentEdit}
                    onDelete={onSegmentDelete}
                    showDelete={showDeleteSegment}
                    onColor={onSegmentColorClick}
                    onToggleVisibility={onToggleSegmentVisibility}
                    onToggleLocked={onToggleSegmentLock}
                  />
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </div>
  );
};

SegmentationGroupTable.propTypes = {
  segmentations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      isActive: PropTypes.bool.isRequired,
      segments: PropTypes.arrayOf(
        PropTypes.shape({
          segmentIndex: PropTypes.number.isRequired,
          color: PropTypes.array.isRequired,
          label: PropTypes.string.isRequired,
          isVisible: PropTypes.bool.isRequired,
          isLocked: PropTypes.bool.isRequired,
        })
      ),
    })
  ),
  segmentationConfig: PropTypes.object.isRequired,
  disableEditing: PropTypes.bool,
  showAddSegmentation: PropTypes.bool,
  showAddSegment: PropTypes.bool,
  showROIVolume: PropTypes.bool,
  ROIVolume: PropTypes.string,
  showDeleteSegment: PropTypes.bool,
  onSegmentationAdd: PropTypes.func.isRequired,
  onSegmentationEdit: PropTypes.func.isRequired,
  onSegmentationClick: PropTypes.func.isRequired,
  onSegmentationDelete: PropTypes.func.isRequired,
  onSegmentationDownload: PropTypes.func.isRequired,
  storeSegmentation: PropTypes.func.isRequired,
  saveSegmentation: PropTypes.func.isRequired,
  onSegmentClick: PropTypes.func.isRequired,
  onSegmentAdd: PropTypes.func.isRequired,
  onSegmentDelete: PropTypes.func.isRequired,
  onSegmentEdit: PropTypes.func.isRequired,
  onSegmentTypeEdit: PropTypes.func.isRequired,
  onSegmentLocalizationEdit: PropTypes.func.isRequired,
  onSegmentCapacityCalc: PropTypes.func.isRequired,
  onToggleSegmentationVisibility: PropTypes.func.isRequired,
  onToggleSegmentVisibility: PropTypes.func.isRequired,
  onToggleSegmentLock: PropTypes.func.isRequired,
  onSegmentColorClick: PropTypes.func.isRequired,
  setFillAlpha: PropTypes.func.isRequired,
  setFillAlphaInactive: PropTypes.func.isRequired,
  setOutlineWidthActive: PropTypes.func.isRequired,
  setOutlineOpacityActive: PropTypes.func.isRequired,
  setRenderFill: PropTypes.func.isRequired,
  setRenderInactiveSegmentations: PropTypes.func.isRequired,
  setRenderOutline: PropTypes.func.isRequired,
};

SegmentationGroupTable.defaultProps = {
  segmentations: [],
  disableEditing: false,
  showAddSegmentation: true,
  showROIVolume: false,
  ROIVolume: '',
  showAddSegment: true,
  showDeleteSegment: true,
  onSegmentationAdd: () => {},
  onSegmentationEdit: () => {},
  onSegmentationClick: () => {},
  onSegmentationDelete: () => {},
  onSegmentationDownload: () => {},
  storeSegmentation: () => {},
  saveSegmentation: () => {},
  onSegmentClick: () => {},
  onSegmentAdd: () => {},
  onSegmentDelete: () => {},
  onSegmentEdit: () => {},
  onSegmentTypeEdit: () => {},
  onSegmentLocalizationEdit: () => {},
  onSegmentCapacityCalc: () => {},
  onToggleSegmentationVisibility: () => {},
  onToggleSegmentVisibility: () => {},
  onToggleSegmentLock: () => {},
  onSegmentColorClick: () => {},
  setFillAlpha: () => {},
  setFillAlphaInactive: () => {},
  setOutlineWidthActive: () => {},
  setOutlineOpacityActive: () => {},
  setRenderFill: () => {},
  setRenderInactiveSegmentations: () => {},
  setRenderOutline: () => {},
};
export default SegmentationGroupTable;
