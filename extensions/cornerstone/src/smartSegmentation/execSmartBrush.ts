import { Types } from '@cornerstonejs/core';
import { utilities as csUtils } from '@cornerstonejs/core';
import { triggerSegmentationDataModified } from '@cornerstonejs/tools/dist/esm/stateManagement/segmentation/triggerSegmentationEvents';

const { transformWorldToIndex } = csUtils;

type OperationData = {
  segmentationId: string;
  imageVolume: Types.IImageVolume;
  centerCanvas: Array<number>;
  volume: Types.IImageVolume;
  segmentIndex: number;
  segmentsLocked: number[];
  radius: number;
  sensitivity: number;
  constraintFn: () => boolean;
};

// Initialize memory for smartBrush wasm
const memorySmartBrush = new WebAssembly.Memory({
  initial: 256,
  maximum: 256,
});

// Initialize memory for chanVese wasm
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

const smartBrushExports = fetchAndInstantiate(memorySmartBrush, 'smartBrush.wasm');

const chanVeseExports = fetchAndInstantiate(memoryChanVese, 'chanVese.wasm');

const arrSmartBrush = new Float32Array(memorySmartBrush.buffer);

let runSmartBrush;
smartBrushExports.then(value => (runSmartBrush = value.runSmartBrush));

let runChanVese, getBboxFromLabelMap;
chanVeseExports.then(value => {
  runChanVese = value.runChanVese;
  getBboxFromLabelMap = value.getBboxFromLabelMap;
});

// Launching the smart brush tool
export function execSmartBrush(
  enabledElement: Types.IEnabledElement,
  operationData: OperationData
): void {
  const {
    volume: segmentationVolume,
    imageVolume,
    points,
    segmentsLocked,
    segmentIndex,
    segmentationId,
    strategySpecificConfiguration,
    centerCanvas,
    radius,
    sensitivity,
  } = operationData;
  const { imageData, dimensions } = segmentationVolume;
  const scalarData = segmentationVolume.getScalarData();
  const { viewport } = enabledElement;
  const { voiRange } = viewport.getProperties();

  // Get pixel indices from world coordinate
  const clickPoint = transformWorldToIndex(imageData, centerCanvas as Types.Point3) as Types.Point3;

  const size = radius * 2 + 1;
  const area = size * size;

  for (let i = 0; i < area; i++) {
    arrSmartBrush[i] = 0;
  }

  const imageScalarData = imageVolume.getScalarData();
  // Obtaining pixel intensities with their correction
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const pixelIndex =
        clickPoint[0] +
        j -
        radius +
        (clickPoint[1] + i - radius) * dimensions[0] +
        clickPoint[2] * dimensions[0] * dimensions[1];

      let intensity = imageScalarData[pixelIndex];

      if (intensity > voiRange.upper) {
        intensity = voiRange.upper;
      } else if (intensity < voiRange.lower) {
        intensity = voiRange.lower;
      }

      arrSmartBrush[area + i * size + j] =
        (intensity - voiRange.lower) / (voiRange.upper - voiRange.lower);
    }
  }

  // Find mask for click point
  runSmartBrush(
    radius,
    sensitivity,
    area * 4,
    0,
    area * 2 * 4,
    area * 3 * 4,
    area * 4 * 4,
    area * 5 * 4
  );

  // Labelmap creation for finded mask
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const pixelIndex =
        dimensions[0] * dimensions[1] * clickPoint[2] +
        (clickPoint[1] - radius + i) * dimensions[0] +
        (clickPoint[0] - radius + j);

      if (arrSmartBrush[i * size + j] === 1) {
        scalarData[pixelIndex] = segmentIndex;
      }
    }
  }

  const frameLength = dimensions[0] * dimensions[1];
  const lableMapChanVese = new Int32Array(memoryChanVese.buffer, 0, frameLength);
  const bbox = new Int32Array(memoryChanVese.buffer, frameLength * 4, 4);
  for (let i = 0; i < dimensions[0]; i++) {
    for (let j = 0; j < dimensions[1]; j++) {
      const pixelIndex = frameLength * clickPoint[2] + i * dimensions[0] + j;
      lableMapChanVese[i * dimensions[0] + j] = scalarData[pixelIndex];
    }
  }
  getBboxFromLabelMap(frameLength * 4, segmentIndex, dimensions[1], dimensions[0], 0);
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];

  const intensities = new Float32Array(memoryChanVese.buffer, frameLength * 4 + 16, width * height);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const pixelIndex = bbox[0] + j + (bbox[1] + i) * dimensions[0] + clickPoint[2] * frameLength;
      let intensity = imageScalarData[pixelIndex];

      if (intensity > voiRange.upper) {
        intensity = voiRange.upper;
      } else if (intensity < voiRange.lower) {
        intensity = voiRange.lower;
      }

      intensities[i * width + j] = (intensity - voiRange.lower) / (voiRange.upper - voiRange.lower);
    }
  }

  const mask = new Int32Array(
    memoryChanVese.buffer,
    (frameLength + 4 + width * height) * 4,
    width * height
  );
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (lableMapChanVese[(i + bbox[1]) * dimensions[0] + (j + bbox[0])] === segmentIndex) {
        mask[i * width + j] = 1;
      }
    }
  }

  // Mask correction with chanVese algorithm
  const buffer = new Float32Array(
    memoryChanVese.buffer,
    (frameLength + 4 + 2 * width * height) * 4
  );
  runChanVese(
    (frameLength + 4) * 4,
    width,
    height,
    (frameLength + 4 + width * height) * 4,
    1000,
    0.2,
    0.5,
    0.5,
    (frameLength + 4 + 2 * width * height) * 4
  );

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const pixelIndex =
        dimensions[0] * dimensions[1] * clickPoint[2] +
        (bbox[1] + i) * dimensions[0] +
        (bbox[0] + j);

      if (mask[i * width + j] === 1) {
        scalarData[pixelIndex] = segmentIndex;
      }
    }
  }

  // Update mask rendering
  const modifiedSlicesToUse = new Set() as Set<number>;

  modifiedSlicesToUse.add(clickPoint[2]);

  const arrayOfSlices: number[] = Array.from(modifiedSlicesToUse);

  chanVeseExports.then(value => console.log(value));

  triggerSegmentationDataModified(segmentationId, arrayOfSlices);
}

// Propogate mask to other slices
export function propogate_segment(options) {
  const { imageIndex, segmentIndex, segmentation, segmentationId, viewport, radius, imageVolume } =
    options;

  const { imageData, dimensions } = segmentation;
  const scalarData = segmentation.getScalarData();
  const { voiRange } = viewport.getProperties();
  const imageScalarData = imageVolume.getScalarData();

  const frameLength = dimensions[0] * dimensions[1];
  const lableMapChanVese = new Int32Array(memoryChanVese.buffer, 0, frameLength);
  const bbox = new Int32Array(memoryChanVese.buffer, frameLength * 4, 4);

  const modifiedSlicesToUse = new Set() as Set<number>;

  for (let next = 1; next < radius; next++) {
    const curImage = imageIndex - next;
    const prevImage = curImage + 1;

    for (let i = 0; i < dimensions[0]; i++) {
      for (let j = 0; j < dimensions[1]; j++) {
        const pixelIndex = frameLength * prevImage + i * dimensions[0] + j;
        lableMapChanVese[i * dimensions[0] + j] = scalarData[pixelIndex];
      }
    }

    getBboxFromLabelMap(frameLength * 4, segmentIndex, dimensions[1], dimensions[0], 0);

    const width = bbox[2] - bbox[0] + 1;
    const height = bbox[3] - bbox[1] + 1;

    const intensities = new Float32Array(
      memoryChanVese.buffer,
      frameLength * 4 + 16,
      width * height
    );
    const mask = new Int32Array(
      memoryChanVese.buffer,
      (frameLength + 4 + width * height) * 4,
      width * height
    );
    const buffer = new Float32Array(
      memoryChanVese.buffer,
      (frameLength + 4 + 2 * width * height) * 4
    );

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const pixelIndex = bbox[0] + j + (bbox[1] + i) * dimensions[0] + curImage * frameLength;
        let intensity = imageScalarData[pixelIndex];

        if (intensity > voiRange.upper) {
          intensity = voiRange.upper;
        } else if (intensity < voiRange.lower) {
          intensity = voiRange.lower;
        }

        intensities[i * width + j] =
          (intensity - voiRange.lower) / (voiRange.upper - voiRange.lower);
      }
    }

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (lableMapChanVese[(i + bbox[1]) * dimensions[0] + (j + bbox[0])] === segmentIndex) {
          mask[i * width + j] = 1;
        }
      }
    }

    runChanVese(
      (frameLength + 4) * 4,
      width,
      height,
      (frameLength + 4 + width * height) * 4,
      1000,
      0.2,
      0.5,
      0.5,
      (frameLength + 4 + 2 * width * height) * 4
    );

    let s = 0;
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const pixelIndex =
          dimensions[0] * dimensions[1] * curImage + (bbox[1] + i) * dimensions[0] + (bbox[0] + j);

        if (mask[i * width + j] === 1) {
          scalarData[pixelIndex] = segmentIndex;
          s++;
        }
      }
    }

    if (s < 20) {
      break;
    }

    modifiedSlicesToUse.add(curImage);
  }

  for (let next = 1; next < radius; next++) {
    const curImage = imageIndex + next;
    const prevImage = curImage - 1;

    for (let i = 0; i < dimensions[0]; i++) {
      for (let j = 0; j < dimensions[1]; j++) {
        const pixelIndex = frameLength * prevImage + i * dimensions[0] + j;
        lableMapChanVese[i * dimensions[0] + j] = scalarData[pixelIndex];
      }
    }

    getBboxFromLabelMap(frameLength * 4, segmentIndex, dimensions[1], dimensions[0], 0);

    const width = bbox[2] - bbox[0] + 1;
    const height = bbox[3] - bbox[1] + 1;

    console.log(curImage, bbox);

    const intensities = new Float32Array(
      memoryChanVese.buffer,
      frameLength * 4 + 16,
      width * height
    );
    const mask = new Int32Array(
      memoryChanVese.buffer,
      (frameLength + 4 + width * height) * 4,
      width * height
    );
    const buffer = new Float32Array(
      memoryChanVese.buffer,
      (frameLength + 4 + 2 * width * height) * 4
    );

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const pixelIndex = bbox[0] + j + (bbox[1] + i) * dimensions[0] + curImage * frameLength;
        let intensity = imageScalarData[pixelIndex];

        if (intensity > voiRange.upper) {
          intensity = voiRange.upper;
        } else if (intensity < voiRange.lower) {
          intensity = voiRange.lower;
        }

        intensities[i * width + j] =
          (intensity - voiRange.lower) / (voiRange.upper - voiRange.lower);
      }
    }

    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (lableMapChanVese[(i + bbox[1]) * dimensions[0] + (j + bbox[0])] === segmentIndex) {
          mask[i * width + j] = 1;
        }
      }
    }

    runChanVese(
      (frameLength + 4) * 4,
      width,
      height,
      (frameLength + 4 + width * height) * 4,
      1000,
      0.2,
      0.5,
      0.5,
      (frameLength + 4 + 2 * width * height) * 4
    );

    let s = 0;
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        const pixelIndex =
          dimensions[0] * dimensions[1] * curImage + (bbox[1] + i) * dimensions[0] + (bbox[0] + j);

        if (mask[i * width + j] === 1) {
          scalarData[pixelIndex] = segmentIndex;
          s++;
        }
      }
    }

    if (s < 20) {
      break;
    }

    modifiedSlicesToUse.add(curImage);
  }

  const arrayOfSlices: number[] = Array.from(modifiedSlicesToUse);
  triggerSegmentationDataModified(segmentationId, arrayOfSlices);
}
