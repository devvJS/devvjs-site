// A recording fake CanvasRenderingContext2D for the S3 render tests.
//
// SUPPORTED (anything else is undefined, so calling it throws a TypeError):
//   methods: fillRect, strokeRect, clearRect, fillText, drawImage (3, 5 or 9 args),
//            putImageData, createImageData, measureText, save, restore, translate,
//            setTransform (translation-only matrix: a=d=1, b=c=0), resetTransform
//   properties: fillStyle, strokeStyle, globalAlpha, font, textAlign, textBaseline,
//               imageSmoothingEnabled, globalCompositeOperation
// NOT supported: scale, rotate, transform, paths, clip. Scaling is done by CSS.
//
// Every draw call is recorded in `records` with its position in "effective" space:
// raw coordinates plus the accumulated translate offset. So a renderer may apply the
// camera with translate or by subtracting it from the coordinates: both look the same.
export function createRecordingContext() {
  const records = []
  const calls = []
  const sets = []
  let tx = 0
  let ty = 0
  const stack = []
  const props = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    font: '10px monospace',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
  }
  const ctx = {}
  for (const name of Object.keys(props)) {
    Object.defineProperty(ctx, name, {
      enumerable: true,
      get: () => props[name],
      set: (v) => {
        props[name] = v
        sets.push({ prop: name, value: v })
      },
    })
  }

  const note = (fn, args) => calls.push({ fn, args })
  const add = (rec) => records.push(rec)

  Object.assign(ctx, {
    fillRect(x, y, w, h) {
      note('fillRect', [x, y, w, h])
      add({ fn: 'fillRect', x: x + tx, y: y + ty, w, h, style: props.fillStyle, alpha: props.globalAlpha })
    },
    strokeRect(x, y, w, h) {
      note('strokeRect', [x, y, w, h])
      add({ fn: 'strokeRect', x: x + tx, y: y + ty, w, h, style: props.strokeStyle, alpha: props.globalAlpha })
    },
    clearRect(x, y, w, h) {
      note('clearRect', [x, y, w, h])
      add({ fn: 'clearRect', x: x + tx, y: y + ty, w, h, style: null, alpha: 1 })
    },
    fillText(text, x, y) {
      note('fillText', [text, x, y])
      add({
        fn: 'fillText',
        text: String(text),
        x: x + tx,
        y: y + ty,
        w: 0,
        h: 0,
        style: props.fillStyle,
        alpha: props.globalAlpha,
      })
    },
    drawImage(img, ...a) {
      note('drawImage', [img, ...a])
      let x, y, w, h
      if (a.length === 2) [x, y] = a
      else if (a.length === 4) [x, y, w, h] = a
      else if (a.length === 8) [, , , , x, y, w, h] = a
      else throw new Error('drawImage: unsupported argument count ' + a.length)
      if (w === undefined) {
        w = img?.width ?? 0
        h = img?.height ?? 0
      }
      add({ fn: 'drawImage', x: x + tx, y: y + ty, w, h, style: null, alpha: props.globalAlpha })
    },
    putImageData(data, x, y) {
      note('putImageData', [data, x, y])
      add({ fn: 'putImageData', x: x + tx, y: y + ty, w: data.width, h: data.height, style: null, alpha: 1 })
    },
    createImageData(w, h) {
      note('createImageData', [w, h])
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
    },
    measureText(text) {
      note('measureText', [text])
      return { width: String(text).length * 6 }
    },
    save() {
      note('save', [])
      stack.push({ tx, ty, props: { ...props } })
    },
    restore() {
      note('restore', [])
      const s = stack.pop()
      if (!s) return
      tx = s.tx
      ty = s.ty
      Object.assign(props, s.props)
    },
    translate(x, y) {
      note('translate', [x, y])
      tx += x
      ty += y
    },
    setTransform(a, b, c, d, e, f) {
      note('setTransform', [a, b, c, d, e, f])
      if (a !== 1 || b !== 0 || c !== 0 || d !== 1) throw new Error('fake ctx: only translation transforms are supported')
      tx = e
      ty = f
    },
    resetTransform() {
      note('resetTransform', [])
      tx = 0
      ty = 0
    },
  })

  ctx.records = records
  ctx.calls = calls
  ctx.sets = sets
  ctx.reset = () => {
    records.length = 0
    calls.length = 0
    sets.length = 0
    tx = 0
    ty = 0
    stack.length = 0
  }
  return ctx
}

// ---- helpers over records ----
export const textsOf = (records) => records.filter((r) => r.fn === 'fillText').map((r) => r.text)

// Multiset difference a - b, comparing records by value.
export function minus(a, b) {
  const counts = new Map()
  for (const r of b) {
    const k = JSON.stringify(r)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const out = []
  for (const r of a) {
    const k = JSON.stringify(r)
    const n = counts.get(k) || 0
    if (n > 0) counts.set(k, n - 1)
    else out.push(r)
  }
  return out
}

// Box of a record in effective space. Text counts as its anchor point.
export const boundsOf = (r) => ({ minX: r.x, minY: r.y, maxX: r.x + (r.w || 0), maxY: r.y + (r.h || 0) })

export function unionBounds(records) {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const r of records) {
    const rb = boundsOf(r)
    b.minX = Math.min(b.minX, rb.minX)
    b.minY = Math.min(b.minY, rb.minY)
    b.maxX = Math.max(b.maxX, rb.maxX)
    b.maxY = Math.max(b.maxY, rb.maxY)
  }
  return b
}

// Records whose box touches `rect` grown by `pad`. Text is left out.
export function nearRect(records, rect, pad) {
  return records.filter((r) => {
    if (r.fn === 'fillText') return false
    const b = boundsOf(r)
    return (
      b.maxX > rect.x - pad && b.minX < rect.x + rect.w + pad && b.maxY > rect.y - pad && b.minY < rect.y + rect.h + pad
    )
  })
}
