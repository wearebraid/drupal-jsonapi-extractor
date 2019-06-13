class Logger {
  /**
   * Listen to emissions and log them.
   * @param {eventEmitter} eventEmitter
   */
  constructor (emitters) {
    (Array.isArray(emitters) ? emitters : [emitters]).map(e => this.listen(e))
    this.map = {
      'crawl-error': '⚠️',
      'crawl-complete': '🎉',
      'crawl-resource-complete': false,
      'resource-loaded': false,
      'crawl-started': false,
      'crawl-depth-complete': false,
      'resource-slug-saved': false,
      'resource-saved': '\x1b[32m✔️\x1b[0m'
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
    if (typeof this[method] === 'function') {
      this[method](payload)
    } else if (this.map[event] !== false) {
      console.log(`${this.map[event] || event}   ${event === 'crawl-complete' ? 'Crawl complete!' : payload.path}`)
    }
    if (event.includes('error')) {
      console.log(payload.err)
    }
  }

  /**
   * Lets extract some extra data if this is a resource being saved.
   */
  logResourceSaved ({ resource }) {
    console.log(`${this.map['resource-saved']}  ${resource.entity()}: ${resource.id()}`)
  }
}

module.exports = Logger
