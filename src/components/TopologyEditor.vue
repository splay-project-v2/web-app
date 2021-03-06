<template>
  <div class="topology-editor">

    <b-alert
      variant="danger"
      dismissible
      fade
      :show="formErrors !== null"
      @dismissed="formErrors=null"
    >
      {{formErrors}}
    </b-alert>

    <div class="topology-form">
      <app-topo-node-creator @addNode="addNode" :types="nodeTypes" :nodes="nodes" @triggerErrors="triggerErrors"/>
      <app-topo-link-creator @addLink="addLink" :specs="specs" :nodes="nodes" :edges="edges" @triggerErrors="triggerErrors"/>
      <app-topo-spec-creator @addSpec="addSpec" :specs="specs" @triggerErrors="triggerErrors"/>
    </div>

    <b-row>

      <b-col>
        <div class="topology-recap">
          <div>
            <h6>Nodes</h6>
            <b-button variant="outline-primary" size="sm" type="button" v-for="(node, index) in nodes" :key="index" @click="removeNode(node.name)" name="button">
              {{ node.name }} ×
            </b-button>
          </div>

          <div>
            <h6>Edges</h6>
            <b-button variant="outline-primary" size="sm" type="button" v-for="(edge, index) in edges" :key="index" @click="removeEdge(edge.id)" name="button">
              {{ edge.id }} | [delay({{edge.delay}}ms) - spec({{edge.spec}}) - qlen({{edge.qlen}}) - plr({{edge.plr}})] ×
            </b-button>
          </div>

          <div>
            <h6>Specs</h6>
            <b-button variant="outline-primary" size="sm" type="button" v-for="(spec, index) in specs" :key="index" @click="removeSpec(spec.name)" name="button">
              {{ spec.name }} | [plr({{spec.plr}}) kbps({{spec.kbps}}) delay({{spec.delay}}ms) qlen({{spec.qlen}})] ×
            </b-button>
          </div>

        </div>
      </b-col>

      <b-col>
        <div class="topology-diagram">
          <cytoscape :config="config"/>
        </div>
      </b-col>

    </b-row>

    <div class="xml-result">
      <b-button type="button" name="button" @click="generateXML()">Generate XML</b-button>
      <b-button type="button" name="button" @click="reflectXML()">Reflect XML</b-button>
      <b-button variant="danger" type="button" name="button" @click="resetAll()">Reset All</b-button><br>
      <div id="xmlEditor">

      </div>
    </div>

  </div>
</template>

<script>
import TopoNodeCreator from '@/components/topo_editor/TopoNodeCreator'
import TopoLinkCreator from '@/components/topo_editor/TopoLinkCreator'
import TopoSpecCreator from '@/components/topo_editor/TopoSpecCreator'
const XML_BUILDER = require('xmlbuilder')
const XML_PARSER = require('xml-js')

var ace = require('brace')
require('brace/mode/xml')
require('brace/theme/solarized_light')

export default {
  components: {
    'app-topo-node-creator': TopoNodeCreator,
    'app-topo-link-creator': TopoLinkCreator,
    'app-topo-spec-creator': TopoSpecCreator
  },
  mounted () {
    var dis = this
    var editor = ace.edit('xmlEditor')
    editor.$blockScrolling = Infinity
    editor.setTheme('ace/theme/solarized_light')
    editor.session.setMode('ace/mode/xml')
    editor.getSession().on('change', function () {
      var code = editor.getSession().getValue()
      dis.xml = code
    })
  },
  data () {
    return {
      xml: null,
      formErrors: null,
      nodes: [],
      edges: [],
      specs: [],
      nodeTypes: ['virtnode', 'gateway'],
      config: {
        elements: [],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#666',
              'label': 'data(id)'
            }
          }, {
            selector: 'edge',
            style: {
              'width': 3,
              'curve-style': 'bezier',
              'line-color': '#363377',
              'target-arrow-color': '#000000',
              'target-arrow-shape': 'triangle'
            }
          }
        ],
        zoom: 1 / 1.5,
        pan: { x: 50, y: 50 },
        // interaction options:
        minZoom: 1 / 2,
        maxZoom: 5,
        zoomingEnabled: false,
        userZoomingEnabled: false
      }
    }
  },
  methods: {
    resetAll () {
      this.$cytoscape.instance.then(cy => {
        cy.elements().remove()
      })
      this.nodes = []
      this.edges = []
      this.specs = []
      this.xml = null
      this.$emit('addTopology', this.xml)
    },
    removeNode (nodename) {
      this.$cytoscape.instance.then(cy => {
        cy.remove(`#${nodename}`)
        this.nodes = this.nodes.filter((item) => {
          return item.name !== nodename
        })
        this.edges = this.edges.filter((item) => {
          return item.source !== nodename && item.target !== nodename
        })
      })
    },
    removeEdge (edgeId) {
      this.$cytoscape.instance.then(cy => {
        cy.remove(`#${edgeId}`)
        this.edges = this.edges.filter((item) => {
          return item.id !== edgeId
        })
      })
    },
    removeSpec (specname) {
      this.specs = this.specs.filter((item) => {
        return item.name !== specname
      })
      this.edges.forEach((edge) => {
        if (edge.spec === specname) this.removeEdge(edge.id)
      })
    },
    addNode (item) {
      this.$cytoscape.instance.then(cy => {
        cy.add([ { data: { id: item.id }, position: this.randomNodePos() } ])
        this.nodes.push({ name: item.id, nodeType: item.type })
      })
    },
    addLink (item) {
      this.$cytoscape.instance.then(cy => {
        cy.add([ { data: { id: `link${item.source}${item.target}`, source: item.source, target: item.target } } ])
        this.edges.push({ id: `link${item.source}${item.target}`, source: item.source, target: item.target, delay: item.linkDelay, spec: item.linkSpec, plr: item.plr, kbps: item.kbps })
      })
    },
    addSpec (item) {
      this.specs.push({ name: item.specname, plr: item.plr, kbps: item.kbps, delay: item.delay, qlen: item.qlen })
    },
    randomNodePos () {
      return { x: (Math.floor(Math.random() * 550) + 30), y: (Math.floor(Math.random() * 350) + 30) }
    },
    triggerErrors (message) {
      this.formErrors = message
    },
    generateXML () {
      var xml = XML_BUILDER.create('topology', { version: '1.0', encoding: 'ISO-8859-1' }, { keepNullAttributes: false })
      var dict = {}
      if (this.nodes.length > 0) {
        var xmlVertices = xml.ele('vertices')
        let counter = 1
        this.nodes.forEach((node) => {
          var item = xmlVertices.ele('vertex')
          item.att('int_idx', counter)
          dict[node.name] = counter
          item.att('role', node.nodeType)
          if (node.nodeType === 'virtnode') item.att('int_vn', counter)
          counter++
        })
      }
      if (this.edges.length > 0) {
        var xmlEdges = xml.ele('edges')
        let counter = 1
        this.edges.forEach((edge) => {
          var item = xmlEdges.ele('edge')
          item.att('int_idx', counter); item.att('int_src', dict[edge.source]); item.att('int_dst', dict[edge.target]); item.att('int_delayms', edge.delay); item.att('specs', edge.spec); item.att('dbl_kbps', edge.kbps); item.att('dbl_plr', edge.plr)
          counter++
        })
      }
      if (this.specs.length > 0) {
        var xmlSpecs = xml.ele('specs')
        this.specs.forEach((spec) => {
          var item = xmlSpecs.ele(spec.name)
          item.att('dbl_plr', spec.plr); item.att('dbl_kbps', spec.kbps); item.att('int_delayms', spec.delay); item.att('int_qlen', spec.qlen)
        })
      }

      this.xml = xml.doc().end({ pretty: true, newline: '\n' })
      var editor = ace.edit('xmlEditor')
      editor.getSession().setValue(this.xml)
      this.$emit('addTopology', this.xml)
    },
    reflectXML () {
      this.$cytoscape.instance.then(cy => {
        cy.elements().remove()
      })
      this.nodes = []
      this.edges = []
      this.specs = []
      var parsed = JSON.parse(XML_PARSER.xml2json(this.xml, { compact: true, spaces: 4 }))
      if (parsed.topology.vertices) {
        this.makeArray(parsed.topology.vertices.vertex).forEach((node) => {
          this.addNode({ id: `${node._attributes.role}${node._attributes.int_idx}`, type: node._attributes.role })
        })
      }
      if (parsed.topology.specs) {
        for (var key in parsed.topology.specs) {
          let attr = parsed.topology.specs[key]._attributes
          this.addSpec({ specname: key, plr: attr.dbl_plr, kbps: attr.dbl_kbps, delay: attr.int_delayms, qlen: attr.int_qlen })
        }
        this.makeArray(parsed.topology.edges.edge).forEach((edge) => {
          var src = parsed.topology.vertices.vertex[parseInt(edge._attributes.int_src) - 1]
          var trg = parsed.topology.vertices.vertex[parseInt(edge._attributes.int_dst) - 1]
          this.addLink({
            source: `${src._attributes.role}${src._attributes.int_idx}`,
            target: `${trg._attributes.role}${trg._attributes.int_idx}`,
            linkSpec: edge._attributes.specs,
            linkDelay: edge._attributes.int_delayms,
            kbps: edge._attributes.dbl_kbps,
            plr: edge._attributes.dbl_plr
          })
        })
      }
    },
    makeArray (item) {
      return Array.isArray(item) ? item : [item]
    }
  }
}
</script>

<style lang="css" scoped>
  .topology-diagram {
    width: 600px;
    height: 400px;
    border: solid grey 1px;
    border-radius: 3px;
  }
  #xmlEditor {
    height: 400px;
  }
</style>
