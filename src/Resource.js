class Resource {
  /**
   * Model representing the response from a standard JSON:API
   * @param {object} res
   */
  constructor (raw, spider, config) {
    this.raw = raw
    this.data = this.getData(raw)
    this.self = this.raw.links.self.href
    this.config = config
    this.spider = spider

    // Internal "private" properties
    this._path = false
    this._entity = false
    this._id = false
    this._slugs = false
    this._transformedFields = false
    this._transformed = false
    this._transformerConfig = {}
    this._relationshipCrawlers = false
    this._relationships = this.isResource() ? (this.data.relationships || {}) : {}
    this._attributes = this.isResource() ? (this.data.attributes || {}) : {}
  }

  /**
   * Get the data from our raw input.
   * @return {object}
   */
  getData (input) {
    if (input.data && input.data.type && input.data.id) {
      return input.data
    }
    if (input.type && input.id) {
      return input
    }
    if (input.data && Array.isArray(input.data)) {
      return input.data
    }
    return {}
  }

  /**
   * Checks if the current resource is a collection or a single resource.
   * @return {boolean}
   */
  isCollection () {
    return Array.isArray(this.data)
  }

  /**
   * Determines if this resource is an actual resource (could be a collection
   * or null)
   * @return {boolean}
   */
  isResource () {
    const type = typeof this.data
    return type === 'object' && !!this.data
  }

  /**
   * Checks if this resource is empty.
   * @return {boolean}
   */
  isNull () {
    return this.data === null
  }

  /**
   * Returns the entity type. (Drupal specific)
   * @return {string|boolean}
   */
  entity () {
    if (!this._entity && !this.isCollection()) {
      this._entity = this.data.type.split('--')[0]
    }
    return this._entity
  }

  /**
   * Fetch the resource bundle type. (Drupal specific)
   * @return {string|boolean}
   */
  bundle () {
    if (!this._bundle && !this.isCollection()) {
      this._bundle = this.data.type.split('--')[1]
    }
    return this._bundle
  }

  /**
   * Get the actual ID of the given resource (Drupal specific)
   * @return {string|boolean}
   */
  id () {
    if (!this._id && !this.isCollection()) {
      const key = Object.keys(this.data.attributes).find(k => /^drupal_internal__[ntfm]?id/.test(k))
      this._id = this.data.attributes[key]
    }
    return this._id
  }

  /**
   * The URL "path" of a given resource. If it has an alias use that.
   * @return {array}
   */
  slugPaths () {
    if (!this._slugs) {
      this._slugs = []
      if (this.entity() === 'node') {
        if (this.data.attributes.path && this.data.attributes.path.alias) {
          this._slugs.push(decodeURIComponent(this.data.attributes.path.alias))
        }
        this._slugs.push(`/node/${this.id()}`)
      }
    }
    return this._slugs
  }

  /**
   * Calculate the path of the current resource.
   * @return {string}
   */
  path () {
    if (!this._path) {
      if (!this.isCollection()) {
        this._path = this.dataToUrl(this.data)
      } else {
        this._path = this.relativeUrl(this.self)
      }
    }
    return this._path
  }

  /**
   * Given a big-ol JSON:API style URL, clean it up to be relative and nice.
   * @param {string|object}
   * @return {string|boolean}
   */
  relativeUrl (href) {
    if (typeof href === 'string') {
      const url = new URL(href)
      return '/' + url.pathname.replace(/^\/jsonapi\//, '') + (url.search ? `${decodeURIComponent(url.search)}` : '')
    } else if (typeof href === 'object' && Array.isArray(href.data) && href.data.length && href.data[0].id) {
      return this.dataToUrl(href.data[0])
    }
    return false
  }

  /**
   * Convert object data to a url.
   * @param {object} data
   */
  dataToUrl (data) {
    return '/' + data.type.replace('--', '/') + '/' + data.id
  }

  /**
   * Retrieve resources of each collection item.
   * @return {array} Instances of each resource.
   */
  resources () {
    if (this.isCollection()) {
      if (!this._resources) {
        this.spider.emit('collection-index', { collection: this })
        this._resources = this.data.map(resource => new Resource(resource, this.spider, this.config))
      }
      return this._resources
    }
    return [this]
  }

  /**
   * Return the attached relationships (unloaded entities)
   * @return {object}
   */
  relationships () {
    return this._relationships
  }

  /**
   * Sets an internal promise that resolves when all pending relationships
   * have been crawled (not necessarily output)
   * @param {Promise} crawlPromise
   * @return {Resource}
   */
  setRelationshipCrawlers (crawlPromise) {
    this._relationshipCrawlers = crawlPromise
    return this
  }

  /**
   * The relationship crawlers promise that should resolve when all of this
   * resource's relationships are loaded.
   * @return {Promise}
   */
  relationshipCrawlers () {
    return this._relationshipCrawlers
  }

  /**
   * Return the attached attributes (generally node or field data)
   * @return {object}
   */
  attributes () {
    return this._attributes
  }

  /**
   * Parse and return all relevant related resource paths.
   * @return {array} List of relationships.
   */
  relationshipUrls () {
    if (!this.isCollection()) {
      const urls = [...this.parseRelationshipUrls(
        Object.keys(this._relationships)
          .filter(k => this.config.relationships.some(r => r.test(k)))
          .map(k => this._relationships[k])
      )]
      return urls
    }
    return []
  }

  /**
   * Given an array or object, recursively seek out all relationship.
   * @param {array|object} set
   * @return {Set}
   */
  parseRelationshipUrls (items) {
    const isRelationship = i => typeof i === 'object' && i && !Array.isArray(i) && i.type && i.id && i.type.indexOf('--') > 1
    if (isRelationship(items)) {
      return new Set([this.dataToUrl(items)])
    }
    if (typeof items === 'object' && !!items) {
      items = (!Array.isArray(items)) ? Object.values(items) : items
      return items.reduce((set, item) => new Set([...set, ...this.parseRelationshipUrls(item)]), new Set())
    }
    return new Set()
  }

  /**
   * Checks if there is an additional collection page.
   * @return {boolean}
   */
  hasNextPage () {
    return this.isCollection() && this.raw.links && this.raw.links.next
  }

  /**
   * For collections that are paginated, this retrieves the next pagination url.
   * @return {string}
   */
  nextPageUrl () {
    if (this.hasNextPage()) {
      return this.relativeUrl(this.raw.links.next.href)
    }
  }

  /**
   * Set the configuration for transforming this resource.
   * @param {object}
   * @return Resource
   */
  setTransformerConfig (config) {
    this._transformerConfig = config
    return this
  }

  /**
   * Returns the configuration for transforming this resource.
   * @return {object}
   */
  transformerConfig () {
    return this._transformerConfig
  }

  /**
   * Set the transformed fields of this resource.
   * @param {object}
   * @return Resource
   */
  setTransformedFields (fields) {
    this._transformedFields = fields
    return this
  }

  /**
   * Returns the transformed fields of this resource.
   * @return {object}
   */
  transformedFields () {
    return this._transformedFields
  }

  /**
   * Set the final transformed data property.
   * @param {object} transformed JSON.stringify ready object representing this resource.
   * @return {Resource}
   */
  setTransformedData (transformed) {
    this._transformed = transformed
  }

  /**
   * Return the transformed data that represents this resource. This must be
   * set using `setTransformedData` from an external source. The Resource class
   * does not contain any transformers.
   * @return {object}
   */
  transformedData () {
    return this._transformed ? this._transformed : this.data
  }
}

module.exports = Resource
