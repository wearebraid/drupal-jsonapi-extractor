const fs = require('fs')
const rimraf = require('rimraf')
const path = require('path')
const BaseEmitter = require('./BaseEmitter')
const transformer = require('./Transformer')

class Extractor extends BaseEmitter {
  /**
   * Initialize the extractor which is responsible for actually storing
   * files in the local filesystem.
   * @param {string} location
   */
  constructor (emitter, config) {
    super()
    this.config = Object.assign({
      location: './',
      wipe: false,
      clean: false,
      transformer: transformer()
    }, config)
    this.emitter = emitter
    this.emitter.observe('resource-loaded', this.saveResource.bind(this))
  }

  /**
   * Save a given resource to the file system.
   * @param {object} event
   */
  async saveResource ({ resource }) {
    if (!this.hasHandledEvent) {
      this.hasHandledEvent = true
      if (this.config.wipe) {
        await (new Promise(resolve => rimraf(this.config.location, () => resolve())))
      }
    }
    const transformedData = this.config.clean && typeof this.config.transformer === 'function' ? this.config.transformer(resource) : false
    resource.setTransformedData(transformedData)
    if (resource.entity() === 'node') {
      resource.slugPaths().map(path => this.storeNode(resource, path))
    }
    this.storeResource(resource)
  }

  /**
   * Store a resource by its unique guid.
   * @param {Resource} resource
   */
  storeResource (resource) {
    const resourceDir = this.config.location + '/_resources/' + path.dirname(resource.path())
    const resourceFile = resourceDir + '/' + path.basename(resource.path()) + '.json'
    fs.mkdir(resourceDir, { recursive: true }, (err) => {
      if (err) throw err
      fs.writeFile(resourceFile, JSON.stringify(resource.transformedData(), null, 2), () => {
        this.emit('resource-saved', { path: path.basename(resourceFile), resource })
      })
    })
  }

  /**
   * Save a particular node at it's slug accessible location.
   * @param {Resource} resource
   */
  storeNode (resource, slugPath) {
    const aliasDir = this.config.location + '/_slugs/' + path.dirname(slugPath)
    const aliasFile = aliasDir + '/' + path.basename(slugPath) + '.json'

    fs.mkdir(aliasDir, { recursive: true }, (err) => {
      if (err) throw err
      fs.writeFile(aliasFile, JSON.stringify(resource.transformedData(), null, 2), () => {
        this.emit('resource-slug-saved', { path: path.basename(aliasFile), resource })
      })
    })
  }
}

module.exports = Extractor
