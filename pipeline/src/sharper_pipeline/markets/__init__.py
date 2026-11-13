"""Rates and credit snapshot for the site's Credit tab.

Separate from the news pipeline on purpose: it needs none of the embedding or
LLM machinery, runs on its own schedule, and a failure here should never cost
a day's digest (or the other way round).
"""
