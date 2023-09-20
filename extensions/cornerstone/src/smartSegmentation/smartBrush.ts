import { BaseTool } from '@cornerstonejs/tools';
import { Types, StackViewport, getEnabledElement, cache } from '@cornerstonejs/core';
import { activeSegmentation } from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation';
import { EventTypes } from '@cornerstonejs/tools/dist/esm/types';
import {
  segmentLocking,
  state as segmentationState,
} from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation';
import { LabelmapSegmentationData } from '@cornerstonejs/tools/dist/esm/types/LabelmapTypes';
import { Events } from '@cornerstonejs/tools/dist/esm/enums';
import { triggerAnnotationRenderForViewportIds } from '@cornerstonejs/tools/dist/esm/utilities';
import { PublicToolProps, ToolProps } from '@cornerstonejs/tools/dist/esm/types';
import {
  segmentIndex as segmentIndexController,
  config as segmentationConfig,
} from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation';

import { execSmartBrush } from './execSmartBrush';

export class SmartBrsuh extends BaseTool {
  static toolName: string = 'SmartBrush';

  private _editData: {
    segmentation: Types.IImageVolume;
    imageVolume: Types.IImageVolume; //
    segmentsLocked: number[]; //
  } | null;

  private _hoverData?: {
    segmentationId: string;
    segmentIndex: number;
    segmentationRepresentationUID: string;
    segmentColor: [number, number, number, number];
    viewportIdsToRender: string[];
    centerCanvas?: Array<number>;
  };

  constructor(
    toolProps: PublicToolProps = {},
    defaultToolProps: ToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        strategies: {
          SMART_BRUSH: execSmartBrush,
        },
        defaultStrategy: 'SMART_BRUSH',
        activeStrategy: 'SMART_BRUSH',
        radius: 5,
        sensitivity: 0.5,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
  }

  preMouseDownCallback = (evt: EventTypes.MouseDownActivateEventType): boolean => {
    const eventData = evt.detail;
    const { element } = eventData;

    const enabledElement = getEnabledElement(element);
    const { viewport, renderingEngine } = enabledElement;

    if (viewport instanceof StackViewport) {
      throw new Error('Not implemented yet');
    }

    const toolGroupId = this.toolGroupId;

    const activeSegmentationRepresentation =
      activeSegmentation.getActiveSegmentationRepresentation(toolGroupId);
    if (!activeSegmentationRepresentation) {
      throw new Error('No active segmentation detected, create one before using the brush tool');
    }

    const { segmentationId, type } = activeSegmentationRepresentation;
    const segmentsLocked = segmentLocking.getLockedSegments(segmentationId);

    const { representationData } = segmentationState.getSegmentation(segmentationId);

    const { volumeId } = representationData[type] as LabelmapSegmentationData;
    const segmentation = cache.getVolume(volumeId);

    const actors = viewport.getActors();

    const firstVolumeActorUID = actors[0].uid;
    const imageVolume = cache.getVolume(firstVolumeActorUID);

    const viewportIdsToRender = [viewport.id];

    this._editData = {
      segmentation,
      imageVolume,
      segmentsLocked,
    };

    this._activateDraw(element);

    evt.preventDefault();

    triggerAnnotationRenderForViewportIds(renderingEngine, viewportIdsToRender);

    console.log('pre click');

    return true;
  };

  private updateCursor(evt: EventTypes.InteractionEventType) {
    const eventData = evt.detail;
    const { element } = eventData;
    const { currentPoints } = eventData;
    const enabledElement = getEnabledElement(element);
    const { renderingEngine, viewport } = enabledElement;
    const { canvasToWorld } = viewport;
    const centerCanvas = canvasToWorld(currentPoints.canvas);

    const toolGroupId = this.toolGroupId;

    const activeSegmentationRepresentation =
      activeSegmentation.getActiveSegmentationRepresentation(toolGroupId);
    if (!activeSegmentationRepresentation) {
      console.warn('No active segmentation detected, create one before using the brush tool');
      return;
    }

    const { segmentationRepresentationUID, segmentationId } = activeSegmentationRepresentation;
    const segmentIndex = segmentIndexController.getActiveSegmentIndex(segmentationId);

    const segmentColor = segmentationConfig.color.getColorForSegmentIndex(
      toolGroupId,
      segmentationRepresentationUID,
      segmentIndex
    );

    const viewportIdsToRender = [viewport.id];

    this._hoverData = {
      centerCanvas,
      segmentIndex,
      segmentationId,
      segmentationRepresentationUID,
      segmentColor,
      viewportIdsToRender,
    };

    triggerAnnotationRenderForViewportIds(renderingEngine, viewportIdsToRender);
  }

  private _clickCallback = (evt: EventTypes.MouseClickEventType): void => {
    const eventData = evt.detail;
    const { element } = eventData;
    const enabledElement = getEnabledElement(element);
    const { renderingEngine } = enabledElement;

    const { imageVolume, segmentation, segmentsLocked } = this._editData;

    this._deactivateDraw(element);

    this.updateCursor(evt);

    const {
      segmentIndex,
      segmentationId,
      segmentationRepresentationUID,
      viewportIdsToRender,
      centerCanvas,
    } = this._hoverData;

    triggerAnnotationRenderForViewportIds(renderingEngine, viewportIdsToRender);

    const { radius, sensitivity } = this.configuration;

    const operationData = {
      centerCanvas: centerCanvas,
      volume: segmentation, // todo: just pass the segmentationId instead
      imageVolume,
      segmentIndex,
      segmentsLocked,
      toolGroupId: this.toolGroupId,
      segmentationId,
      segmentationRepresentationUID,
      radius,
      sensitivity,
    };

    this.applyActiveStrategy(enabledElement, operationData);
  };

  private _activateDraw = (element: HTMLDivElement): void => {
    element.addEventListener(Events.MOUSE_CLICK, this._clickCallback as EventListener);
  };

  private _deactivateDraw = (element: HTMLDivElement): void => {
    element.removeEventListener(Events.MOUSE_CLICK, this._clickCallback as EventListener);
  };
}
