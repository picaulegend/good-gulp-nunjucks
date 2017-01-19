import gulp from "gulp";
import gutil from "gulp-util";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import runSequence from "run-sequence";
import webpackConfig from "./webpack.conf";
import del from "del";
import plugins from 'gulp-load-plugins';
import pump from 'pump';
import aws from 'aws-sdk';

/* variables */
const $ = plugins();
const browserSync = BrowserSync.create();

/* work, build, publish */
gulp.task('default', (cb) => {
  runSequence('browserSync',
    cb
  )
})

gulp.task('build', (cb) => {
  runSequence('clean', ['html', 'css', 'js', 'img', 'misc'], 'revreplace',
    cb
  )
})

gulp.task('publish', (cb) => {
  runSequence('s3',
    cb
  )
})


/* webpack for js */
gulp.task("bundling", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });
});


/* browser */
gulp.task("browserSync", ["bundling"], () => {
  browserSync.init({
    server: {
      baseDir: "./src"
    }
  });
  gulp.watch('src/sass/**/*.scss', ['sass']);
  gulp.watch('src/**/*.nunjucks', ['nunjucks']);
  gulp.watch("./src/js/**/*.js", ["js"]);
});


/* html */
gulp.task('html', () => {
  return gulp.src('src/*.html')
    .pipe($.htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('dist/'))
})

gulp.task('js', (cb) => {
  pump([
        gulp.src('src/bundle/*.js'),
        $.uglify(),
        gulp.dest('dist/bundle/')
    ],
    cb
  );
});

/* sass */
gulp.task("sass", () => {
  return gulp.src('src/sass/**/*')
    .pipe($.sourcemaps.init())
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.sourcemaps.write('/maps/'))
    .pipe(gulp.dest('src/css/'))
    .pipe(browserSync.reload({
      stream: true
    }));
})

/* css */
gulp.task('css', () => {
  return gulp.src('src/css/**/*')
    .pipe($.cleanCss())
    .pipe(gulp.dest('dist/css/'))
})

/* img */
gulp.task('img', () => {
  return gulp.src('src/img/**/*')
    .pipe($.changed('dist/img'))
    .pipe($.image())
    .pipe(gulp.dest('dist/img/'))
})

/* misc */
gulp.task('misc', function() {
  return gulp.src('src/misc/**/*')
    .pipe($.changed('dist/misc'))
    .pipe(gulp.dest('dist/misc/'))
})


/* cleaning */
gulp.task('clean', () => {
  return del.sync(['dist/css/', 'dist/bundle/']);
})

/* revving & replacing */
gulp.task('revision', () => {
  return gulp.src(['dist/**/*.css', 'dist/**/*.js'])
    .pipe($.rev())
    .pipe($.revDeleteOriginal())
    .pipe(gulp.dest('dist'))
    .pipe($.rev.manifest())
    .pipe(gulp.dest('dist'))
})

gulp.task('revreplace', ['revision'], () => {
  var manifest = gulp.src("dist/rev-manifest.json");

  return gulp.src('dist/index.html')
    .pipe($.revReplace({manifest: manifest}))
    .pipe(gulp.dest('dist'));
});


/* s3 */
gulp.task('s3', () => {
  var publisher = plugins.awspublish.create({
    params: {
     Bucket: ''
  },
  credentials: new AWS.SharedIniFileCredentials({profile: 'default'})
  });
  
  var headers = {
    'Cache-Control': 'max-age=315360000, no-transform, public'
  };
 
  return gulp.src('./dist/**/*')
    .pipe($.awspublish.gzip())
    .pipe(publisher.publish(headers))
    .pipe(publisher.cache())
    .pipe($.awspublish.reporter());
});




/* nunjucks */
gulp.task('nunjucks', function() {
  return gulp.src('src/pages/**/*.nunjucks')
    .pipe($.nunjucksHtml({
      searchPaths: ['src/templates'],
      ext: '.html'
    }))
    .pipe(gulp.dest('src'))
    .pipe(browserSync.reload({
      stream: true
    }));
});