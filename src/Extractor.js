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
  constructor (spider, config) {
    super()
    this.config = Object.assign({
      location: './',
      clean: false,
      pretty: false,
      transformer: transformer()
    }, config)
    this.spider = spider
    this.spider.observe('resource-loaded', this.saveResource.bind(this))
  }

  /**
   * Remove the final location directory.
   * @return Extractor
   */
  async wipe () {
    await (new Promise(resolve => rimraf(this.config.location, err => {
      if (err) throw err
      resolve()
    })))
  }

  /**
   * Save a given resource to the file system.
   * @param {object} event
   */
  async saveResource ({ resource }) {
    await resource.relationshipCrawlers()
    const shouldTransform = this.config.clean && typeof this.config.transformer === 'function'
    const transformedData = shouldTransform ? this.config.transformer(resource) : false
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
    const resourceDir = this.config.location + '/_resources' + path.dirname(resource.path())
    const resourceFile = resourceDir + '/' + path.basename(resource.path()) + '.json'
    fs.mkdir(resourceDir, { recursive: true }, (err) => {
      if (err) throw err
      fs.writeFile(resourceFile, JSON.stringify(resource.transformedData(), null, this.config.pretty ? 2 : null), () => {
        this.emit('resource-saved', { path: path.basename(resourceFile), resource })
      })
    })
  }

  /**
   * Save a particular node at it's slug accessible location.
   * @param {Resource} resource
   */
  storeNode (resource, slugPath) {
    const aliasDir = this.config.location + '/_slugs' + path.dirname(slugPath)
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
