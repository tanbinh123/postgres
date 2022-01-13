const originCache = new Map()

export default class Query extends Promise {
  constructor(strings, args, handler, canceller, options = {}) {
    let resolve
      , reject

    super((a, b) => {
      resolve = a
      reject = b
    })

    this.tagged = Array.isArray(strings.raw)
    this.strings = strings
    this.args = args
    this.handler = handler
    this.canceller = canceller
    this.options = options

    this.state = null
    this.statement = null

    this.resolve = x => (this.active = false, resolve(x))
    this.reject = x => (this.active = false, reject(x))

    this.active = false
    this.cancelled = null
    this.executed = false
    this.signature = ''

    this.origin = handler.debug ? new Error().stack : cachedError(this.strings)
  }

  static get [Symbol.species]() {
    return Promise
  }

  cancel() {
    return this.canceller && (this.canceller(this), this.canceller = null)
  }

  async readable() {
    this.options.simple = true
    this.options.prepare = false
    this.streaming = true
    return this
  }

  async writable() {
    this.options.simple = true
    this.options.prepare = false
    this.streaming = true
    return this
  }

  cursor(rows = 1, fn) {
    this.options.simple = false
    if (typeof rows === 'function') {
      fn = rows
      rows = 1
    }

    this.cursorRows = rows

    if (typeof fn === 'function')
      return (this.cursorFn = fn, this)

    let prev
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => {
          prev && prev()
          const promise = new Promise((resolve, reject) => {
            this.cursorFn = x => {
              resolve({ value: x, done: false })
              return new Promise(r => prev = r)
            }
            this.resolve = () => (this.active = false, resolve({ done: true }))
            this.reject = x => (this.active = false, reject(x))
          })
          this.execute()
          return promise
        }
      })
    }
  }

  describe() {
    this.onlyDescribe = true
    return this
  }

  stream() {
    throw new Error('.stream has been renamed to .forEach')
  }

  forEach(fn) {
    this.forEachFn = fn
    return this
  }

  raw() {
    this.isRaw = true
    return this
  }

  async handle() {
    !this.executed && (this.executed = true) && await 1 && this.handler(this)
  }

  execute() {
    this.handle()
    return this
  }

  then() {
    this.handle()
    return super.then.apply(this, arguments)
  }

  catch() {
    this.handle()
    return super.catch.apply(this, arguments)
  }

  finally() {
    this.handle()
    return super.finally.apply(this, arguments)
  }
}

function cachedError(xs) {
  if (originCache.has(xs))
    return originCache.get(xs)

  const x = Error.stackTraceLimit
  Error.stackTraceLimit = 4
  originCache.set(xs, new Error().stack)
  Error.stackTraceLimit = x
  return originCache.get(xs)
}
