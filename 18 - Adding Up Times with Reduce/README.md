# Adding Up Times with Reduce

## Entry point

`18 - Adding Up Times with Reduce/index-START.html`

## Run

From the repository root:

`python3 -m http.server 8000`

Open:

`http://127.0.0.1:8000/18%20-%20Adding%20Up%20Times%20with%20Reduce/index-START.html`

## Walkthrough

The page renders 58 video rows. Each `data-time` value is converted from `mm:ss` to seconds and reduced into one total.

Expected rendered result:

`Total time: 4 hours, 58 minutes, 58 seconds`

## Regression test

From the repository root:

`node tests/course/r57-t027.mjs`

Evidence is stored in `work/R57-T027/`.
