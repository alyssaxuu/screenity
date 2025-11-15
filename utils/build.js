// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";
process.env.ASSET_PATH = "/";

var webpack = require("webpack"),
  config = require("../webpack.config");

//delete config.chromeExtensionBoilerplate;
delete config.custom;

config.mode = "production";

webpack(config, (err, stats) => {
  if (err) {
    console.error("Webpack compilation error:", err);
    throw err;
  }

  if (stats.hasErrors()) {
    console.error("Webpack compilation failed with errors:");
    const info = stats.toJson();
    console.error(info.errors);
    process.exit(1);
  }

  if (stats.hasWarnings()) {
    console.warn("Webpack compilation had warnings:");
    const info = stats.toJson();
    console.warn(info.warnings);
  }

  console.log("Production build completed successfully!");
});
