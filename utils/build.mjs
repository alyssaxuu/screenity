import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nodeEnv = process.env.NODE_ENV || "production";
process.env.BABEL_ENV = nodeEnv;
process.env.NODE_ENV = nodeEnv;
process.env.ASSET_PATH = "/";

const webpack = require("webpack");
const config = require("../webpack.config");

delete config.custom;
config.mode = nodeEnv;

await new Promise((resolve, reject) => {
  webpack(config, (error, stats) => {
    if (error) {
      console.error("Webpack compilation error:", error);
      reject(error);
      return;
    }

    if (stats.hasErrors()) {
      console.error("Webpack compilation failed with errors:");
      const info = stats.toJson();
      console.error(info.errors);
      reject(new Error("Webpack compilation failed"));
      return;
    }

    if (stats.hasWarnings()) {
      console.warn("Webpack compilation had warnings:");
      const info = stats.toJson();
      console.warn(info.warnings);
    }

    console.log("Production build completed successfully!");
    resolve();
  });
});
