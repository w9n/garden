/*
 * Copyright (C) 2018 Garden Technologies, Inc. <info@garden.io>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import {
  spawn as _spawn,
} from "child_process"
import { resolve, join } from "path"
import { spawn } from "../support/support-util"

import { Linter } from "tslint"

// const cached = require("gulp-cached")
const pegjs = require("gulp-pegjs")
const sourcemaps = require("gulp-sourcemaps")
const gulpTslint = require("gulp-tslint")
const ts = require("gulp-typescript")

const tsConfigFilename = "tsconfig.build.json"
const tsConfigPath = resolve(__dirname, tsConfigFilename)
const tsProject = ts.createProject(tsConfigPath, {
  declaration: true,
})

const tsSources = resolve(__dirname, "src", "**", "*.ts")
const testTsSources = resolve(__dirname, "test", "**", "*.ts")
const pegjsSources = resolve(__dirname, "src", "*.pegjs")

const npmBinPath = (name: string) => resolve(__dirname, "node_modules", ".bin", name)
const destDir = resolve(__dirname, "build")
const binDir = resolve(__dirname, "bin")

module.exports = (gulp) => {
  gulp.task("add-version-files", () => spawn(join(binDir, "add-version-files.ts"), []))

  gulp.task("build-container", () => spawn("docker", ["build", "-t", "gardenengine/garden-service:latest", __dirname]))

  gulp.task("generate-docs", () => spawn(join(binDir, "generate-docs.ts"), []))

  gulp.task("mocha", () => spawn(npmBinPath("nyc"), [npmBinPath("mocha")], __dirname))

  gulp.task("pegjs", () =>
    gulp.src(pegjsSources)
      .pipe(pegjs({ format: "commonjs" }))
      .pipe(gulp.dest(destDir)),
  )

  gulp.task("pegjs-watch", () =>
    gulp.watch(pegjsSources, gulp.parallel("pegjs")),
  )

  gulp.task("tsc", () =>
    tsProject.src()
      .pipe(sourcemaps.init())
      .pipe(tsProject(ts.reporter.fullReporter(true)))
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(destDir)),
  )

  gulp.task("tsc-watch", () =>
    spawn(npmBinPath("tsc"), [
      "-w",
      "--pretty",
      "--declaration",
      "-p", tsConfigPath,
      "--outDir", destDir,
      "--preserveWatchOutput",
    ],
    ),
  )

  gulp.task("tsfmt", () => spawn(npmBinPath("tsfmt"), ["--verify"]))

  const projectTslint = gulpTslint({
    program: Linter.createProgram(tsConfigPath),
    formatter: "verbose",
  })
  const testTslint = gulpTslint({
    program: Linter.createProgram(tsConfigPath),
    formatter: "verbose",
  })
  const tslintReporter = gulpTslint.report()

  gulp.task("tslint", () =>
    gulp.src(tsSources)
      // .pipe(cached("tslint"))
      .pipe(projectTslint)
      .pipe(tslintReporter),
  )

  gulp.task("tslint-tests", () =>
    gulp.src(testTsSources)
      // .pipe(cached("tslint-tests"))
      .pipe(testTslint)
      .pipe(tslintReporter),
  )

  // const tsfmtFile = (path) => {
  //   try {
  //     _spawn(npmBinPath("tsfmt"), ["--verify", path], { stdio: "inherit" })
  //   } catch (_) { }
  // }

  gulp.task("watch-sources", () => {
    const task = gulp.series(
      gulp.parallel("generate-docs", "tsc", "tslint"),
      "build-container",
    )

    return gulp.watch(tsSources, task)
      // .on("add", verify)
      // .on("change", verify)
  })

  gulp.task("watch-sources-light", () => {
    return gulp.watch(tsSources, gulp.parallel("generate-docs", "tslint"))
  })

  gulp.task("watch-tests", () => {
    return gulp.watch(tsSources, gulp.parallel("tslint-tests"))
      // .on("add", verify)
      // .on("change", verify)
    })

  gulp.task("build", gulp.series(
    gulp.parallel("add-version-files", "generate-docs", "pegjs", "tsc"),
    "build-container",
  ))

  gulp.task("ci-build", gulp.parallel(
    "add-version-files", "generate-docs", "pegjs", "tsc",
  ))

  gulp.task("test", gulp.parallel("build", "mocha"))
  gulp.task("watch", gulp.parallel("pegjs-watch", "watch-sources", "watch-tests"))
  gulp.task("watch-light", gulp.parallel("pegjs-watch", "tsc-watch", "watch-sources-light", "watch-tests"))
  gulp.task("default", gulp.series("watch"))
}

if (process.cwd() === __dirname) {
  module.exports(require("gulp"))
}
