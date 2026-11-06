---
title: "Does Credit Option Skew Predict Spread Widening?"
date: "2026-10-15"
abstract: "Does skew in credit ETF options predict spread widening once you strip out the part that comes purely from measuring in price instead of spread? Credit ETF options are quoted on price, but credit risk lives in spreads. Spreads tend to move in proportion to their level, and prices fall when spreads rise, so even a smile that’s flat in spread terms shows up as put skew in price terms. Some of the skew you see is just that translation. My question would be whether what’s left over carries real information about where spreads go next."
tags: ["credit", "options", "skew"]
status: "In Progress"
repo: "https://github.com/owensharpe/credit-option-skew"
---

## Where it stands

The analytics engine lives in its own repo, [credit-engine], and is shared with another paper. This paper’s tests sit on top of it. The data comes from Bloomberg and can’t be redistributed, so the code is public but the data isn’t.

## Next

- Finish the engine core: OIS curve, CDX pricing, price-to-spread mapping
- Measure how much price-space skew is mechanical, using simulated spread paths
- Test what’s left against future spread changes
