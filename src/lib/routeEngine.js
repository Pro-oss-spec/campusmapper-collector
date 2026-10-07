import {
  buildRoadGraph,
  findNearestRoadNode,
} from './routeGraph'

import { distanceBetweenPoints } from './roads'

const WALKING_SPEED_MPS = 1.35

function reconstructPath(
  previous,
  startId,
  destinationId,
  nodeMap
) {
  const path = []
  let current = destinationId

  while (current) {
    const node = nodeMap.get(current)

    if (!node) {
      return []
    }

    path.unshift(node.point)

    if (current === startId) {
      break
    }

    current = previous.get(current)
  }

  if (
    path.length === 0 ||
    path[0] !== nodeMap.get(startId)?.point
  ) {
    return []
  }

  return path
}

function findShortestPath(
  graph,
  nodes,
  startNode,
  destinationNode
) {
  const distances = new Map()
  const previous = new Map()
  const visited = new Set()

  const nodeMap = new Map(
    nodes.map((node) => [
      node.id,
      node,
    ])
  )

  for (const node of nodes) {
    distances.set(
      node.id,
      Infinity
    )
  }

  distances.set(
    startNode.id,
    0
  )

  while (visited.size < nodes.length) {
    let currentId = null
    let currentDistance = Infinity

    for (const [
      nodeId,
      distance,
    ] of distances) {
      if (
        !visited.has(nodeId) &&
        distance < currentDistance
      ) {
        currentId = nodeId
        currentDistance = distance
      }
    }

    if (!currentId) {
      break
    }

    if (
      currentId ===
      destinationNode.id
    ) {
      break
    }

    visited.add(currentId)

    const neighbours =
      graph.get(currentId) || []

    for (const edge of neighbours) {
      if (visited.has(edge.nodeId)) {
        continue
      }

      const newDistance =
        currentDistance +
        edge.distance

      if (
        newDistance <
        distances.get(edge.nodeId)
      ) {
        distances.set(
          edge.nodeId,
          newDistance
        )

        previous.set(
          edge.nodeId,
          currentId
        )
      }
    }
  }

  const path = reconstructPath(
    previous,
    startNode.id,
    destinationNode.id,
    nodeMap
  )

  return {
    path,
    distance:
      distances.get(
        destinationNode.id
      ) ?? Infinity,
  }
}

/*
 * Calculate a walking route using the
 * CampusMapper road network.
 */
export function calculateWalkingRoute({
  roads,
  start,
  destination,
}) {
  if (!Array.isArray(roads) || roads.length === 0) {
    throw new Error(
      'No mapped roads are available for this campus yet.'
    )
  }

  if (
    !Array.isArray(start) ||
    start.length < 2
  ) {
    throw new Error(
      'Current GPS location is unavailable.'
    )
  }

  if (
    !Array.isArray(destination) ||
    destination.length < 2
  ) {
    throw new Error(
      'Destination coordinates are unavailable.'
    )
  }

  const {
    nodes,
    graph,
  } = buildRoadGraph(roads)

  if (nodes.length < 2) {
    throw new Error(
      'There are not enough mapped road points to calculate a route.'
    )
  }

  const startSnap =
    findNearestRoadNode(
      nodes,
      start
    )

  const destinationSnap =
    findNearestRoadNode(
      nodes,
      destination
    )

  if (
    !startSnap ||
    !destinationSnap
  ) {
    throw new Error(
      'Could not connect the location to the mapped road network.'
    )
  }

  const result =
    findShortestPath(
      graph,
      nodes,
      startSnap.node,
      destinationSnap.node
    )

  if (
    !result.path.length ||
    !Number.isFinite(result.distance)
  ) {
    throw new Error(
      'No walking route could be found between these locations.'
    )
  }

  /*
   * Add the actual GPS point at the beginning
   * and destination at the end.
   *
   * This makes the displayed route reach the
   * user and destination instead of stopping
   * at the nearest road node.
   */
  const fullPath = [
    start,
    ...result.path,
    destination,
  ]

  let totalDistance = 0

  for (
    let i = 1;
    i < fullPath.length;
    i++
  ) {
    totalDistance +=
      distanceBetweenPoints(
        fullPath[i - 1],
        fullPath[i]
      )
  }

  const walkingTimeSeconds =
    totalDistance /
    WALKING_SPEED_MPS

  return {
    path: fullPath,
    distanceMeters:
      Math.round(totalDistance),
    walkingTimeSeconds:
      Math.round(walkingTimeSeconds),
    walkingTimeMinutes:
      Math.max(
        1,
        Math.ceil(
          walkingTimeSeconds / 60
        )
      ),
    startSnapDistance:
      Math.round(
        startSnap.distance
      ),
    destinationSnapDistance:
      Math.round(
        destinationSnap.distance
      ),
  }
}