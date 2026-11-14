// The R side of the lab: the prelude that loads the SDTM hand-off into R, the programs a learner
// writes (with their specifications and starter code) and the independent reference programs the
// lab compares against. Base R only, so everything runs in webR without downloading packages.

import { LIBRARY } from './rlib'

// Run before every program: helpers for reading SDTM and for handing results back to the lab.
export const PRELUDE = LIBRARY + String.raw`
.lab_dir <- "/home/web_user/sdtm"
read_sdtm <- function(name, classes) {
  f <- file.path(.lab_dir, paste0(tolower(name), ".csv"))
  utils::read.csv(f, colClasses = classes, na.strings = "", stringsAsFactors = FALSE, check.names = FALSE)
}
# A data frame as text columns for comparison: dates as YYYY-MM-DD, numbers to 10 significant digits.
.lab_chr <- function(df) {
  if (!is.data.frame(df)) stop("the program must create a data frame")
  out <- lapply(df, function(x) {
    if (inherits(x, "Date")) return(ifelse(is.na(x), NA_character_, format(x, "%Y-%m-%d")))
    if (is.factor(x)) x <- as.character(x)
    if (is.logical(x)) return(ifelse(is.na(x), NA_character_, ifelse(x, "TRUE", "FALSE")))
    if (is.numeric(x)) return(ifelse(is.na(x), NA_character_, formatC(signif(x, 10), digits = 10, format = "fg", flag = "")))
    as.character(x)
  })
  out <- lapply(out, trimws)
  as.data.frame(out, stringsAsFactors = FALSE, check.names = FALSE)
}
# The text columns packed into one string (columns split by \x1e, cells by \x1f, NA as \x15):
# one plain string crosses from R to JavaScript reliably whatever the data frame's attributes.
.lab_pack <- function(df) {
  x <- .lab_chr(df)
  cols <- vapply(x, function(v) paste(ifelse(is.na(v), "\x15", v), collapse = "\x1f"), "")
  paste(c(paste(names(x), collapse = "\x1f"), as.character(nrow(x)), cols), collapse = "\x1e")
}
`

export type { Kind, Area, SpecRow, Program, StudyPack } from './packs/types'
import type { Program, StudyPack } from './packs/types'
import { GLV } from './packs/glv'
import { HRP } from './packs/hrp'

export const PACKS: Record<string, StudyPack> = { [GLV.id]: GLV, [HRP.id]: HRP }
export const packOf = (study: string): StudyPack => PACKS[study] ?? GLV
export const programMap = (pack: StudyPack) => new Map(pack.programs.map((p) => [p.id, p]))
export const outputOf = (pack: StudyPack, id: string) => pack.programs.find((p) => p.id === id)!.output
// The default pack, for code that predates study packs (GLV-12-301).
export const PROGRAMS: Program[] = GLV.programs
export const programById = programMap(GLV)
