class Queue {
  constructor (maxConcurrent) {
    this.maxConcurrent = maxConcurrent
    this.queue = []
    this.pending = new Set()
  }

  /**
   * Add a callback to the queue. Items should be callbacks that return a
   * promise which resolves when it compeltes.
   * @param {function} item
   */
  add (item) {
    this.queue.push(item)
    this.next()
  }

  /**
   * If appropriate triggers the next item in the queue.
   * @return {Queue}
   */
  next () {
    if (this.pending.size < this.maxConcurrent) {
      const item = this.queue.shift()
      const willComplete = item()
      this.pending.add(willComplete)
      willComplete
        .then(() => {
          this.pending.delete(willComplete)
          this.next()
        })
        .catch((err) => {
          this.pending.delete(willComplete)
          throw err
        })
    }
  }
}

module.exports = Queue
