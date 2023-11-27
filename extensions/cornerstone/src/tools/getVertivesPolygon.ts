// Finding the bottom point. If there are several of these, then the left one
function findBottomPoint(mask, width, height) {
  const bottomPoint = { x: 0, y: 0 };

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j;

      if (mask[index] === 1 && (i > bottomPoint.y || (i === bottomPoint.y && j < bottomPoint.x))) {
        bottomPoint.x = j;
        bottomPoint.y = i;
      }
    }
  }

  return bottomPoint;
}

// Checking that a point lies inside the bounding box
function checkPoint(point, width, height) {
  return point.x < 0 || point.x > width || point.y < 0 || point.y > height;
}

// Checking that a vertex is not a degenerate vertex
function checkVertex(mask, vertex, width, height) {
  let isDegenerate = false;

  const dirPoints = [
    { left: { x: -1, y: -1 }, right: { x: 1, y: 1 } },
    { left: { x: 0, y: -1 }, right: { x: 0, y: 1 } },
    { left: { x: 1, y: -1 }, right: { x: -1, y: 1 } },
    { left: { x: -1, y: 0 }, right: { x: 1, y: 0 } },
  ];

  for (let i = 0; i < 4; i++) {
    const leftPoint = { x: vertex.x + dirPoints[i].left.x, y: vertex.y + dirPoints[i].left.y };
    const rightPoint = { x: vertex.x + dirPoints[i].right.x, y: vertex.y + dirPoints[i].right.y };

    if (checkPoint(leftPoint, width, height) || checkPoint(rightPoint, width, height)) {
      continue;
    }

    const leftIndex = leftPoint.y * width + leftPoint.x;

    const rightIndex = rightPoint.y * width + rightPoint.x;

    if (mask[leftIndex] === 1 && mask[rightIndex] === 1) {
      isDegenerate = true;
      break;
    }
  }

  return isDegenerate;
}

// Calculate polar angle
function calcPolarAngle(vertex, bottomPoint) {
  if (vertex.x === bottomPoint.x && vertex.y === bottomPoint.y) {
    return 0;
  }

  let polar = (Math.atan((bottomPoint.y - vertex.y) / (vertex.x - bottomPoint.x)) * 180) / Math.PI;
  if (polar < 0) {
    polar = 180 + polar;
  }
  return polar;
}

// Get non degenrate vertices from mask
export function getVerticesPolygon(mask, width, height) {
  const bottomPoint = findBottomPoint(mask, width, height);

  const vertices = [];
  const polarAngles = [];

  let numVertices = 0;

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const index = i * width + j;

      if (mask[index] !== 1) {
        continue;
      }

      const vertex = { x: j, y: i };

      if (!checkVertex(mask, vertex, width, height)) {
        const polarAngle = calcPolarAngle(vertex, bottomPoint);

        let k;
        for (k = numVertices - 1; k >= 0 && polarAngles[k] > polarAngle; k--) {
          vertices[k + 1] = vertices[k];
          polarAngles[k + 1] = polarAngles[k];
        }

        vertices[k + 1] = vertex;
        polarAngles[k + 1] = polarAngle;

        numVertices++;
      }
    }
  }

  return vertices;
}
