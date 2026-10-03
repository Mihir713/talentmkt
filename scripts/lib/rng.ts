// Deterministic PRNG (sfc32, seeded through splitmix32) and the sampling helpers the seeder needs.

function splitmix32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x9e3779b9) >>> 0
    let z = state
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
    return (z ^ (z >>> 16)) >>> 0
  }
}

export class Rng {
  private a: number
  private b: number
  private c: number
  private d: number

  constructor(seed: number) {
    const mix = splitmix32(seed)
    this.a = mix()
    this.b = mix()
    this.c = mix()
    this.d = mix()
    for (let i = 0; i < 12; i++) this.next()
  }

  /** Uniform in [0, 1). */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0
    this.d = (this.d + 1) >>> 0
    this.a = this.b ^ (this.b >>> 9)
    this.b = (this.c + (this.c << 3)) >>> 0
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0
    this.c = (this.c + t) >>> 0
    return t / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)]
    if (item === undefined) throw new Error('pick from empty list')
    return item
  }

  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0
    for (const item of items) total += weight(item)
    let r = this.next() * total
    for (const item of items) {
      r -= weight(item)
      if (r < 0) return item
    }
    const last = items[items.length - 1]
    if (last === undefined) throw new Error('weighted pick from empty list')
    return last
  }

  /** Standard normal (Box–Muller). */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = items[i] as T
      items[i] = items[j] as T
      items[j] = tmp
    }
    return items
  }

  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle([...items]).slice(0, n)
  }

  /** RFC 4122 v4-shaped UUID from this stream. */
  uuid(): string {
    const hex: string[] = []
    for (let i = 0; i < 16; i++) hex.push(Math.floor(this.next() * 256).toString(16).padStart(2, '0'))
    hex[6] = '4' + (hex[6] as string)[1]
    hex[8] = ((parseInt(hex[8] as string, 16) & 0x3f) | 0x80).toString(16)
    const h = hex.join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
}
