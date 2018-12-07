# Voting example project

Example voting application where you can vote for either cats or dogs. You can vote as many times as you would like.


## Usage

The simplest way to see this in action is to run `garden deploy` or `garden dev` in the project's top-level directory.

```sh
garden dev
Good afternoon! Let's get your environment wired up...

✔ local-kubernetes          → Configured
✔ jworker                   → Building jworker:8bbc389b3e... → Done (took 0.6 sec)
✔ postgres                  → Building → Done (took 0.4 sec)
✔ result                    → Building result:8bbc389b3e... → Done (took 0.5 sec)
✔ vote                      → Building vote:8bbc389b3e-1543837972... → Done (took 0.5 sec)
✔ redis                     → Checking status → Version 8bbc389b3e already deployed
✔ db                        → Checking status → Version 8bbc389b3e already deployed
✔ result                    → Checking status → Version 8bbc389b3e already deployed
```

### To Vote

open http://vote.local.app.garden/

### View Results

open http://vote.local.app.garden/result

## Running

```sh
garden dev --hot-reload=frontend
```
