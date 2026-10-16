---
title: "Does Credit Option Skew Predict Spread Widening?"
date: "2026-10-15"
abstract: "I'm building a credit analytics engine and using it to test whether skew in credit ETF options predicts spread widening once you strip out the part of skew that comes mechanically from measuring in price instead of spread. Credit ETF options are quoted on price, but credit risk lives in spreads, and the mapping between the two is nonlinear, so some of the skew you see is just that translation. The question is whether what's left over carries real information about where spreads go next."
tags: ["credit", "options", "skew"]
status: "In Progress"
repo: "https://github.com/owensharpe/credit-option-skew-predicting-spread-widening"
---

## Where it stands

It handles the general credit analytics the paper needs, and the paper's tests sit on top of it. The data comes from Bloomberg and can't be redistributed, so the code will be public but the data won't be.

## Next

- Working on finishing the engine
- Separate the mechanical part of skew from the rest
- Test the residual against future spread changes
