import gulp from 'gulp'
import gulpLoadPlugins from 'gulp-load-plugins'
import path from 'path'
import del from 'del'
import runSequence from 'run-sequence'
import minimist from 'minimist'
import zip from 'gulp-zip'
import fs from 'fs'

const plugins = gulpLoadPlugins()

const paths = {
  js: ['./**/*.js', '!dist/**', '!node_modules/**', '!coverage/**'],
  nonJs: ['./package.json', './.gitignore', './.env'],
  tests: './server/tests/*.js'
}

const knownOptions = {
  string: 'packagePath',
  default: { packageName: 'Package.zip', packagePath: path.join(__dirname, '_package') }
}

const options = minimist(process.argv.slice(2), knownOptions)

// Clean up dist and coverage directory
gulp.task('clean', () =>
  del.sync(['dist/**', 'dist/.*', 'coverage/**', '!dist', '!coverage'])
)

// Copy non-js files to dist
gulp.task('copy', () =>
  gulp.src(paths.nonJs)
    .pipe(plugins.newer('dist'))
    .pipe(gulp.dest('dist'))
)

gulp.task('package', () => {
  const packagePaths = ['dist/**',
    '!**/_package/**',
    '!**/typings/**',
    '!typings',
    '!_package',
    '!gulpfile.js']

    // add exclusion patterns for all dev dependencies
  const packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))
  const devDeps = packageJSON.devDependencies

  for (let i = 0; i < devDeps.length; i++) {
    const excludePattern1 = `!**/node_modules/${devDeps[i]}/**`
    const excludePattern2 = `!**/node_modules/${devDeps[i]}`
    packagePaths.push(excludePattern1)
    packagePaths.push(excludePattern2)
  }

  return gulp.src(packagePaths)
          .pipe(zip(options.packageName))
          .pipe(gulp.dest(options.packagePath))
})

// Compile ES6 to ES5 and copy to dist
gulp.task('babel', () =>
  gulp.src([...paths.js, '!gulpfile.babel.js'], { base: '.' })
    .pipe(plugins.newer('dist'))
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.babel())
    .pipe(plugins.sourcemaps.write('.', {
      includeContent: false,
      sourceRoot(file) {
        return path.relative(file.path, __dirname)
      }
    }))
    .pipe(gulp.dest('dist'))
)

// Start server with restart on file changes
gulp.task('nodemon', ['copy', 'babel'], () =>
  plugins.nodemon({
    script: path.join('dist', 'index.js'),
    ext: 'js',
    ignore: ['node_modules/**/*.js', 'dist/**/*.js'],
    tasks: ['copy', 'babel']
  })
)

// gulp serve for development
gulp.task('serve', ['clean'], () => runSequence('nodemon'))

// default task: clean dist, compile js files and copy non-js files.
gulp.task('default', ['clean'], () => {
  runSequence(
    ['copy', 'babel']
  )
})
