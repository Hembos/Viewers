// Checking that two adjacent sides form a left turn
function isClockwise(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);

  return val >= 0;
}

// Creating a convex hull from vertices that are sorted by polar angle
export function buildConvexHull(numVertices, vertices) {
  const convexHull = [];

  convexHull.push(vertices[0]);
  convexHull.push(vertices[1]);

  for (let i = 2; i < numVertices; i++) {
    let curPoint = convexHull.at(convexHull.length - 1);
    let prevPoint = convexHull.at(convexHull.length - 2);

    // Removing a vertex from the stack until two adjacent sides form a left turn
    while (!isClockwise(prevPoint, curPoint, vertices[i])) {
      convexHull.pop();
      curPoint = convexHull.at(convexHull.length - 1);
      prevPoint = convexHull.at(convexHull.length - 2);
    }

    convexHull.push(vertices[i]);
  }

  return convexHull;
}
