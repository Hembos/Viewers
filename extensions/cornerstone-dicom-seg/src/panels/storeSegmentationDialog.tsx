/* eslint-disable react/display-name */
import React from 'react';
import { ButtonEnums, Dialog, Input, Select } from '@ohif/ui';

export const CREATE_SEGMENTATION_DIALOG_RESPONSE = {
  CANCEL: 0,
  CREATE: 1,
};

export default function storeSegmentationDialog(uiDialogService, { extensionManager }) {
  return new Promise(function (resolve, reject) {
    let dialogId = undefined;

    const _handleClose = () => {
      // Dismiss dialog
      uiDialogService.dismiss({ id: dialogId });
      // Notify of cancel action
      resolve({
        action: CREATE_SEGMENTATION_DIALOG_RESPONSE.CANCEL,
        value: undefined,
      });
    };

    /**
     *
     * @param {string} param0.action - value of action performed
     * @param {string} param0.value - value from input field
     */
    const _handleFormSubmit = ({ action, value }) => {
      uiDialogService.dismiss({ id: dialogId });
      switch (action.id) {
        case 'save':
          resolve({
            action: CREATE_SEGMENTATION_DIALOG_RESPONSE.CREATE,
            value: value.label,
          });
          break;
        case 'cancel':
          resolve({
            action: CREATE_SEGMENTATION_DIALOG_RESPONSE.CANCEL,
            value: undefined,
          });
          break;
      }
    };

    const segNames = [
      { value: 'Left Lung', label: 'Left Lung', placeHolder: 'Left Lung' },
      { value: 'Mediastinum', label: 'Mediastinum', placeHolder: 'Mediastinum' },
      { value: 'Right lung', label: 'Right lung', placeHolder: 'Right lung' },
    ];

    dialogId = uiDialogService.create({
      centralize: true,
      isDraggable: false,
      content: Dialog,
      useLastPosition: false,
      showOverlay: true,
      contentProps: {
        title: 'Create Segmentation',
        value: {
          value: 'Left Lung',
          label: 'Left Lung',
          placeHolder: 'Left Lung',
        },
        noCloseButton: true,
        onClose: _handleClose,
        actions: [
          { id: 'cancel', text: 'Cancel', type: ButtonEnums.type.secondary },
          { id: 'save', text: 'Save', type: ButtonEnums.type.primary },
        ],
        // TODO: Should be on button press...
        onSubmit: _handleFormSubmit,
        body: ({ value, setValue }) => {
          const onChangeHandler = event => {
            event.persist();
            setValue(value => ({ ...value, label: event.target.value }));
          };
          const onKeyPressHandler = event => {
            if (event.key === 'Enter') {
              uiDialogService.dismiss({ id: dialogId });
              resolve({
                action: CREATE_SEGMENTATION_DIALOG_RESPONSE.CREATE,
                value: value.label,
              });
            }
          };
          return (
            <>
              <Select
                closeMenuOnSelect={true}
                className="border-primary-main mr-2 bg-black"
                options={segNames}
                value={value.value}
                placeholder={segNames.find(option => option.value === value.value).placeHolder}
                onChange={evt => {
                  console.log(evt, value);
                  setValue(v => evt);
                }}
                isClearable={false}
              />
            </>
          );
        },
      },
    });
  });
}
