// A fake AudioContext for the S3 audio tests.
//
// SUPPORTED surface (the implementation must stay inside it):
//   new Ctor(...)            counted in `instances`; starts with state 'suspended'
//   ctx.currentTime (number, moved by `audio.advance(seconds)`), ctx.sampleRate = 44100,
//   ctx.destination, ctx.state, ctx.resume(), ctx.close()
//   ctx.createOscillator(), createGain(), createBuffer(), createBufferSource(),
//   createBiquadFilter(), createDynamicsCompressor()
//   nodes: connect(target), disconnect(); oscillator: type, frequency, detune, start(when), stop(when);
//   buffer source: buffer, loop, start(when), stop(when); gain: .gain; filter: frequency, Q, type
//   AudioParam: value, setValueAtTime, linearRampToValueAtTime, exponentialRampToValueAtTime,
//   setTargetAtTime, cancelScheduledValues
// Anything else is undefined and throws a TypeError when called.
class FakeParam {
  constructor(value = 0) {
    this.value = value
    this.events = []
  }
  _ev(fn, args) {
    this.events.push({ fn, args })
    return this
  }
  setValueAtTime(...a) { return this._ev('setValueAtTime', a) }
  linearRampToValueAtTime(...a) { return this._ev('linearRampToValueAtTime', a) }
  exponentialRampToValueAtTime(...a) { return this._ev('exponentialRampToValueAtTime', a) }
  setTargetAtTime(...a) { return this._ev('setTargetAtTime', a) }
  cancelScheduledValues(...a) { return this._ev('cancelScheduledValues', a) }
}

class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx
    this.kind = kind
    this.connections = []
    this.disconnects = 0
    ctx.nodes.push(this)
  }
  connect(target) {
    this.connections.push(target)
    return target
  }
  disconnect() {
    this.disconnects++
  }
}

class FakeSource extends FakeNode {
  constructor(ctx, kind) {
    super(ctx, kind)
    this.starts = []
    this.stops = []
  }
  start(when = 0) {
    this.starts.push(when)
  }
  stop(when = 0) {
    this.stops.push(when)
  }
}

export function createFakeAudio() {
  const instances = []
  class FakeAudioContext {
    constructor(...args) {
      this.args = args
      this.state = 'suspended'
      this.currentTime = 0
      this.sampleRate = 44100
      this.destination = { kind: 'destination' }
      this.nodes = []
      this.resumeCalls = 0
      this.closeCalls = 0
      instances.push(this)
    }
    resume() {
      this.resumeCalls++
      this.state = 'running'
      return Promise.resolve()
    }
    close() {
      this.closeCalls++
      this.state = 'closed'
      return Promise.resolve()
    }
    createOscillator() {
      const n = new FakeSource(this, 'oscillator')
      n.type = 'sine'
      n.frequency = new FakeParam(440)
      n.detune = new FakeParam(0)
      return n
    }
    createBufferSource() {
      const n = new FakeSource(this, 'bufferSource')
      n.buffer = null
      n.loop = false
      return n
    }
    createBuffer(channels, length, rate) {
      return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: () => new Float32Array(length) }
    }
    createGain() {
      const n = new FakeNode(this, 'gain')
      n.gain = new FakeParam(1)
      return n
    }
    createBiquadFilter() {
      const n = new FakeNode(this, 'filter')
      n.type = 'lowpass'
      n.frequency = new FakeParam(350)
      n.Q = new FakeParam(1)
      return n
    }
    createDynamicsCompressor() {
      return new FakeNode(this, 'compressor')
    }
    get sources() {
      return this.nodes.filter((n) => n.kind === 'oscillator' || n.kind === 'bufferSource')
    }
  }

  const all = () => instances.flatMap((i) => i.nodes)
  return {
    Ctor: FakeAudioContext,
    instances,
    get ctx() { return instances[0] },
    nodeCount: () => all().length,
    sources: () => all().filter((n) => n.kind === 'oscillator' || n.kind === 'bufferSource'),
    startedSources: () => all().filter((n) => (n.kind === 'oscillator' || n.kind === 'bufferSource') && n.starts.length > 0),
    advance(seconds) {
      for (const i of instances) i.currentTime += seconds
    },
  }
}

// A source counts as silenced at time t when its last stop() is at or before t (plus a
// 50 ms slack) or it was disconnected.
export const silencedBy = (src, t) => src.disconnects > 0 || (src.stops.length > 0 && src.stops.at(-1) <= t + 0.05)

// A stable description of what a source plays, for telling sounds apart.
export const signature = (sources) =>
  JSON.stringify(
    sources.map((s) => ({
      kind: s.kind,
      type: s.type ?? null,
      freq: s.frequency ? { v: s.frequency.value, e: s.frequency.events } : null,
    })),
  )
