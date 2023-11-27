import { activeSegmentation } from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation';
import { state as segmentationState } from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation';
import { cache } from '@cornerstonejs/core';
import { LabelmapSegmentationData } from '@cornerstonejs/tools/dist/esm/types/LabelmapTypes';
import { getVerticesPolygon } from './getVertivesPolygon';
import { buildConvexHull } from './buildConvexHull';
import { findDiameter, findOrthogonalDiameter, getSegmentLength } from './diameterFinding';
import { scroll } from '@cornerstonejs/tools/dist/esm/utilities';

// Initialize memory for getBboxFromLabelMap wasm function
const memoryChanVese = new WebAssembly.Memory({
  initial: 256,
  maximum: 256,
});

// Instantiate wasm code
async function fetchAndInstantiate(memory: WebAssembly.Memory, wasmFile: string) {
  const response = await fetch(wasmFile);
  const buffer = await response.arrayBuffer();
  const output = await WebAssembly.instantiate(buffer, {
    js: { mem: memory },
  });

  return output.instance.exports;
}

const chanVeseExports = fetchAndInstantiate(memoryChanVese, 'chanVese.wasm');

let getBboxFromLabelMap;
chanVeseExports.then(value => {
  getBboxFromLabelMap = value.getBboxFromLabelMap;
});

// Convert canvas point to page point
function canvasPointsToPagePoints(DomCanvasElement, canvasPoint) {
  const rect = DomCanvasElement.getBoundingClientRect();
  return [canvasPoint[0] + rect.left + window.scrollX, canvasPoint[1] + rect.top + window.scrollY];
}

// Draw diameter on current viewport
function drawDiameter(diameter, imageData, bbox, imageIndex, segmentation, viewport) {
  // Calculate points to draw for diameter
  const world1 = imageData.indexToWorld([
    diameter.first.x + bbox[0],
    diameter.first.y + bbox[1],
    imageIndex,
  ]);
  if (diameter.first.x > diameter.second.x) {
    world1[0] += segmentation.spacing[0] / 2;
  } else {
    world1[0] -= segmentation.spacing[0] / 2;
  }
  if (diameter.first.y > diameter.second.y) {
    world1[1] += segmentation.spacing[1] / 2;
  } else {
    world1[1] -= segmentation.spacing[1] / 2;
  }
  const canvasPoint1 = viewport.worldToCanvas(world1);
  const [pageX1, pageY1] = canvasPointsToPagePoints(viewport.canvas, canvasPoint1);

  const world2 = imageData.indexToWorld([
    diameter.second.x + bbox[0],
    diameter.second.y + bbox[1],
    imageIndex,
  ]);
  if (diameter.second.x > diameter.first.x) {
    world2[0] += segmentation.spacing[0] / 2;
  } else {
    world2[0] -= segmentation.spacing[0] / 2;
  }
  if (diameter.second.y > diameter.first.y) {
    world2[1] += segmentation.spacing[1] / 2;
  } else {
    world2[1] -= segmentation.spacing[1] / 2;
  }
  const canvasPoint2 = viewport.worldToCanvas(world2);
  const [pageX2, pageY2] = canvasPointsToPagePoints(viewport.canvas, canvasPoint2);

  // Set length tool active
  window.services.toolbarService.recordInteraction({
    interactionType: 'tool',
    commands: [
      {
        commandName: 'setToolActive',
        commandOptions: {
          toolName: 'Length',
        },
      },
    ],
  });
  // Simulating clicking and moving the mouse across the screen
  const firstPointEvt = new MouseEvent('mousedown', {
    buttons: 1,
    clientX: pageX1,
    clientY: pageY1,
  });
  viewport.element.dispatchEvent(firstPointEvt);
  const moveEvt = new MouseEvent('mousemove', {
    buttons: 1,
    clientX: pageX2,
    clientY: pageY2,
  });
  document.dispatchEvent(moveEvt);
  const secondPointEvt = new MouseEvent('mouseup');
  document.dispatchEvent(secondPointEvt);
  window.services.toolbarService.recordInteraction({
    interactionType: 'tool',
    commands: [
      {
        commandName: 'setToolActive',
        commandOptions: {
          toolName: 'Zoom',
        },
      },
    ],
  });
}

// Calculate max diameter and perpendicular max diameter
function calcDiameters(imageIndex, frameLength, labelMap, dimensions, segmentIndex) {
  const lableMapChanVese = new Int32Array(memoryChanVese.buffer, 0, frameLength);
  const bbox = new Int32Array(memoryChanVese.buffer, frameLength * 4, 4);
  for (let i = 0; i < dimensions[0]; i++) {
    for (let j = 0; j < dimensions[1]; j++) {
      const pixelIndex = frameLength * imageIndex + i * dimensions[0] + j;
      lableMapChanVese[i * dimensions[0] + j] = labelMap[pixelIndex];
    }
  }
  getBboxFromLabelMap(frameLength * 4, segmentIndex, dimensions[1], dimensions[0], 0);
  const width = bbox[2] - bbox[0] + 1;
  const height = bbox[3] - bbox[1] + 1;

  if (width < 2 || height < 2) {
    return undefined;
  }

  const mask = new Int32Array(width * height);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (lableMapChanVese[(i + bbox[1]) * dimensions[0] + (j + bbox[0])] === segmentIndex) {
        mask[i * width + j] = 1;
      } else {
        mask[i * width + j] = 0;
      }
    }
  }

  const vertices = getVerticesPolygon(mask, width, height);

  const convexHull = buildConvexHull(vertices.length, vertices);

  const diameter = findDiameter(convexHull.length, convexHull);
  const orthogonalDiameter = findOrthogonalDiameter(convexHull.length, convexHull, diameter, 0.1);

  return { diameter: diameter, orthogonalDiameter: orthogonalDiameter, bbox: bbox.map(x => x) };
}

export function calcAndDrawDiameter(segmentIndex) {
  const toolGroupId = 'default';

  const activeSegmentationRepresentation =
    activeSegmentation.getActiveSegmentationRepresentation(toolGroupId);
  if (!activeSegmentationRepresentation) {
    throw new Error('No active segmentation detected, create one before using the brush tool');
  }

  const { segmentationId, type } = activeSegmentationRepresentation;

  const { representationData } = segmentationState.getSegmentation(segmentationId);

  const { volumeId } = representationData[type] as LabelmapSegmentationData;
  const segmentation = cache.getVolume(volumeId);

  const { dimensions } = segmentation;
  const labelMap = segmentation.getScalarData();

  const viewportId = window.services.viewportGridService.getActiveViewportId();

  const viewport = window.services.cornerstoneViewportService.getCornerstoneViewport(viewportId);

  const frameLength = dimensions[0] * dimensions[1];

  let diameters = undefined;
  let imageIndex;
  if (!window.services.segmentationService.autoDiameter) {
    imageIndex = viewport.getCurrentImageIdIndex();
    diameters = calcDiameters(imageIndex, frameLength, labelMap, dimensions, segmentIndex);
  } else {
    let maxLength = 0;
    for (let i = 0; i < dimensions[2]; i++) {
      const tmpDiameters = calcDiameters(i, frameLength, labelMap, dimensions, segmentIndex);
      if (tmpDiameters === undefined) {
        continue;
      }
      const tmpLength = getSegmentLength(tmpDiameters.diameter.first, tmpDiameters.diameter.second);
      if (tmpLength > maxLength) {
        diameters = tmpDiameters;
        maxLength = tmpLength;
        imageIndex = i;
      }
    }
  }

  if (diameters === undefined) {
    return;
  }

  const actors = viewport.getActors();

  const firstVolumeActorUID = actors[0].uid;
  const imageVolume = cache.getVolume(firstVolumeActorUID);
  const imageData = imageVolume.imageData;

  scroll(viewport, { delta: viewport.getCurrentImageIdIndex() - imageIndex });
  drawDiameter(diameters.diameter, imageData, diameters.bbox, imageIndex, segmentation, viewport);
  drawDiameter(
    diameters.orthogonalDiameter,
    imageData,
    diameters.bbox,
    imageIndex,
    segmentation,
    viewport
  );

  const measurements = window.services.measurementService.getMeasurements();
  console.log(measurements);
  measurements[measurements.length - 2]['label'] =
    window.services.segmentationService.getSegmentation(segmentationId).segments[segmentIndex]
      .label + ' max';
  measurements[measurements.length - 1]['label'] =
    window.services.segmentationService.getSegmentation(segmentationId).segments[segmentIndex]
      .label + ' orthogonal';

  window.services.measurementService.update(
    measurements[measurements.length - 2]['uid'],
    measurements[measurements.length - 2],
    true
  );
  window.services.measurementService.update(
    measurements[measurements.length - 1]['uid'],
    measurements[measurements.length - 1],
    true
  );
}
