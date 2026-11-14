// The lab's validated R library, loaded before every program. Companies keep a small set of
// validated functions (macros or package functions) that programmers call instead of re-deriving
// the numerics; these play that part. Base R only, so they run in webR without downloads.
// Each one is documented in the Learn tab and checked in the tests against an independent
// implementation (complete-data ANCOVA for lab_mmrm; a survival library for lab_cox).
export const LIBRARY = String.raw`
# lab_mmrm(formula, data, subject, visit): mixed model for repeated measures, unstructured
# covariance between visits, restricted maximum likelihood (REML). Records with a missing response
# are dropped (missing at random). Returns coefficients, their covariance, the visit covariance
# matrix and residual degrees of freedom (participants minus fixed-effect parameters).
lab_mmrm <- function(formula, data, subject, visit) {
  data <- data[!is.na(data[[all.vars(formula)[1]]]), , drop = FALSE]
  data[[visit]] <- factor(data[[visit]])
  data <- data[order(data[[subject]], data[[visit]]), , drop = FALSE]
  tt <- terms(formula)
  mf <- model.frame(tt, data)
  X <- model.matrix(tt, mf); y <- model.response(mf)
  keep <- qr(X)$pivot[seq_len(qr(X)$rank)]; X <- X[, sort(keep), drop = FALSE]
  vis <- as.integer(data[[visit]]); nv <- nlevels(data[[visit]])
  ids <- split(seq_len(nrow(data)), data[[subject]])
  p <- ncol(X); k <- nv * (nv + 1) / 2
  build <- function(th) { L <- matrix(0, nv, nv); L[lower.tri(L, diag = TRUE)] <- th; diag(L) <- exp(diag(L)); L %*% t(L) }
  pieces <- function(S) {
    XtVX <- matrix(0, p, p); XtVy <- numeric(p); yVy <- 0; ld <- 0
    for (i in ids) {
      Si <- S[vis[i], vis[i], drop = FALSE]; U <- chol(Si)
      Xi <- backsolve(U, X[i, , drop = FALSE], transpose = TRUE); yi <- backsolve(U, y[i], transpose = TRUE)
      XtVX <- XtVX + crossprod(Xi); XtVy <- XtVy + drop(crossprod(Xi, yi)); yVy <- yVy + sum(yi^2); ld <- ld + 2 * sum(log(diag(U)))
    }
    list(XtVX = XtVX, XtVy = XtVy, yVy = yVy, ld = ld)
  }
  nll <- function(th) {
    v <- tryCatch({
      q <- pieces(build(th))
      b <- solve(q$XtVX, q$XtVy); r <- q$yVy - 2 * sum(b * q$XtVy) + drop(t(b) %*% q$XtVX %*% b)
      0.5 * (q$ld + as.numeric(determinant(q$XtVX)$modulus) + r)
    }, error = function(e) 1e10)
    if (is.finite(v)) v else 1e10
  }
  res <- resid(lm.fit(X, y)); s0 <- tapply(res, vis, sd)
  th0 <- diag(log(s0)); th0 <- th0[lower.tri(th0, diag = TRUE)]
  opt <- optim(th0, nll, method = "BFGS", control = list(maxit = 2000, reltol = 1e-12))
  S <- build(opt$par); q <- pieces(S)
  V <- solve(q$XtVX); b <- drop(V %*% q$XtVy); names(b) <- colnames(X)
  dimnames(S) <- list(levels(data[[visit]]), levels(data[[visit]]))
  structure(list(coef = b, vcov = V, sigma = S, df = length(ids) - p, terms = delete.response(tt),
                 xlevels = .getXlevels(tt, mf), converged = opt$convergence == 0, n = length(ids)), class = "lab_mmrm")
}

# lab_estimate(fit, new1, new0): the model-based mean at new1 (one row), or the difference
# new1 minus new0 when new0 is given, with its standard error, 95% CI and two-sided p-value.
lab_estimate <- function(fit, new1, new0 = NULL) {
  xrow <- function(nd) { m <- model.matrix(fit$terms, model.frame(fit$terms, nd, xlev = fit$xlevels)); m[1, names(fit$coef)] }
  l <- xrow(new1); if (!is.null(new0)) l <- l - xrow(new0)
  est <- sum(l * fit$coef); se <- sqrt(drop(t(l) %*% fit$vcov %*% l)); q <- qt(0.975, fit$df)
  c(est = est, se = se, lcl = est - q * se, ucl = est + q * se, p = 2 * pt(-abs(est / se), fit$df))
}

# lab_cox(time, event, x): Cox proportional hazards model by Newton-Raphson on the partial
# likelihood, Breslow method for ties. x is a numeric matrix of covariates (no intercept).
# Returns coefficients, standard errors, hazard ratios with 95% CI and Wald p-values.
lab_cox <- function(time, event, x) {
  x <- as.matrix(x); o <- order(time); time <- time[o]; event <- event[o]; x <- x[o, , drop = FALSE]
  b <- rep(0, ncol(x))
  for (it in 1:50) {
    eta <- drop(x %*% b); w <- exp(eta); U <- rep(0, ncol(x)); I <- matrix(0, ncol(x), ncol(x))
    for (t in unique(time[event == 1])) {
      risk <- time >= t; d <- time == t & event == 1; nd <- sum(d)
      s0 <- sum(w[risk]); s1 <- colSums(x[risk, , drop = FALSE] * w[risk]); s2 <- crossprod(x[risk, , drop = FALSE] * sqrt(w[risk]))
      U <- U + colSums(x[d, , drop = FALSE]) - nd * s1 / s0
      I <- I + nd * (s2 / s0 - tcrossprod(s1 / s0))
    }
    step <- solve(I, U); b <- b + step
    if (max(abs(step)) < 1e-10) break
  }
  se <- sqrt(diag(solve(I))); z <- b / se
  data.frame(term = colnames(x), coef = b, se = se, hr = exp(b), lcl = exp(b - qnorm(0.975) * se), ucl = exp(b + qnorm(0.975) * se), p = 2 * pnorm(-abs(z)), stringsAsFactors = FALSE)
}
`
