const nodeEnv = process.env.NODE_ENV || "production";
process.env.BABEL_ENV = nodeEnv;
process.env.NODE_ENV = nodeEnv;
process.env.ASSET_PATH = "/";

var webpack = require("webpack"),
  config = require("../webpack.config");

//delete config.chromeExtensionBoilerplate;
delete config.custom;

config.mode = nodeEnv;

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
