const Resource = require('./Resource')
const BaseEmitter = require('./BaseEmitter')
const axios = require('axios')

class Spider extends BaseEmitter {
  /**
   * Instantiate our crawler.
   * @param {axios} api
   */
  constructor (config = {}) {
    super()
    if (!config.baseURL) {
      throw new Error('Spider requires a baseURL configuration option')
    }
    this.api = config.api || axios.create({
      baseURL: config.baseURL,
      timeout: 3000,
      headers: {
        'Accept': 'application/vnd.api+json'
      }
    })
    this.registry = {}
    this.errors = {}
    this.pending = new Set()
    this.resourceConfig = Object.assign({
      relationships: [
        new RegExp(/^field_/)
      ]
    }, config.resourceConfig)
    this.observe('crawl-error', 'crawl-depth-complete', this.isComplete.bind(this))
  }

  /**
   * Fetch a particular path to the api.
   * @param {string}  path
   * @param {boolean} relationships
   */
  async crawl (path, depth = Infinity) {
    if (!this.hasBeenTraversed(path)) {
      try {
        const req = this.api.get(path)
        this.pending.add(path)
        this.emit('crawl-started', { path, req })
        const resource = new Resource((await req).data, this.resourceConfig)
        this.emit('crawl-resource-complete', { path, res: resource.raw })
        this.register(resource, path, depth).downloadRelationships(path, depth)
        this.pending.delete(path)
        this.emit('crawl-depth-complete', { path, res: resource.raw, depth })
      } catch (err) {
        this.pending.delete(path)
        this.errors[path] = err
        this.emit('crawl-error', { path, err })
      }
    }
  }

  /**
   * Register a given resource
   * @param {Resource} resource
   * @param {string}
   * @return {Spider}
   */
  register (resource, path = false, depth = 1) {
    const p = path || resource.path()
    if (!this.registry[p]) {
      this.registry[p] = resource
      if (!resource.isCollection()) {
        this.emit('resource-loaded', { path: p, resource })
      } else {
        resource.resources().map(r => this.register(r))
        if (resource.hasNextPage()) {
          this.crawl(resource.nextPageUrl(), depth)
        }
      }
    }
    return this
  }

  /**
   * Given a particular path, parse any relevant relationships.
   * @param {string} path
   */
  downloadRelationships (path, depth) {
    if (this.registry[path] && depth > 1) {
      this.relationshipUrls(this.registry[path]).map(path => this.crawl(path, depth - 1))
    }
  }

  /**
   * Given an object of data, search it for any relationships, recursively.
   * @param {Resource} data
   */
  relationshipUrls (resource, depth) {
    if (resource.isCollection()) {
      return resource.resources().map(r => this.relationshipUrls(r, depth)).flat(2)
    }
    return resource.relationshipUrls()
  }

  /**
   * When the pending set is empty the crawling is complete.
   */
  isComplete () {
    if (this.pending.size === 0) {
      setTimeout(() => this.emit('crawl-complete', {}), 5)
    }
  }

  /**
   * Checks if a given string has been traversed yet.
   * @param {string} path
   */
  hasBeenTraversed (path) {
    return this.pending.has(path) || this.hasOwnProperty(path) || this.errors.hasOwnProperty(path)
  }
}

module.exports = Spider
