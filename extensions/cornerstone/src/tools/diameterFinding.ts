// Calculates the square of the length of a diameter
function measureDiameter(d) {
  return (
    (d.second.x - d.first.x) * (d.second.x - d.first.x) +
    (d.second.y - d.first.y) * (d.second.y - d.first.y)
  );
}

// Calculating the signed area modulus of a triangle
function area(a, b, c) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

// Find max diameter for convex hull
export function findDiameter(numVertices, convexHull) {
  let k = 1;

  // Finding the opposite point for the first point
  while (
    area(convexHull[numVertices - 1], convexHull[0], convexHull[(k + 1) % numVertices]) >
    area(convexHull[numVertices - 1], convexHull[0], convexHull[k])
  ) {
    k++;
  }

  let res = 0;
  let resDiam = { first: convexHull[0], second: convexHull[k] };

  for (let i = 0, j = k; i <= k; i++) {
    // Finding the opposite point for the current point and check that current diameter is max
    while (
      area(convexHull[i], convexHull[(i + 1) % numVertices], convexHull[(j + 1) % numVertices]) >
      area(convexHull[i], convexHull[(i + 1) % numVertices], convexHull[j])
    ) {
      const tmpDiam = { first: convexHull[i], second: convexHull[(j + 1) % numVertices] };
      const tmpD = measureDiameter(tmpDiam);
      res = Math.max(res, tmpD);

      if (res === tmpD) {
        resDiam = tmpDiam;
      }

      j = (j + 1) % numVertices;
    }

    const tmpDiam = { first: convexHull[i], second: convexHull[j] };
    const tmpD = measureDiameter(tmpDiam);
    res = Math.max(res, tmpD);

    if (res === tmpD) {
      resDiam = tmpDiam;
    }
  }

  return resDiam;
}

// Find point in list and return it's index
function findPointIndex(point, vertices, numVertices) {
  let ind = undefined;
  for (let i = 0; i < numVertices; i++) {
    if (point.x === vertices[i].x && point.y === vertices[i].y) {
      ind = i;
      break;
    }
  }

  return ind;
}

// Calculate line equation in parameteristic form
function getLineEquation(p1, p2) {
  return { x: { a: p1.x, b: p2.x - p1.x }, y: { a: p1.y, b: p2.y - p1.y } };
}

// Calculate intersextion point for two parameteristic equations
function getIntersectionPoint(eq1, eq2) {
  const t =
    (eq2.x.b * (eq1.y.a - eq2.y.a) + eq2.y.b * (eq2.x.a - eq1.x.a)) /
    (eq1.x.b * eq2.y.b - eq1.y.b * eq2.x.b);

  return { x: eq1.x.a + eq1.x.b * t, y: eq1.y.a + eq1.y.b * t };
}

// Calculate square segment length
export function getSegmentLength(p1, p2) {
  return (p2.x - p1.x) * (p2.x - p1.x) + (p2.y - p1.y) * (p2.y - p1.y);
}

// Calculate perpendicular line equation in parametristic form
function getPerpendicularLine(eq, point) {
  return {
    x: { a: point.x, b: -eq.y.b },
    y: { a: point.y, b: eq.x.b },
  };
}

// Find perpendicular diameter for a given diameter
export function findOrthogonalDiameter(numVertices, convexHull, diameter, delta = 0.5) {
  const bottomDiameterInd = findPointIndex(diameter.first, convexHull, numVertices);
  const upDiameterInd = findPointIndex(diameter.second, convexHull, numVertices);

  const diameterEquation = getLineEquation(diameter.second, diameter.first);

  const leftSegmentEquations = [];
  const rightSegmentEquations = [];

  const diameterBreakdownLeft = [];
  const diameterBreakdownRight = [];

  // Dividing a given diameter into segments according to the intersection of the left vertices with the diameter
  let ind = upDiameterInd;
  while (ind !== bottomDiameterInd) {
    const nextInd = (ind + 1) % numVertices;

    const eq = getLineEquation(convexHull[ind], convexHull[nextInd]);

    leftSegmentEquations.push(eq);

    const perpendicularEq = getPerpendicularLine(diameterEquation, convexHull[nextInd]);

    diameterBreakdownLeft.push(getIntersectionPoint(diameterEquation, perpendicularEq));

    ind = nextInd;
  }

  // Dividing a given diameter into segments according to the intersection of the right vertices with the diameter
  ind = bottomDiameterInd;
  while (ind !== upDiameterInd) {
    const nextInd = (ind + 1) % numVertices;

    const eq = getLineEquation(convexHull[ind], convexHull[nextInd]);

    rightSegmentEquations.push(eq);

    const perpendicularEq = getPerpendicularLine(diameterEquation, convexHull[nextInd]);

    diameterBreakdownRight.push(getIntersectionPoint(diameterEquation, perpendicularEq));

    ind = nextInd;
  }

  const diameterLength = getSegmentLength(diameter.first, diameter.second);

  // Dividing the diameter into segments of equal length
  let curSegmentBreakdownLength = 0;
  let n = 0;
  const diameterSplit = [];
  while (curSegmentBreakdownLength + delta < diameterLength) {
    n++;
    const a = diameterLength - n * delta;
    const b = n * delta;

    diameterSplit.push({
      x: (b * diameter.first.x + a * diameter.second.x) / diameterLength,
      y: (b * diameter.first.y + a * diameter.second.y) / diameterLength,
    });

    curSegmentBreakdownLength = n * delta;
  }

  // Construction of straight lines perpendicular to the diameter at the splitting points for vertices that are on the left side of the diameter
  let curLeftInd = 0;
  const leftPoints = [];
  for (const diameterPoint of diameterSplit) {
    if (
      getSegmentLength(diameter.second, diameterPoint) >
      getSegmentLength(diameter.second, diameterBreakdownLeft[curLeftInd])
    ) {
      curLeftInd++;
    }

    const perpendicularEq = getPerpendicularLine(diameterEquation, diameterPoint);

    const leftPoint = getIntersectionPoint(leftSegmentEquations[curLeftInd], perpendicularEq);

    leftPoints.push(leftPoint);
  }

  // Construction of straight lines perpendicular to the diameter at the splitting points for vertices that are on the right side of the diameter
  diameterSplit.reverse();
  let curRightInd = 0;
  const rightPoints = [];
  for (const diameterPoint of diameterSplit) {
    if (
      getSegmentLength(diameter.first, diameterPoint) >
      getSegmentLength(diameter.first, diameterBreakdownRight[curRightInd])
    ) {
      curRightInd++;
    }

    const perpendicularEq = getPerpendicularLine(diameterEquation, diameterPoint);

    const rightPoint = getIntersectionPoint(rightSegmentEquations[curRightInd], perpendicularEq);

    rightPoints.push(rightPoint);
  }

  // Finding the maximum perpendicular diameter
  let maxLength = 0;
  let maxPointLeft = 0;
  let maxPointRight = 0;
  for (let i = 0; i < leftPoints.length; i++) {
    const l = getSegmentLength(leftPoints[i], rightPoints[leftPoints.length - 1 - i]);
    if (l > maxLength) {
      maxPointLeft = leftPoints[i];
      maxPointRight = rightPoints[leftPoints.length - 1 - i];
      maxLength = l;
    }
  }

  return { first: maxPointLeft, second: maxPointRight };
}
