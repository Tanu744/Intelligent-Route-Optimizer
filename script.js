// Global variables
let canvas, ctx
let nodes = []
let edges = []
let mode = "addNode"
let nodeCounter = 0
let selectedNode = null
let isAnimating = false
let animationSpeed = 5
const currentPaths = []
const mstEdges = []
let manualWeightMode = false
let selectedEdgeForEdit = null
let weightPopup = null

// Node and edge classes
class Node {
  constructor(x, y, id) {
    this.x = x
    this.y = y
    this.id = id
    this.label = String.fromCharCode(65 + id)
    this.radius = 25
    this.color = "#3498db"
    this.textColor = "white"
    this.isStart = false
    this.isEnd = false
    this.visited = false
    this.distance = Number.POSITIVE_INFINITY
    this.previous = null
  }

  draw() {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
    ctx.fillStyle = this.color
    ctx.fill()
    ctx.strokeStyle = "#2c3e50"
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = this.textColor
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(this.label, this.x, this.y)
  }

  contains(x, y) {
    const dx = x - this.x
    const dy = y - this.y
    return dx * dx + dy * dy <= this.radius * this.radius
  }

  reset() {
    this.visited = false
    this.distance = Number.POSITIVE_INFINITY
    this.previous = null
    this.color = this.isStart ? "#27ae60" : this.isEnd ? "#e74c3c" : "#3498db"
  }
}

class Edge {
  constructor(from, to, weight = null) {
    this.from = from
    this.to = to
    this.weight = weight || this.calculateWeight()
    this.color = "#7f8c8d"
    this.width = 2
    this.isHighlighted = false
    this.isMST = false
  }

  calculateWeight() {
    const dx = this.to.x - this.from.x
    const dy = this.to.y - this.from.y
    return Math.round(Math.sqrt(dx * dx + dy * dy))
  }

  draw() {
    ctx.beginPath()
    ctx.moveTo(this.from.x, this.from.y)
    ctx.lineTo(this.to.x, this.to.y)
    ctx.strokeStyle = this.isHighlighted ? "#e74c3c" : this.isMST ? "#f39c12" : this.color
    ctx.lineWidth = this.isHighlighted || this.isMST ? 4 : this.width
    ctx.stroke()

    // Draw weight
    const midX = (this.from.x + this.to.x) / 2
    const midY = (this.from.y + this.to.y) / 2

    ctx.fillStyle = "white"
    ctx.fillRect(midX - 15, midY - 10, 30, 20)
    ctx.strokeStyle = "#2c3e50"
    ctx.lineWidth = 1
    ctx.strokeRect(midX - 15, midY - 10, 30, 20)

    ctx.fillStyle = "#2c3e50"
    ctx.font = "12px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(this.weight, midX, midY)
  }
}

// Initialize canvas
function initCanvas() {
  canvas = document.getElementById("canvas")
  ctx = canvas.getContext("2d")

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    draw()
  }

  resizeCanvas()
  window.addEventListener("resize", resizeCanvas)

  canvas.addEventListener("click", handleCanvasClick)
  canvas.addEventListener("mousedown", handleMouseDown)
  canvas.addEventListener("mousemove", handleMouseMove)
  canvas.addEventListener("mouseup", handleMouseUp)

  updateStatus("Ready - Click to add nodes")
}

// Event handlers
function handleCanvasClick(e) {
  if (isAnimating) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const clickedNode = findNodeAt(x, y)
  const clickedEdge = findEdgeAt(x, y)

  switch (mode) {
    case "addNode":
      if (!clickedNode) {
        addNode(x, y)
      }
      break
    case "deleteNode":
      if (clickedNode) {
        deleteNode(clickedNode)
      } else if (clickedEdge) {
        deleteEdge(clickedEdge)
      }
      break
    case "addEdge":
      // Allow editing edge weights by clicking on them
      if (clickedEdge && manualWeightMode) {
        showWeightEditPopup(clickedEdge, x, y)
      }
      break
  }
}

let isDragging = false
let dragNode = null
let dragStart = null

function handleMouseDown(e) {
  if (isAnimating) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const clickedNode = findNodeAt(x, y)

  if (mode === "addEdge" && clickedNode) {
    selectedNode = clickedNode
    dragStart = { x, y }
  } else if (mode === "moveNode" && clickedNode) {
    isDragging = true
    dragNode = clickedNode
  }
}

function handleMouseMove(e) {
  if (isAnimating) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (mode === "addEdge" && selectedNode && dragStart) {
    draw()
    ctx.beginPath()
    ctx.moveTo(selectedNode.x, selectedNode.y)
    ctx.lineTo(x, y)
    ctx.strokeStyle = "#3498db"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()
    ctx.setLineDash([])
  } else if (isDragging && dragNode) {
    dragNode.x = x
    dragNode.y = y
    updateEdgeWeights()
    draw()
  }
}

function handleMouseUp(e) {
  if (isAnimating) return

  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (mode === "addEdge" && selectedNode) {
    const targetNode = findNodeAt(x, y)
    if (targetNode && targetNode !== selectedNode) {
      addEdge(selectedNode, targetNode)
    }
    selectedNode = null
    dragStart = null
    draw()
  }

  isDragging = false
  dragNode = null
}

// Graph manipulation functions
function addNode(x, y) {
  const node = new Node(x, y, nodeCounter++)
  nodes.push(node)
  updateNodeSelectors()
  draw()
  updateStatus(`Added node ${node.label}`)
}

function deleteNode(node) {
  // Remove edges connected to this node
  edges = edges.filter((edge) => edge.from !== node && edge.to !== node)

  // Remove the node
  nodes = nodes.filter((n) => n !== node)

  updateNodeSelectors()
  draw()
  updateStatus(`Deleted node ${node.label}`)
}

function addEdge(from, to) {
  // Check if edge already exists
  const existingEdge = edges.find(
    (edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from),
  )

  if (!existingEdge) {
    let weight
    if (manualWeightMode) {
      weight = Number.parseInt(document.getElementById("edgeWeight").value) || 10
    } else {
      weight = null // Will use calculated weight
    }

    const edge = new Edge(from, to, weight)
    edges.push(edge)
    draw()
    updateStatus(`Added edge ${from.label}-${to.label} (weight: ${edge.weight})`)
  }
}

function updateEdgeWeights() {
  edges.forEach((edge) => {
    edge.weight = edge.calculateWeight()
  })
}

function findNodeAt(x, y) {
  return nodes.find((node) => node.contains(x, y))
}

// Drawing functions
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw edges first
  edges.forEach((edge) => edge.draw())

  // Draw nodes on top
  nodes.forEach((node) => node.draw())
}

// UI functions
function setMode(newMode) {
  mode = newMode
  document.querySelectorAll(".mode-btn").forEach((btn) => btn.classList.remove("active"))
  event.target.classList.add("active")

  const modeMessages = {
    addNode: "Click to add nodes",
    addEdge: manualWeightMode
      ? "Drag between nodes to add edges, click edges to edit weights"
      : "Drag between nodes to add edges",
    moveNode: "Drag nodes to move them",
    deleteNode: "Click nodes or edges to delete them",
  }

  updateStatus(modeMessages[newMode])

  // Update cursor
  canvas.style.cursor = newMode === "addEdge" && manualWeightMode ? "pointer" : "crosshair"
}

function toggleSection(header) {
  const content = header.nextElementSibling
  const icon = header.querySelector(".collapse-icon")

  content.classList.toggle("collapsed")
  header.classList.toggle("collapsed")
}

function toggleAlgorithm(algorithm) {
  const toggle = event.currentTarget
  const checkbox = toggle.querySelector('input[type="checkbox"]')

  checkbox.checked = !checkbox.checked
  toggle.classList.toggle("active", checkbox.checked)
}

function updateNodeSelectors() {
  const startSelect = document.getElementById("startNode")
  const endSelect = document.getElementById("endNode")

  const startValue = startSelect.value
  const endValue = endSelect.value

  startSelect.innerHTML = '<option value="">Select start node</option>'
  endSelect.innerHTML = '<option value="">Select end node</option>'

  nodes.forEach((node) => {
    const startOption = new Option(node.label, node.id)
    const endOption = new Option(node.label, node.id)
    startSelect.add(startOption)
    endSelect.add(endOption)
  })

  startSelect.value = startValue
  endSelect.value = endValue

  updateNodeColors()
}

function updateNodeColors() {
  const startNodeId = document.getElementById("startNode").value
  const endNodeId = document.getElementById("endNode").value

  nodes.forEach((node) => {
    node.isStart = node.id == startNodeId
    node.isEnd = node.id == endNodeId
    node.color = node.isStart ? "#27ae60" : node.isEnd ? "#e74c3c" : "#3498db"
  })

  draw()
}

function updateStatus(message) {
  document.getElementById("statusBar").textContent = message
}

// Algorithm implementations
async function findPaths() {
  if (isAnimating) return

  const startNodeId = document.getElementById("startNode").value
  const endNodeId = document.getElementById("endNode").value

  if (!startNodeId || !endNodeId) {
    alert("Please select start and end nodes")
    return
  }

  const startNode = nodes.find((n) => n.id == startNodeId)
  const endNode = nodes.find((n) => n.id == endNodeId)

  if (!startNode || !endNode) return

  isAnimating = true
  clearPaths()
  updateNodeColors()

  const algorithms = []
  if (document.getElementById("dijkstra").checked) algorithms.push("dijkstra")
  if (document.getElementById("astar").checked) algorithms.push("astar")
  if (document.getElementById("bfs").checked) algorithms.push("bfs")
  if (document.getElementById("dfs").checked) algorithms.push("dfs")

  const results = []

  for (const algorithm of algorithms) {
    resetNodes()
    updateStatus(`Running ${algorithm.toUpperCase()}...`)

    const result = await runAlgorithm(algorithm, startNode, endNode)
    results.push(result)

    await sleep(1000)
  }

  displayResults(results)
  isAnimating = false
  updateStatus("Pathfinding complete")
}

async function runAlgorithm(algorithm, startNode, endNode) {
  const startTime = performance.now()

  switch (algorithm) {
    case "dijkstra":
      return await dijkstra(startNode, endNode, startTime)
    case "astar":
      return await aStar(startNode, endNode, startTime)
    case "bfs":
      return await bfs(startNode, endNode, startTime)
    case "dfs":
      return await dfs(startNode, endNode, startTime)
  }
}

async function dijkstra(startNode, endNode, startTime) {
  const unvisited = [...nodes]
  startNode.distance = 0

  while (unvisited.length > 0) {
    unvisited.sort((a, b) => a.distance - b.distance)
    const current = unvisited.shift()

    if (current.distance === Number.POSITIVE_INFINITY) break

    current.visited = true
    current.color = current === startNode ? "#27ae60" : current === endNode ? "#e74c3c" : "#f39c12"

    if (current === endNode) break

    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      if (!neighbor.visited) {
        const edge = edges.find(
          (e) => (e.from === current && e.to === neighbor) || (e.from === neighbor && e.to === current),
        )
        const distance = current.distance + edge.weight

        if (distance < neighbor.distance) {
          neighbor.distance = distance
          neighbor.previous = current
        }
      }
    }

    draw()
    await sleep(1000 / animationSpeed)
  }

  const path = reconstructPath(endNode)
  const endTime = performance.now()

  return {
    algorithm: "Dijkstra",
    path: path,
    distance: endNode.distance,
    time: Math.round(endTime - startTime),
    nodesVisited: nodes.filter((n) => n.visited).length,
  }
}

async function aStar(startNode, endNode, startTime) {
  const openSet = [startNode]
  const closedSet = []

  startNode.distance = 0
  startNode.fScore = heuristic(startNode, endNode)

  while (openSet.length > 0) {
    openSet.sort((a, b) => (a.fScore || Number.POSITIVE_INFINITY) - (b.fScore || Number.POSITIVE_INFINITY))
    const current = openSet.shift()

    if (current === endNode) break

    closedSet.push(current)
    current.visited = true
    current.color = current === startNode ? "#27ae60" : current === endNode ? "#e74c3c" : "#f39c12"

    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      if (closedSet.includes(neighbor)) continue

      const edge = edges.find(
        (e) => (e.from === current && e.to === neighbor) || (e.from === neighbor && e.to === current),
      )
      const tentativeDistance = current.distance + edge.weight

      if (!openSet.includes(neighbor)) {
        openSet.push(neighbor)
      } else if (tentativeDistance >= neighbor.distance) {
        continue
      }

      neighbor.previous = current
      neighbor.distance = tentativeDistance
      neighbor.fScore = neighbor.distance + heuristic(neighbor, endNode)
    }

    draw()
    await sleep(1000 / animationSpeed)
  }

  const path = reconstructPath(endNode)
  const endTime = performance.now()

  return {
    algorithm: "A*",
    path: path,
    distance: endNode.distance,
    time: Math.round(endTime - startTime),
    nodesVisited: closedSet.length,
  }
}

async function bfs(startNode, endNode, startTime) {
  const queue = [startNode]
  const visited = new Set([startNode])

  startNode.distance = 0

  while (queue.length > 0) {
    const current = queue.shift()

    current.visited = true
    current.color = current === startNode ? "#27ae60" : current === endNode ? "#e74c3c" : "#f39c12"

    if (current === endNode) break

    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        neighbor.previous = current
        neighbor.distance = current.distance + 1
        queue.push(neighbor)
      }
    }

    draw()
    await sleep(1000 / animationSpeed)
  }

  const path = reconstructPath(endNode)
  const endTime = performance.now()

  return {
    algorithm: "BFS",
    path: path,
    distance: endNode.distance,
    time: Math.round(endTime - startTime),
    nodesVisited: visited.size,
  }
}

async function dfs(startNode, endNode, startTime) {
  const stack = [startNode]
  const visited = new Set()

  while (stack.length > 0) {
    const current = stack.pop()

    if (visited.has(current)) continue

    visited.add(current)
    current.visited = true
    current.color = current === startNode ? "#27ae60" : current === endNode ? "#e74c3c" : "#f39c12"

    if (current === endNode) break

    const neighbors = getNeighbors(current)
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        neighbor.previous = current
        stack.push(neighbor)
      }
    }

    draw()
    await sleep(1000 / animationSpeed)
  }

  const path = reconstructPath(endNode)
  const endTime = performance.now()

  return {
    algorithm: "DFS",
    path: path,
    distance: path.length - 1,
    time: Math.round(endTime - startTime),
    nodesVisited: visited.size,
  }
}

async function findMST() {
  if (isAnimating || nodes.length < 2) return

  isAnimating = true
  clearPaths()
  updateStatus("Finding Minimum Spanning Tree...")

  // Kruskal's algorithm
  const sortedEdges = [...edges].sort((a, b) => a.weight - b.weight)
  const mst = []
  const parent = {}

  // Initialize disjoint set
  nodes.forEach((node) => (parent[node.id] = node.id))

  function find(x) {
    if (parent[x] !== x) {
      parent[x] = find(parent[x])
    }
    return parent[x]
  }

  function union(x, y) {
    const rootX = find(x)
    const rootY = find(y)
    if (rootX !== rootY) {
      parent[rootX] = rootY
      return true
    }
    return false
  }

  for (const edge of sortedEdges) {
    if (union(edge.from.id, edge.to.id)) {
      mst.push(edge)
      edge.isMST = true

      draw()
      await sleep(1000 / animationSpeed)

      if (mst.length === nodes.length - 1) break
    }
  }

  const totalWeight = mst.reduce((sum, edge) => sum + edge.weight, 0)

  displayResults([
    {
      algorithm: "MST (Kruskal)",
      path: mst.map((e) => `${e.from.label}-${e.to.label}`),
      distance: totalWeight,
      time: 0,
      nodesVisited: nodes.length,
    },
  ])

  isAnimating = false
  updateStatus("MST complete")
}

// Helper functions
function getNeighbors(node) {
  return edges
    .filter((edge) => edge.from === node || edge.to === node)
    .map((edge) => (edge.from === node ? edge.to : edge.from))
}

function heuristic(node1, node2) {
  const dx = node1.x - node2.x
  const dy = node1.y - node2.y
  return Math.sqrt(dx * dx + dy * dy)
}

function reconstructPath(endNode) {
  const path = []
  let current = endNode

  while (current) {
    path.unshift(current)
    current = current.previous
  }

  // Highlight path
  for (let i = 0; i < path.length - 1; i++) {
    const edge = edges.find(
      (e) => (e.from === path[i] && e.to === path[i + 1]) || (e.from === path[i + 1] && e.to === path[i]),
    )
    if (edge) edge.isHighlighted = true
  }

  return path
}

function resetNodes() {
  nodes.forEach((node) => node.reset())
  edges.forEach((edge) => {
    edge.isHighlighted = false
    edge.isMST = false
  })
}

function clearPaths() {
  resetNodes()
  updateNodeColors()
  draw()
}

function displayResults(results) {
  const resultsDiv = document.getElementById("results")
  resultsDiv.innerHTML = ""

  results.forEach((result) => {
    const item = document.createElement("div")
    item.className = "result-item"
    item.innerHTML = `
            <strong>${result.algorithm}</strong><br>
            Distance: ${result.distance === Number.POSITIVE_INFINITY ? "No path" : result.distance}<br>
            Time: ${result.time}ms<br>
            Nodes visited: ${result.nodesVisited}
        `
    resultsDiv.appendChild(item)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stopAnimation() {
  isAnimating = false
  updateStatus("Animation stopped")
}

// Data management functions
function exportGraph() {
  const data = {
    nodes: nodes.map((node) => ({
      x: node.x,
      y: node.y,
      id: node.id,
      label: node.label,
    })),
    edges: edges.map((edge) => ({
      from: edge.from.id,
      to: edge.to.id,
      weight: edge.weight,
    })),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "graph.json"
  a.click()
  URL.revokeObjectURL(url)
}

function importGraph() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json"
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          loadGraphData(data)
        } catch (error) {
          alert("Invalid file format")
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

function loadGraphData(data) {
  clearCanvas()

  // Load nodes
  data.nodes.forEach((nodeData) => {
    const node = new Node(nodeData.x, nodeData.y, nodeData.id)
    node.label = nodeData.label
    nodes.push(node)
  })

  // Load edges
  data.edges.forEach((edgeData) => {
    const fromNode = nodes.find((n) => n.id === edgeData.from)
    const toNode = nodes.find((n) => n.id === edgeData.to)
    if (fromNode && toNode) {
      const edge = new Edge(fromNode, toNode, edgeData.weight)
      edges.push(edge)
    }
  })

  nodeCounter = Math.max(...nodes.map((n) => n.id)) + 1
  updateNodeSelectors()
  draw()
}

function clearCanvas() {
  nodes = []
  edges = []
  nodeCounter = 0
  updateNodeSelectors()
  draw()
  updateStatus("Canvas cleared")
}

// Example graphs
function loadExample(type) {
  clearCanvas()

  switch (type) {
    case "grid":
      createGridGraph()
      break
    case "star":
      createStarGraph()
      break
    case "tree":
      createTreeGraph()
      break
    case "complete":
      createCompleteGraph()
      break
  }

  updateNodeSelectors()
  draw()
}

function createGridGraph() {
  const rows = 3
  const cols = 4
  const spacing = 80
  const startX = 100
  const startY = 100

  // Create nodes
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const x = startX + j * spacing
      const y = startY + i * spacing
      addNode(x, y)
    }
  }

  // Create edges
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const currentIndex = i * cols + j

      // Right edge
      if (j < cols - 1) {
        addEdge(nodes[currentIndex], nodes[currentIndex + 1])
      }

      // Down edge
      if (i < rows - 1) {
        addEdge(nodes[currentIndex], nodes[currentIndex + cols])
      }
    }
  }
}

function createStarGraph() {
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = 100
  const numNodes = 6

  // Center node
  addNode(centerX, centerY)
  const centerNode = nodes[0]

  // Outer nodes
  for (let i = 0; i < numNodes; i++) {
    const angle = (i * 2 * Math.PI) / numNodes
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    addNode(x, y)
    addEdge(centerNode, nodes[nodes.length - 1])
  }
}

function createTreeGraph() {
  const levels = 3
  const spacing = 80
  const startX = canvas.width / 2
  const startY = 50

  // Root
  addNode(startX, startY)

  let currentLevel = [nodes[0]]

  for (let level = 1; level < levels; level++) {
    const nextLevel = []
    const nodesInLevel = Math.pow(2, level)
    const levelWidth = (nodesInLevel - 1) * spacing
    const levelStartX = startX - levelWidth / 2

    for (let i = 0; i < nodesInLevel; i++) {
      const x = levelStartX + i * spacing
      const y = startY + level * spacing
      addNode(x, y)

      const newNode = nodes[nodes.length - 1]
      nextLevel.push(newNode)

      // Connect to parent
      const parentIndex = Math.floor(i / 2)
      if (parentIndex < currentLevel.length) {
        addEdge(currentLevel[parentIndex], newNode)
      }
    }

    currentLevel = nextLevel
  }
}

function createCompleteGraph() {
  const numNodes = 5
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = 100

  // Create nodes in a circle
  for (let i = 0; i < numNodes; i++) {
    const angle = (i * 2 * Math.PI) / numNodes
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    addNode(x, y)
  }

  // Connect all nodes to all other nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      addEdge(nodes[i], nodes[j])
    }
  }
}

function toggleManualWeight() {
  manualWeightMode = document.getElementById("manualWeight").checked
  const weightInput = document.getElementById("edgeWeight")
  weightInput.disabled = !manualWeightMode

  if (manualWeightMode) {
    updateStatus("Manual weight mode enabled - edges will use specified weight")
  } else {
    updateStatus("Auto weight mode - edges will use calculated distance")
  }

  // Update cursor for existing edges
  canvas.style.cursor = manualWeightMode && mode === "addEdge" ? "pointer" : "crosshair"
}

function findEdgeAt(x, y) {
  const tolerance = 10

  for (const edge of edges) {
    const distance = distanceToLineSegment(x, y, edge.from.x, edge.from.y, edge.to.x, edge.to.y)
    if (distance <= tolerance) {
      return edge
    }
  }
  return null
}

function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1))

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)))
  const projX = x1 + t * dx
  const projY = y1 + t * dy

  return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY))
}

function deleteEdge(edge) {
  edges = edges.filter((e) => e !== edge)
  draw()
  updateStatus(`Deleted edge ${edge.from.label}-${edge.to.label}`)
}

function showWeightEditPopup(edge, x, y) {
  // Remove existing popup if any
  hideWeightEditPopup()

  selectedEdgeForEdit = edge

  // Create popup
  weightPopup = document.createElement("div")
  weightPopup.className = "edge-weight-popup"
  weightPopup.style.left = x + "px"
  weightPopup.style.top = y + "px"

  weightPopup.innerHTML = `
    <h4>Edit Edge Weight</h4>
    <input type="number" id="popupWeightInput" value="${edge.weight}" min="1" max="999">
    <div class="popup-buttons">
      <button class="popup-save" onclick="saveEdgeWeight()">Save</button>
      <button class="popup-cancel" onclick="hideWeightEditPopup()">Cancel</button>
    </div>
  `

  canvas.parentElement.appendChild(weightPopup)
  document.getElementById("popupWeightInput").focus()
  document.getElementById("popupWeightInput").select()

  // Add enter key listener
  document.getElementById("popupWeightInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveEdgeWeight()
    } else if (e.key === "Escape") {
      hideWeightEditPopup()
    }
  })
}

function saveEdgeWeight() {
  if (selectedEdgeForEdit && weightPopup) {
    const newWeight = Number.parseInt(document.getElementById("popupWeightInput").value)
    if (newWeight && newWeight > 0) {
      selectedEdgeForEdit.weight = newWeight
      draw()
      updateStatus(
        `Updated edge ${selectedEdgeForEdit.from.label}-${selectedEdgeForEdit.to.label} weight to ${newWeight}`,
      )
    }
  }
  hideWeightEditPopup()
}

function hideWeightEditPopup() {
  if (weightPopup) {
    weightPopup.remove()
    weightPopup = null
  }
  selectedEdgeForEdit = null
}

// Event listeners
document.getElementById("startNode").addEventListener("change", updateNodeColors)
document.getElementById("endNode").addEventListener("change", updateNodeColors)
document.getElementById("animationSpeed").addEventListener("input", function () {
  animationSpeed = Number.parseInt(this.value)
})

document.addEventListener("click", (e) => {
  if (weightPopup && !weightPopup.contains(e.target) && e.target !== canvas) {
    hideWeightEditPopup()
  }
})

document.getElementById("manualWeight").addEventListener("change", toggleManualWeight)

// Initialize the application
window.addEventListener("load", () => {
  initCanvas()

  // Load a simple example
  setTimeout(() => {
    loadExample("grid")
    document.getElementById("startNode").value = "0"
    document.getElementById("endNode").value = "11"
    updateNodeColors()
  }, 100)
})
