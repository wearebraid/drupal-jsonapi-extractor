class BaseEmitter {
  /**
   * Initialize the object.
   */
  constructor () {
    this.observers = []
  }

  /**
   * Notify observers of a given event taking place.
   * @param {string} event
   * @param {object} payload
   */
  emit (event, payload) {
    for (const observer of this.observers) {
      if (observer.event === event || observer.event === '*') {
        observer.callback({ ...payload, event })
      }
    }
    return this
  }

  /**
   * Listen for updates to the object.
   * Listen to all events: obj.listen(() => {})
   * Listen to one event: obj.listen('pending', () => {})
   *
   * @param {string|function}
   * @param {function}
   */
  observe () {
    const args = Array.from(arguments)
    if (typeof args[args.length - 1] !== 'function') {
      throw new Error(`Last argument of listen must be a callback function, ${typeof args[args.length - 1]} given.`)
    }
    const callback = args.pop()
    args.length || args.push('*')
    while (args.length) {
      this.observers.push({ event: args.shift(), callback })
    }
    return this
  }
}

module.exports = BaseEmitter
