import { distanceBetweenPoints } from './roads'

const SNAP_DISTANCE_METERS = 18

function pointKey(point) {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`
}

function midpoint(a, b) {
  return [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
}

function findNearbyNode(nodes, point, maxDistance) {
  let best = null
  let bestDistance = Infinity

  for (const node of nodes) {
    const distance = distanceBetweenPoints(
      node.point,
      point
    )

    if (
      distance <= maxDistance &&
      distance < bestDistance
    ) {
      best = node
      bestDistance = distance
    }
  }

  return best
}

function addNode(nodes, point) {
  const existing = findNearbyNode(
    nodes,
    point,
    SNAP_DISTANCE_METERS
  )

  if (existing) {
    return existing
  }

  const node = {
    id: `node-${nodes.length}`,
    point: [...point],
  }

  nodes.push(node)

  return node
}

function addEdge(graph, from, to, distance) {
  if (!graph.has(from.id)) {
    graph.set(from.id, [])
  }

  graph.get(from.id).push({
    nodeId: to.id,
    distance,
  })
}

/*
 * Build a walking graph from CampusMapper roads.
 *
 * Each road is already stored as:
 *
 * [
 *   [lat, lng],
 *   [lat, lng],
 *   ...
 * ]
 *
 * Consecutive GPS points become connected graph nodes.
 *
 * Nearby points from different roads are merged so
 * intersections can become usable connections.
 */
export function buildRoadGraph(roads) {
  const nodes = []
  const graph = new Map()

  for (const road of roads) {
    if (
      !Array.isArray(road.geometry) ||
      road.geometry.length < 2
    ) {
      continue
    }

    let previousNode = null

    for (const rawPoint of road.geometry) {
      if (
        !Array.isArray(rawPoint) ||
        rawPoint.length < 2
      ) {
        continue
      }

      const point = [
        Number(rawPoint[0]),
        Number(rawPoint[1]),
      ]

      if (
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1])
      ) {
        continue
      }

      const node = addNode(nodes, point)

      if (previousNode) {
        const distance =
          distanceBetweenPoints(
            previousNode.point,
            node.point
          )

        if (distance > 0) {
          addEdge(
            graph,
            previousNode,
            node,
            distance
          )

          addEdge(
            graph,
            node,
            previousNode,
            distance
          )
        }
      }

      previousNode = node
    }
  }

  /*
   * Connect nearby nodes from different road
   * segments. This helps create intersections
   * when two recorded roads don't have an
   * identical GPS point.
   */
  for (let i = 0; i < nodes.length; i++) {
    for (
      let j = i + 1;
      j < nodes.length;
      j++
    ) {
      const a = nodes[i]
      const b = nodes[j]

      const distance =
        distanceBetweenPoints(
          a.point,
          b.point
        )

      if (
        distance <= SNAP_DISTANCE_METERS &&
        distance > 0
      ) {
        addEdge(
          graph,
          a,
          b,
          distance
        )

        addEdge(
          graph,
          b,
          a,
          distance
        )
      }
    }
  }

  return {
    nodes,
    graph,
  }
}

/*
 * Find the closest point in the road network
 * to a user's GPS position.
 */
export function findNearestRoadNode(
  nodes,
  point
) {
  if (
    !Array.isArray(point) ||
    point.length < 2
  ) {
    return null
  }

  let nearest = null
  let nearestDistance = Infinity

  for (const node of nodes) {
    const distance =
      distanceBetweenPoints(
        node.point,
        point
      )

    if (distance < nearestDistance) {
      nearest = node
      nearestDistance = distance
    }
  }

  if (!nearest) {
    return null
  }

  return {
    node: nearest,
    distance: nearestDistance,
  }
}