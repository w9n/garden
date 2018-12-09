/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { startCase } from "lodash"
import React, { Component } from "react"
import * as d3 from "d3"
import dagreD3 from "dagre-d3"

import { FetchConfigResponse, FetchGraphResponse, WsMessage, NodeTask } from "../../api/types"
import Card from "../card"

import "./graph.scss"

interface Node {
  name: string
  label: string
  id: string
}

interface Edge {
  source: string
  target: string
  type: string
  since?: number
}

export interface Graph {
  nodes: Node[]
  edges: Edge[]
}

const MIN_CHART_WIDTH = 800
const MIN_CHART_HEIGHT = 400

function drawChart(graph: Graph, width) {
  // Create the input graph
  const g = new dagreD3.graphlib.Graph()
    .setGraph({})
    .setDefaultEdgeLabel(function() { return {} })

  // Here we"re setting nodeclass, which is used by our custom drawNodes function
  // below.
  for (const node of graph.nodes) {
    g.setNode(node.id, {
      label: node.label,
      class: "taskComplete",
      id: node.id,
    })
  }

  g.nodes().forEach(function(v) {
    const node = g.node(v)
    // Round the corners of the nodes
    node.rx = node.ry = 5
  })

  // Set up edges, no special attributes.
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target)
  }

  // Create the renderer
  const render = new dagreD3.render()

  // Clear previous content if any (for updating)
  d3.selectAll("svg").remove()

  // Set width and height. Height gets updated once graph is rendered
  width = Math.max(width, MIN_CHART_WIDTH)
  const height = width

  // Clear previous content if any (for updating)
  d3.selectAll("svg").remove()

  const svg = d3.select("#chart").append("svg")
    .attr("width", width)
    .attr("height", height)

  // Set up an SVG group so that we can translate the final graph.
  const svgGroup = svg.append("g")

  // Set up zoom support
  const zoom = d3.zoom().on("zoom", () => {
    svgGroup.attr("transform", d3.event.transform)
  })
  svg.call(zoom)

  // Run the renderer. This is what draws the final graph.
  // @ts-ignore
  render(svgGroup, g)

  const initialScale = 0.75 // TODO: Make a function of number or services

  // Re-set svg frame height after graph has been been drawn
  const graphHeight = g.graph().height * initialScale + 40
  svg.attr("height", Math.max(graphHeight, MIN_CHART_HEIGHT))

  // Center the graph
  const xCenterOffset = (parseInt(svg.attr("width"), 10) - g.graph().width * initialScale) / 2
  const yCenterOffset = (parseInt(svg.attr("height"), 10) - graphHeight * initialScale) / 2
  const zoomTranslate = d3.zoomIdentity.translate(xCenterOffset, yCenterOffset).scale(initialScale)
  svg.call(zoom.transform, zoomTranslate)

}

interface Props {
  config: FetchConfigResponse
  graph: FetchGraphResponse
  message?: WsMessage
}

interface State {
  nodes: Node[]
  edges: Edge[]
}

const makeId = (name: string, type: string) => `${name}.${type}`

// Key looks like:
// test.node-service.integ.2bba2300-f97c-11e8-826f-594bd8a1f5e8
// or:
// test.node-service.2bba2300-f97c-11e8-826f-594bd8a1f5e8
const getIdFromTaskKey = (key: string) => {
  const parts = key.split(".")
  const type = parts[0]
  const name = parts.length === 4 ? `${parts[1]}.${parts[2]}` : parts[1]
  return makeId(name, type)
}

const makeLabel = (name: string, type: string) => {
  const nameParts = name.split(".")
  const action = startCase(type)
  if (nameParts.length > 1) {
    return `Service: ${nameParts[0]}\nName: ${nameParts[1]}\nAction: ${action}`
  }
  return `Service: ${nameParts[0]}\nAction: ${action}`
}

class Chart extends Component<Props, State> {

  _nodes: Node[]
  _edges: Edge[]
  _chartRef: React.RefObject<any>

  constructor(props) {
    super(props)

    this._chartRef = React.createRef()
  }

  // TODO: Re-draw graph on window resize
  componentDidMount() {
    // sanitize graph
    const graph = this.makeGraph()
    this._nodes = graph.nodes
    this._edges = graph.edges
    const width = this._chartRef.current.offsetWidth
    drawChart(graph, width)
  }

  makeGraph() {
    const nodes: Node[] = this.props.graph.nodes.map(n => {
      return {
        id: makeId(n.name, n.type),
        name: n.name,
        label: makeLabel(n.name, n.type),
      }
    })
    const edges: Edge[] = this.props.graph.relationships.map(r => {
      const source = r.dependency
      const target = r.dependant
      return {
        source: makeId(source.name, source.type),
        target: makeId(target.name, target.type),
        type: source.type,
      }
    })
    return { edges, nodes }
  }

  componentDidUpdate(_prevProps: Props) {
    const message = this.props.message
    if (message.type === "event") {
      this.updateNodeClass(message)
    }
  }

  clearClasses(el: HTMLElement) {
    const classList: NodeTask[] = ["taskComplete", "taskPending", "taskError"]
    for (const className of classList) {
      el.classList.remove(className)
    }
  }

  // Update the node class instead of re-rendering the graph for perf reasons
  updateNodeClass(message: WsMessage) {
    for (const node of this._nodes) {
      if (message.payload.key && node.id === getIdFromTaskKey(message.payload.key)) {
        const nodeEl = document.getElementById(node.id)
        this.clearClasses(nodeEl)
        if (message.name === "taskPending") {
          nodeEl.classList.add("taskPending")
        } else if (message.name === "taskError") {
          nodeEl.classList.add("taskError")
        } else if (message.name === "taskComplete") {
          nodeEl.classList.add("taskComplete")
        }
      }
    }
  }

  render() {
    const { message } = this.props
    const status = !message || message.name === "taskGraphComplete"
      ? "Waiting for changes..."
      : "Processing..."
    return (
      <Card title={`Status: ${status}`}>
        <div ref={this._chartRef} id="chart">
        </div>
      </Card>
    )
  }

}

export default Chart
