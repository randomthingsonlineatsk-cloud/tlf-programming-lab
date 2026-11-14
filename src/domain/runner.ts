// Running R through webR: load the hand-off into R, run the reference programs once, then run a
// learner's program in its own environment and bring its output back as a table of strings.
// The same code drives webR in the browser and in the Node tests.
import type { WebR } from 'webr'
import { PRELUDE, PROGRAMS, programById, type Program } from './rcode'
import { toCsv, type Handoff } from './handoff'

export interface Frame { columns: string[]; rows: (string | null)[][] }
export interface RunResult { ok: boolean; error?: string; output: { type: string; text: string }[]; frame?: Frame; images: unknown[]; ms: number }

const rStr = (s: string) => JSON.stringify(s) // a JSON string literal is a valid R string literal for our text

export async function loadHandoff(w: WebR, h: Handoff): Promise<string[]> {
  await w.evalRVoid(PRELUDE)
  try { await w.FS.mkdir('/home/web_user/sdtm') } catch { /* exists */ }
  const loaded: string[] = []
  for (const d of h.datasets) {
    const { csv, classes } = toCsv(d)
    await w.FS.writeFile(`/home/web_user/sdtm/${d.name.toLowerCase()}.csv`, new TextEncoder().encode(csv))
    const cls = `c(${Object.entries(classes).map(([k, v]) => `${rStr(k)} = ${rStr(v)}`).join(', ')})`
    await w.evalRVoid(`${d.name.toLowerCase()} <- read_sdtm(${rStr(d.name)}, ${cls})`)
    loaded.push(d.name.toLowerCase())
  }
  return loaded
}

// A data frame from R as a Frame, through one packed string (see .lab_pack in the prelude).
export function unpack(s: string): Frame {
  const parts = s.split('\x1e')
  const columns = parts[0] === '' ? [] : parts[0].split('\x1f')
  const n = Number(parts[1])
  const cols = parts.slice(2).map((c) => (n === 0 ? [] : c.split('\x1f').map((v) => (v === '\x15' ? null : v))))
  return { columns, rows: Array.from({ length: n }, (_, i) => cols.map((c) => c[i] ?? null)) }
}
export async function frameOf(w: WebR, expr: string): Promise<Frame> {
  return unpack(await w.evalRString(`.lab_pack(${expr})`))
}

// Run every reference program in order; their outputs stay in R as .ref_<output> and come back as frames.
export async function runReferences(w: WebR): Promise<Record<string, Frame>> {
  const out: Record<string, Frame> = {}
  for (const p of PROGRAMS) {
    await w.evalRVoid(`local({ ${needsCode(p)}\n${p.reference}\n.ref_${p.output} <<- ${p.output} })`)
    out[p.id] = await frameOf(w, `.ref_${p.output}`)
  }
  return out
}
const needsCode = (p: Program) => p.needs.map((id) => `${programById.get(id)!.output} <- .ref_${programById.get(id)!.output}`).join('\n')

// Run a learner's program: a fresh environment holding the validated upstream datasets; the SDTM
// datasets are visible from the global environment. Visible results are printed, as at the console.
export async function runProgram(w: WebR, p: Program, code: string, graphics?: { width: number; height: number }): Promise<RunResult> {
  const t0 = Date.now()
  await w.objs.globalEnv.bind('.lab_code', code)
  const shelter = await new w.Shelter()
  const wrapped = `
.lab_env <- new.env(parent = globalenv())
local({ ${p.needs.map((id) => `assign(${rStr(programById.get(id)!.output)}, .ref_${programById.get(id)!.output}, envir = .lab_env)`).join('; ')} })
.lab_error <- NULL
tryCatch({
  for (.e in parse(text = .lab_code)) { .v <- withVisible(eval(.e, .lab_env)); if (.v$visible) print(.v$value) }
}, error = function(e) { .lab_error <<- conditionMessage(e); message("Error: ", conditionMessage(e)) })
invisible(NULL)`
  try {
    const cap = await shelter.captureR(wrapped, { captureGraphics: graphics ? { width: graphics.width, height: graphics.height } : false, withAutoprint: false, captureStreams: true, captureConditions: true })
    const output = cap.output.map((o) => ({ type: o.type, text: typeof o.data === 'string' ? o.data : String((o.data as { message?: string })?.message ?? '') }))
    const err = await w.evalRString('if (is.null(.lab_error)) "" else .lab_error')
    if (err) return { ok: false, error: err, output, images: cap.images ?? [], ms: Date.now() - t0 }
    const exists = await w.evalRBoolean(`exists(${rStr(p.output)}, envir = .lab_env, inherits = FALSE)`)
    if (!exists) return { ok: false, error: `The program did not create ${p.output}.`, output, images: cap.images ?? [], ms: Date.now() - t0 }
    const frame = await frameOf(w, `get(${rStr(p.output)}, envir = .lab_env)`)
    return { ok: true, output, frame, images: cap.images ?? [], ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, error: (e as Error).message, output: [], images: [], ms: Date.now() - t0 }
  } finally { await shelter.purge() }
}

// The production programmer's Table 14.3.1 (for the QC mission), run on the validated datasets.
export async function runProduction(w: WebR, code: string): Promise<Frame> {
  await w.evalRVoid(`local({ adsl <- .ref_adsl; adae <- .ref_adae\n${code}\n.prod_t2 <<- prod_t2 })`)
  return frameOf(w, '.prod_t2')
}
