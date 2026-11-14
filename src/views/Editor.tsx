import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { StreamLanguage } from '@codemirror/language'
import { r } from '@codemirror/legacy-modes/mode/r'

// The R code editor (CodeMirror 6 with the R mode). Ctrl/Cmd+Enter runs the program.
export default function Editor({ value, onChange, onRun, label }: { value: string; onChange: (v: string) => void; onRun: () => void; label: string }) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const cb = useRef({ onChange, onRun })
  cb.current = { onChange, onRun }
  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup, StreamLanguage.define(r),
          keymap.of([{ key: 'Mod-Enter', run: () => { cb.current.onRun(); return true } }]),
          EditorView.updateListener.of((u) => { if (u.docChanged) cb.current.onChange(u.state.doc.toString()) }),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.theme({ '&': { fontSize: '13px', backgroundColor: '#fff', color: '#1d2433' }, '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }, '.cm-gutters': { backgroundColor: '#f2f4f7', color: '#6b7280', border: 'none' }, '&.cm-focused': { outline: '2px solid #3b82f6' } }),
        ],
      }),
    })
    return () => view.current?.destroy()
  }, [])
  // Replace the document when the value changes from outside (reset, load reference).
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])
  return <div ref={host} className="rounded border border-lab-line overflow-hidden min-h-[18rem] max-h-[34rem] overflow-y-auto" />
}
