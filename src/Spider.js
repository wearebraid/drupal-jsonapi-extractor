const Resource = require('./Resource')
const BaseEmitter = require('./BaseEmitter')
const Queue = require('./Queue')
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
      timeout: 5000,
      headers: {
        'Accept': 'application/vnd.api+json'
      }
    })
    this.registry = {}
    this.errors = {}
    this.pendingPaths = new Set()
    this.config = Object.assign({ maxConcurrent: 5 }, config)
    this.queue = new Queue(this.config.maxConcurrent)
    this.resourceConfig = Object.assign({
      relationships: [
        new RegExp(/^field_/)
      ]
    }, config.resourceConfig)
    this.observe('crawl-error', 'crawl-depth-complete', this.isComplete.bind(this))
  }

  /**
   * Crawl and download all available nodes.
   */
  async crawlNodes (depth = Infinity) {
    let res = await this.api.get('/node_type/node_type')
    if (res.data && res.data.data) {
      res.data.data.map(ct => ct.attributes.drupal_internal__type).map(t => this.crawl(`/node/${t}`, depth))
    } else {
      this.emit('crawl-error', { message: 'No content types found.' })
    }
  }

  /**
   * Fetch a particular path to the api.
   * @param {string}  path
   * @param {boolean} relationships
   * @return {Resource}
   */
  async crawl (path, depth = Infinity) {
    if (!this.hasBeenTraversed(path)) {
      try {
        const req = this.queueApiRequests(path)
        this.emit('crawl-started', { path, req })
        const resource = new Resource((await req).data, this, this.resourceConfig)
        this.emit('crawl-resource-complete', { path, res: resource.raw })
        this.register(resource, path, depth)
        this.emit('crawl-depth-complete', { path, resource, depth })
        return resource
      } catch (err) {
        return this.handleError(err)
      }
    }
  }

  async handleError (err, path) {
    this.errors[path] = err
    this.pendingPaths.delete(path)
    this.emit('crawl-error', { path, err })
    if (this.config.terminateOnError) {
      console.log(err)
      process.exit(1)
    }
    return false
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
      this.pendingPaths.delete(path)
      if (!resource.isCollection()) {
        resource.setRelationshipCrawlers(this.crawlRelationships(path, depth))
        this.emit('resource-loaded', { path: p, resource })
      } else {
        resource.resources().map(r => this.register(r, r.path(), depth))
        if (resource.hasNextPage()) {
          this.crawl(resource.nextPageUrl(), depth)
        }
      }
    }
    this.pendingPaths.delete(path)
    return this
  }

  /**
   * Queue an api requests and promise it's resolution.
   * @param {string} path
   * @return {Spider}
   */
  queueApiRequests (path) {
    this.pendingPaths.add(path)
    return new Promise((resolve, reject) => {
      this.queue.add(async () => {
        try {
          const res = await this.api.get(path)
          resolve(res)
        } catch (err) {
          this.handleError(err, path)
        }
      })
    })
  }

  /**
   * Given a particular path, parse any relevant relationships.
   * @param {string} path
   * @param {integer} depth
   * @return {Promise}
   */
  crawlRelationships (path, depth) {
    if (this.registry[path] && depth > 1) {
      const resource = this.registry[path]
      return Promise.all(
        this.relationshipUrls(resource)
          .map(path => this.crawl(path, depth - 1))
          .filter(p => !!p)
      )
    }
    return Promise.resolve()
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
    if (this.pendingPaths.size < 1) {
      setTimeout(() => this.emit('crawl-complete', {}), 100)
    }
  }

  /**
   * Checks if a given string has been traversed yet.
   * @param {string} path
   */
  hasBeenTraversed (path) {
    return this.pendingPaths.has(path) || this.registry.hasOwnProperty(path) || this.errors.hasOwnProperty(path)
  }
}

module.exports = Spider
