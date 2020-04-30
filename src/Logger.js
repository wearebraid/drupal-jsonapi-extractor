class Logger {
  /**
   * Listen to emissions and log them.
   * @param {eventEmitter} eventEmitter
   */
  constructor (emitters, options = {}) {
    this.logs = {
      errors: [],
      resources: {},
      total: 0
    }
    this.config = Object.assign({
      verbosity: 1
    }, options);
    (Array.isArray(emitters) ? emitters : [emitters]).map(e => this.listen(e))
    if (this.config.verbosity > 0) {
      this.map = Object.assign({
        'crawl-error': '⚠️',
        'crawl-complete': '🎉',
        'crawl-resource-complete': false,
        'resource-loaded': false,
        'crawl-started': false,
        'crawl-depth-complete': false,
        'resource-slug-saved': false,
        'resource-saved': '\x1b[32m✔️\x1b[0m',
        'collection-saved': '\x1b[32m📁\x1b[0m'
      }, this.config.map || {})
    } else {
      this.map = {}
    }
  }

  /**
   * Listen to events on a given emitter.
   * @param {object} emitter
   */
  listen (emitter) {
    emitter.observe(this.log.bind(this))
  }

  /**
   * Log events as they come.
   * @param {object}
   */
  log (payload) {
    const event = payload.event
    const method = 'log' + event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    if (typeof this[method] === 'function' && this.config.verbosity > 0) {
      this[method](payload)
    } else if (this.config.verbosity > 2) {
      console.log(`${this.map[event] || event}   ${payload.path}`)
    }
    if (event.includes('error')) {
      this.logs.errors.push(payload)
      if (payload.message && this.verbosity > 1) {
        console.log(payload.message)
      }
    }
  }

  /**
   * Output a digest of the log.
   */
  logCrawlComplete () {
    if (this.config.verbosity === 1) {
      console.log('\n')
    }
    console.log(`----------------------------\n🎉  Crawl Complete!`)
    let entities = ''
    const maxLength = Object.keys(this.logs.resources).reduce((max, e) => e.length > max ? e.length : max, 6)
    for (const entity in this.logs.resources) {
      entities += `\n${entity}${'.'.repeat(maxLength - entity.length + 10)}${this.logs.resources[entity].length}`
    }
    console.log(`Errors${'.'.repeat(maxLength - 6 + 10)}${this.logs.errors.length}${entities}`)
  }

  /**
   * Lets extract some extra data if this is a resource being saved.
   */
  logResourceSaved ({ resource }) {
    const entity = resource.entity()
    if (Array.isArray(this.logs.resources[entity])) {
      this.logs.resources[entity].push(resource)
      this.logs.total++
    } else {
      this.logs.resources[entity] = [resource]
    }
    const line = `${this.map['resource-saved'] || 'resource-saved'}  ${resource.entity()}: ${resource.id()}`
    if (this.config.verbosity > 1) {
      console.log(line)
    } else {
      process.stdout.clearLine()
      process.stdout.cursorTo(0)
      process.stdout.write(`Saved: ${this.logs.total}\tErrors: ${this.logs.errors.length}`)
    }
  }

  /**
   * Lets extract some extra data if this is a collection being saved.
   */
  logCollectionSaved ({ collection }) {
    const line = `${this.map['collection-saved'] || 'collection-saved'}  ${collection.path()}/index.json`
    if (this.config.verbosity > 1) {
      console.log(line)
    } else {
      process.stdout.clearLine()
      process.stdout.cursorTo(0)
      process.stdout.write(`Saved: ${this.logs.total}\tErrors: ${this.logs.errors.length}`)
    }
  }
}

module.exports = Logger
